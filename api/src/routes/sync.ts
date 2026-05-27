import { zValidator } from "@hono/zod-validator";
import { eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db/client.js";
import { calculations } from "../db/schema.js";

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const SpringCalcRecordSchema = z.object({
	id: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
	deletedAt: z.number().nullable(),
	manufacturer: z.string(),
	partNumber: z.string(),
	purchaseUrl: z.string().optional(),
	notes: z.string().optional(),
	units: z.enum(["mm", "in"]),
	d: z.number(),
	D: z.number(),
	n: z.number(),
	Davg: z.number(),
	k: z.number(),
});

const SyncOperationSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("add"),
		record: SpringCalcRecordSchema,
	}),
	z.object({
		type: z.literal("delete"),
		id: z.string(),
	}),
	z.object({
		type: z.literal("bulkDelete"),
		ids: z.array(z.string()),
	}),
	z.object({
		type: z.literal("clear"),
	}),
]);

const SyncRequestSchema = z.object({
	changes: z.array(SyncOperationSchema),
	lastSyncTimestamp: z.number().nullable(),
});

type SpringCalcRecord = z.infer<typeof SpringCalcRecordSchema>;

interface ConflictResolution {
	id: string;
	winner: SpringCalcRecord;
	loser: SpringCalcRecord;
	reason: string;
}

interface SyncResponse {
	newSyncTimestamp: number;
	created: SpringCalcRecord[];
	updated: SpringCalcRecord[];
	deleted: string[];
	conflicts: ConflictResolution[];
}

/**
 * Maps client-side SpringCalcRecord field names to database column names.
 */
function toDbRecord(record: SpringCalcRecord) {
	return {
		id: record.id,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		deletedAt: record.deletedAt,
		manufacturer: record.manufacturer,
		partNumber: record.partNumber,
		purchaseUrl: record.purchaseUrl ?? null,
		notes: record.notes ?? null,
		units: record.units,
		wireDiameter: record.d,
		outerDiameter: record.D,
		activeCoils: record.n,
		averageDiameter: record.Davg,
		springRate: record.k,
		syncVersion: 1,
		userId: null,
		sessionId: null,
		deviceId: null,
	};
}

/**
 * Maps database column names to client-side SpringCalcRecord field names.
 */
function toClientRecord(dbRecord: {
	id: string;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
	manufacturer: string;
	partNumber: string;
	purchaseUrl: string | null;
	notes: string | null;
	units: "mm" | "in";
	wireDiameter: number;
	outerDiameter: number;
	activeCoils: number;
	averageDiameter: number;
	springRate: number;
}): SpringCalcRecord {
	return {
		id: dbRecord.id,
		createdAt: dbRecord.createdAt,
		updatedAt: dbRecord.updatedAt,
		deletedAt: dbRecord.deletedAt,
		manufacturer: dbRecord.manufacturer,
		partNumber: dbRecord.partNumber,
		purchaseUrl: dbRecord.purchaseUrl ?? undefined,
		notes: dbRecord.notes ?? undefined,
		units: dbRecord.units,
		d: dbRecord.wireDiameter,
		D: dbRecord.outerDiameter,
		n: dbRecord.activeCoils,
		Davg: dbRecord.averageDiameter,
		k: dbRecord.springRate,
	};
}

/**
 * Implements last-write-wins conflict resolution.
 */
function resolveConflict(
	clientRecord: SpringCalcRecord,
	serverRecord: SpringCalcRecord,
): ConflictResolution {
	const winner =
		clientRecord.updatedAt > serverRecord.updatedAt
			? clientRecord
			: serverRecord;
	const loser =
		clientRecord.updatedAt > serverRecord.updatedAt
			? serverRecord
			: clientRecord;

	const winnerLabel = winner === clientRecord ? "client" : "server";
	const loserLabel = winner === clientRecord ? "server" : "client";

	return {
		id: clientRecord.id,
		winner,
		loser,
		reason: `Last-write-wins: ${winnerLabel} version (${winner.updatedAt}) is newer than ${loserLabel} version (${loser.updatedAt})`,
	};
}

