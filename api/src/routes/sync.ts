import { zValidator } from "@hono/zod-validator";
import { eq, gt } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { createDb } from "../db/client.js";
import { calculations } from "../db/schema.js";
import type { ApiErrorResponse, ApiSuccessResponse } from "../types/api.js";
import { HttpError } from "../types/api.js";

type Bindings = {
	DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings }>;

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

const syncRequestValidator = zValidator(
	"json",
	SyncRequestSchema,
	(result, context) => {
		if (result.success) {
			return;
		}

		const response: ApiErrorResponse = {
			success: false,
			error: {
				message: "Validation failed",
				code: "VALIDATION_ERROR",
				details: result.error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			},
		};

		return context.json(response, 400);
	},
);

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

interface DbSyncRecord {
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
	syncVersion: number;
	userId: string | null;
	sessionId: string | null;
	deviceId: string | null;
}

const UPSERT_CALCULATION_SQL = `
	INSERT INTO calculations (
		id,
		created_at,
		updated_at,
		deleted_at,
		user_id,
		session_id,
		manufacturer,
		part_number,
		purchase_url,
		notes,
		units,
		wire_diameter,
		outer_diameter,
		active_coils,
		average_diameter,
		spring_rate,
		sync_version,
		device_id
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
	ON CONFLICT(id) DO UPDATE SET
		created_at = excluded.created_at,
		updated_at = excluded.updated_at,
		deleted_at = excluded.deleted_at,
		user_id = excluded.user_id,
		session_id = excluded.session_id,
		manufacturer = excluded.manufacturer,
		part_number = excluded.part_number,
		purchase_url = excluded.purchase_url,
		notes = excluded.notes,
		units = excluded.units,
		wire_diameter = excluded.wire_diameter,
		outer_diameter = excluded.outer_diameter,
		active_coils = excluded.active_coils,
		average_diameter = excluded.average_diameter,
		spring_rate = excluded.spring_rate,
		device_id = excluded.device_id,
		sync_version = calculations.sync_version + 1
`;

const SOFT_DELETE_SQL = `
	UPDATE calculations
	SET deleted_at = ?, updated_at = ?, sync_version = sync_version + 1
	WHERE id = ? AND deleted_at IS NULL
`;

const getDb = (context: AppContext) => {
	if (!context.env.DB) {
		throw new HttpError(
			503,
			"D1 binding DB is not configured.",
			"DATABASE_UNAVAILABLE",
		);
	}

	return createDb(context.env.DB);
};

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
		userId: null,
		sessionId: null,
		deviceId: null,
	};
}

function toUpsertBindings(record: SpringCalcRecord): unknown[] {
	const dbRecord = toDbRecord(record);

	return [
		dbRecord.id,
		dbRecord.createdAt,
		dbRecord.updatedAt,
		dbRecord.deletedAt,
		dbRecord.userId,
		dbRecord.sessionId,
		dbRecord.manufacturer,
		dbRecord.partNumber,
		dbRecord.purchaseUrl,
		dbRecord.notes,
		dbRecord.units,
		dbRecord.wireDiameter,
		dbRecord.outerDiameter,
		dbRecord.activeCoils,
		dbRecord.averageDiameter,
		dbRecord.springRate,
		dbRecord.deviceId,
	];
}

/**
 * Maps database column names to client-side SpringCalcRecord field names.
 */
function toClientRecord(dbRecord: DbSyncRecord): SpringCalcRecord {
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

function recordsMatch(
	left: SpringCalcRecord,
	right: SpringCalcRecord,
): boolean {
	return (
		left.id === right.id &&
		left.createdAt === right.createdAt &&
		left.updatedAt === right.updatedAt &&
		left.deletedAt === right.deletedAt &&
		left.manufacturer === right.manufacturer &&
		left.partNumber === right.partNumber &&
		(left.purchaseUrl ?? null) === (right.purchaseUrl ?? null) &&
		(left.notes ?? null) === (right.notes ?? null) &&
		left.units === right.units &&
		left.d === right.d &&
		left.D === right.D &&
		left.n === right.n &&
		left.Davg === right.Davg &&
		left.k === right.k
	);
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

app.post("/", syncRequestValidator, async (context) => {
	const syncRequest = context.req.valid("json");
	const { changes, lastSyncTimestamp } = syncRequest;
	const db = getDb(context);
	const database = context.env.DB;

	const conflicts: ConflictResolution[] = [];
	const newSyncTimestamp = Date.now();
	const since = lastSyncTimestamp ?? 0;

	// Categorize changes by operation type
	const created: SpringCalcRecord[] = [];
	const updated: SpringCalcRecord[] = [];
	const deleted = new Set<string>();

	for (const change of changes) {
		switch (change.type) {
			case "add": {
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
			}
			case "delete":
				deleted.add(change.id);
				break;
			case "bulkDelete":
				for (const id of change.ids) {
					deleted.add(id);
				}
				break;
			case "clear":
				throw new HttpError(
					400,
					"Clear operation not yet supported. Please delete records individually.",
					"UNSUPPORTED_OPERATION",
				);
		}
	}

	// Check for conflicts before applying changes
	const statements: D1PreparedStatement[] = created.map((record) =>
		database.prepare(UPSERT_CALCULATION_SQL).bind(...toUpsertBindings(record)),
	);

	for (const record of updated) {
		const existing = (await db
			.select()
			.from(calculations)
			.where(eq(calculations.id, record.id))
			.get()) as DbSyncRecord | undefined;

		if (existing) {
			const existingRecord = toClientRecord(existing);

			if (recordsMatch(existingRecord, record)) {
				continue;
			}

			if (existing.deletedAt === null && existing.updatedAt !== record.updatedAt) {
				const conflict = resolveConflict(record, existingRecord);
				conflicts.push(conflict);

				if (conflict.winner !== record) {
					continue;
				}
			}
		}

		statements.push(
			database.prepare(UPSERT_CALCULATION_SQL).bind(...toUpsertBindings(record)),
		);
	}

	for (const id of deleted) {
		statements.push(
			database.prepare(SOFT_DELETE_SQL).bind(newSyncTimestamp, newSyncTimestamp, id),
		);
	}

	if (statements.length > 0) {
		await database.batch(statements);
	}

	// Fetch server-side changes since lastSyncTimestamp
	const serverChanges = (await db
		.select()
		.from(calculations)
		.where(gt(calculations.updatedAt, since))
		.all()) as DbSyncRecord[];

	// Separate server changes into created, updated, deleted
	const serverCreated: SpringCalcRecord[] = [];
	const serverUpdated: SpringCalcRecord[] = [];
	const serverDeleted: string[] = [];

	for (const dbRecord of serverChanges) {
		const clientRecord = toClientRecord(dbRecord);

		if (dbRecord.deletedAt !== null && dbRecord.deletedAt > since) {
			serverDeleted.push(dbRecord.id);
		} else if (dbRecord.createdAt > since) {
			serverCreated.push(clientRecord);
		} else {
			serverUpdated.push(clientRecord);
		}
	}

	// Build response
	const response: ApiSuccessResponse<SyncResponse> = {
		success: true,
		data: {
			newSyncTimestamp,
			created: serverCreated,
			updated: serverUpdated,
			deleted: serverDeleted,
			conflicts,
		},
	};

	return context.json(response);
});

export default app;
