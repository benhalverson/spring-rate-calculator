import { zValidator } from "@hono/zod-validator";
import { eq, gt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { type AppDb, createDb } from "../db/client.js";
import {
	type Calculation,
	calculations,
	type NewCalculation,
} from "../db/schema.js";
import type { ApiErrorResponse, ApiSuccessResponse } from "../types/api.js";
import { HttpError } from "../types/api.js";

type Bindings = {
	DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings }>;
type DbSyncRecord = Calculation;

const app = new Hono<{ Bindings: Bindings }>();

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
		deletedAt: z.number(),
	}),
	z.object({
		type: z.literal("bulkDelete"),
		ids: z.array(z.string()).min(1),
		deletedAt: z.number(),
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

const getDb = (context: AppContext): AppDb => {
	if (!context.env.DB) {
		throw new HttpError(
			503,
			"D1 binding DB is not configured.",
			"DATABASE_UNAVAILABLE",
		);
	}

	return createDb(context.env.DB);
};

const toDbRecord = (
	record: SpringCalcRecord,
	syncVersion: number,
): DbSyncRecord => ({
	id: record.id,
	createdAt: record.createdAt,
	updatedAt: record.updatedAt,
	deletedAt: record.deletedAt,
	userId: null,
	sessionId: null,
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
	syncVersion,
	deviceId: null,
});

const toDbInsert = (record: DbSyncRecord): NewCalculation => ({
	id: record.id,
	createdAt: record.createdAt,
	updatedAt: record.updatedAt,
	deletedAt: record.deletedAt,
	userId: record.userId,
	sessionId: record.sessionId,
	manufacturer: record.manufacturer,
	partNumber: record.partNumber,
	purchaseUrl: record.purchaseUrl,
	notes: record.notes,
	units: record.units,
	wireDiameter: record.wireDiameter,
	outerDiameter: record.outerDiameter,
	activeCoils: record.activeCoils,
	averageDiameter: record.averageDiameter,
	springRate: record.springRate,
	syncVersion: record.syncVersion,
	deviceId: record.deviceId,
});

const toDbUpdate = (record: DbSyncRecord) => ({
	updatedAt: record.updatedAt,
	deletedAt: record.deletedAt,
	userId: record.userId,
	sessionId: record.sessionId,
	manufacturer: record.manufacturer,
	partNumber: record.partNumber,
	purchaseUrl: record.purchaseUrl,
	notes: record.notes,
	units: record.units,
	wireDiameter: record.wireDiameter,
	outerDiameter: record.outerDiameter,
	activeCoils: record.activeCoils,
	averageDiameter: record.averageDiameter,
	springRate: record.springRate,
	syncVersion: record.syncVersion,
	deviceId: record.deviceId,
});

const toClientRecord = (dbRecord: DbSyncRecord): SpringCalcRecord => ({
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
});

const recordsMatch = (
	left: SpringCalcRecord,
	right: SpringCalcRecord,
): boolean =>
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
	left.k === right.k;

const resolveConflict = (
	clientRecord: SpringCalcRecord,
	serverRecord: SpringCalcRecord,
): ConflictResolution => {
	const clientWins = clientRecord.updatedAt > serverRecord.updatedAt;
	const winner = clientWins ? clientRecord : serverRecord;
	const loser = clientWins ? serverRecord : clientRecord;
	const winnerLabel = clientWins ? "client" : "server";
	const loserLabel = clientWins ? "server" : "client";

	return {
		id: clientRecord.id,
		winner,
		loser,
		reason: `Last-write-wins: ${winnerLabel} version (${winner.updatedAt}) is newer than ${loserLabel} version (${loser.updatedAt})`,
	};
};

const toDeletedClientRecord = (
	record: DbSyncRecord,
	deletedAt: number,
): SpringCalcRecord => ({
	...toClientRecord(record),
	updatedAt: deletedAt,
	deletedAt,
});

const getProjectedRecord = async (
	db: AppDb,
	projectedRecords: Map<string, DbSyncRecord | undefined>,
	id: string,
): Promise<DbSyncRecord | undefined> => {
	if (!projectedRecords.has(id)) {
		const record = (await db
			.select()
			.from(calculations)
			.where(eq(calculations.id, id))
			.get()) as DbSyncRecord | undefined;

		projectedRecords.set(id, record);
	}

	return projectedRecords.get(id);
};

const batchWrites = async (
	db: AppDb,
	records: DbSyncRecord[],
): Promise<void> => {
	if (records.length === 0) {
		return;
	}

	const statements = records.map((record) =>
		db
			.insert(calculations)
			.values(toDbInsert(record))
			.onConflictDoUpdate({
				target: calculations.id,
				set: toDbUpdate(record),
			}),
	) as BatchItem<"sqlite">[];

	await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
};

app.post("/", syncRequestValidator, async (context) => {
	const { changes, lastSyncTimestamp } = context.req.valid("json");
	const db = getDb(context);
	const conflicts: ConflictResolution[] = [];
	const projectedRecords = new Map<string, DbSyncRecord | undefined>();
	const dirtyRecords = new Map<string, DbSyncRecord>();
	const newSyncTimestamp = Date.now();
	const since = lastSyncTimestamp ?? 0;

	const setProjectedRecord = (record: DbSyncRecord): void => {
		projectedRecords.set(record.id, record);
		dirtyRecords.set(record.id, record);
	};

	const applyDelete = async (id: string, deletedAt: number): Promise<void> => {
		const existing = await getProjectedRecord(db, projectedRecords, id);

		if (!existing || existing.deletedAt !== null) {
			return;
		}

		const deletedRecord = toDeletedClientRecord(existing, deletedAt);
		const existingRecord = toClientRecord(existing);
		const conflict = resolveConflict(deletedRecord, existingRecord);
		conflicts.push(conflict);

		if (conflict.winner !== deletedRecord) {
			return;
		}

		setProjectedRecord({
			...existing,
			updatedAt: deletedAt,
			deletedAt,
			syncVersion: existing.syncVersion + 1,
		});
	};

	for (const change of changes) {
		switch (change.type) {
			case "add": {
				const existing = await getProjectedRecord(
					db,
					projectedRecords,
					change.record.id,
				);

				if (!existing) {
					setProjectedRecord(toDbRecord(change.record, 1));
					break;
				}

				const existingRecord = toClientRecord(existing);

				if (recordsMatch(existingRecord, change.record)) {
					break;
				}

				const conflict = resolveConflict(change.record, existingRecord);
				conflicts.push(conflict);

				if (conflict.winner === change.record) {
					setProjectedRecord({
						...toDbRecord(change.record, existing.syncVersion + 1),
						createdAt: existing.createdAt,
					});
				}
				break;
			}
			case "delete":
				await applyDelete(change.id, change.deletedAt);
				break;
			case "bulkDelete":
				for (const id of change.ids) {
					await applyDelete(id, change.deletedAt);
				}
				break;
		}
	}

	await batchWrites(db, Array.from(dirtyRecords.values()));

	const serverChanges = (await db
		.select()
		.from(calculations)
		.where(gt(calculations.updatedAt, since))
		.all()) as DbSyncRecord[];

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