/**
 * POST /sync - Handles offline sync with last-write-wins conflict resolution.
 */
app.post("/", zValidator("json", SyncRequestSchema), async (c) => {
	const syncRequest = c.req.valid("json");
	const { changes, lastSyncTimestamp } = syncRequest;
	const db = createDb(c.env.DB);

	const conflicts: ConflictResolution[] = [];
	const newSyncTimestamp = Date.now();

	// Categorize changes by operation type
	const created: SpringCalcRecord[] = [];
	const updated: SpringCalcRecord[] = [];
	const deleted: string[] = [];

	for (const change of changes) {
		switch (change.type) {
			case "add":
				// Determine if this is a new record or an update
				const existing = await db
					.select()
					.from(calculations)
					.where(eq(calculations.id, change.record.id))
					.get();

				if (existing) {
					updated.push(change.record);
				} else {
					created.push(change.record);
				}
				break;
			case "delete":
				deleted.push(change.id);
				break;
			case "bulkDelete":
				deleted.push(...change.ids);
				break;
			case "clear":
				// Clear operation not supported - requires user/session context
				return c.json(
					{
						error:
							"Clear operation not yet supported. Please delete records individually.",
					},
					400,
				);
		}
	}

	// Check for conflicts before applying changes
	const recordsToApply: SpringCalcRecord[] = [];

	for (const record of updated) {
		const existing = await db
			.select()
			.from(calculations)
			.where(eq(calculations.id, record.id))
			.get();

		if (
			existing &&
			existing.deletedAt === null &&
			existing.updatedAt !== record.updatedAt
		) {
			// Conflict detected - resolve using last-write-wins
			const existingRecord = toClientRecord(existing);
			const conflict = resolveConflict(record, existingRecord);
			conflicts.push(conflict);
			recordsToApply.push(conflict.winner);
		} else {
			// No conflict or same timestamp, or existing record is already deleted
			recordsToApply.push(record);
		}
	}

	// Apply all changes
	// Insert created records
	for (const record of created) {
		const dbRecord = toDbRecord(record);
		await db.insert(calculations).values(dbRecord).onConflictDoUpdate({
			target: calculations.id,
			set: dbRecord,
		});
	}

	// Update records after conflict resolution
	for (const record of recordsToApply) {
		const dbRecord = toDbRecord(record);
		await db.insert(calculations).values(dbRecord).onConflictDoUpdate({
			target: calculations.id,
			set: dbRecord,
		});
	}

	// Soft delete records
	for (const id of deleted) {
		await db
			.update(calculations)
			.set({
				deletedAt: newSyncTimestamp,
				updatedAt: newSyncTimestamp,
			})
			.where(eq(calculations.id, id));
	}

	// Fetch server-side changes since lastSyncTimestamp
	const serverChanges = await db
		.select()
		.from(calculations)
		.where(gt(calculations.updatedAt, lastSyncTimestamp ?? 0))
		.all();

	// Separate server changes into created, updated, deleted
	const serverCreated: SpringCalcRecord[] = [];
	const serverUpdated: SpringCalcRecord[] = [];
	const serverDeleted: string[] = [];

	for (const dbRecord of serverChanges) {
		const clientRecord = toClientRecord(dbRecord);

		if (
			dbRecord.deletedAt !== null &&
			dbRecord.deletedAt > (lastSyncTimestamp ?? 0)
		) {
			serverDeleted.push(dbRecord.id);
		} else if (dbRecord.createdAt > (lastSyncTimestamp ?? 0)) {
			serverCreated.push(clientRecord);
		} else {
			serverUpdated.push(clientRecord);
		}
	}

	// Build response
	const response: SyncResponse = {
		newSyncTimestamp,
		created: serverCreated,
		updated: serverUpdated,
		deleted: serverDeleted,
		conflicts,
	};

	return c.json(response);
});

export default app;
