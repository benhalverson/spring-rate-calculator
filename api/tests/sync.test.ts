import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredRecord = {
	id: string;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
	userId: string | null;
	sessionId: string | null;
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
	deviceId: string | null;
};

type SyncApiRecord = {
	id: string;
	createdAt: number;
	updatedAt: number;
	deletedAt: number | null;
	manufacturer: string;
	partNumber: string;
	purchaseUrl?: string;
	notes?: string;
	units: "mm" | "in";
	d: number;
	D: number;
	n: number;
	Davg: number;
	k: number;
};

type SyncSuccessBody = {
	success: true;
	data: {
		newSyncTimestamp: number;
		created: SyncApiRecord[];
		updated: SyncApiRecord[];
		deleted: string[];
		conflicts: Array<{
			id: string;
			winner: SyncApiRecord;
			loser: SyncApiRecord;
		}>;
	};
};

type SyncErrorBody = {
	success: false;
	error: {
		message: string;
		code: string;
		details?: Array<{ path: string; message: string }>;
	};
};

const syncMock = vi.hoisted(() => {
	let records = new Map<string, StoredRecord>();
	let failOnWriteId: string | null = null;

	const cloneRecord = (record: StoredRecord): StoredRecord => ({ ...record });

	const normalizeRecord = (record: StoredRecord): StoredRecord => ({
		...record,
		purchaseUrl: record.purchaseUrl ?? null,
		notes: record.notes ?? null,
		userId: record.userId ?? null,
		sessionId: record.sessionId ?? null,
		deviceId: record.deviceId ?? null,
	});

	const parseCondition = (condition: { queryChunks?: unknown[] }) => {
		const chunks = condition?.queryChunks ?? [];
		const column = chunks.find(
			(chunk): chunk is { name: string } =>
				typeof (chunk as { name?: unknown })?.name === "string",
		);
		const param = chunks.find(
			(chunk): chunk is { value: unknown; encoder: unknown } =>
				typeof chunk === "object" &&
				chunk !== null &&
				"value" in chunk &&
				"encoder" in chunk,
		);
		const expression = chunks
			.flatMap((chunk) =>
				Array.isArray((chunk as { value?: unknown })?.value)
					? ((chunk as { value: string[] }).value ?? [])
					: [],
			)
			.join("");

		if (!column || !param) {
			throw new Error("Unsupported Drizzle condition in sync test mock.");
		}

		return {
			column: column.name,
			value: param.value,
			operator: expression.includes(">")
				? "gt"
				: expression.includes("=")
					? "eq"
					: "unknown",
		};
	};

	const createDb = () => ({
		select: () => ({
			from: () => ({
				where: (condition: { queryChunks?: unknown[] }) => {
					const parsed = parseCondition(condition);

					return {
						get: async () => {
							if (parsed.column !== "id" || parsed.operator !== "eq") {
								throw new Error(
									`Unsupported sync lookup condition: ${parsed.column} ${parsed.operator}`,
								);
							}

							const record = records.get(String(parsed.value));
							return record ? cloneRecord(record) : undefined;
						},
						all: async () => {
							if (parsed.column !== "updated_at" || parsed.operator !== "gt") {
								throw new Error(
									`Unsupported sync delta condition: ${parsed.column} ${parsed.operator}`,
								);
							}

							return Array.from(records.values())
								.filter((record) => record.updatedAt > Number(parsed.value))
								.map(cloneRecord);
						},
					};
				},
			}),
		}),
		insert: () => ({
			values: (value: StoredRecord) => ({
				onConflictDoUpdate: ({ set }: { set: StoredRecord }) => ({
					run: async () => {
						if (value.id === failOnWriteId) {
							throw new Error("Simulated batch write failure");
						}

						const existing = records.get(value.id);
						const next = existing ? { ...existing, ...set } : value;
						records.set(value.id, normalizeRecord(next));
						return { success: true };
					},
				}),
			}),
		}),
		batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
			const snapshot = new Map(
				Array.from(records.entries()).map(([id, record]) => [
					id,
					cloneRecord(record),
				]),
			);

			try {
				const results: unknown[] = [];
				for (const statement of statements) {
					results.push(await statement.run());
				}
				return results;
			} catch (error) {
				records = snapshot;
				throw error;
			}
		},
	});

	return {
		createDb: vi.fn(createDb),
		createD1Database: () => ({}) as D1Database,
		clear() {
			records = new Map();
			failOnWriteId = null;
		},
		seed(nextRecords: StoredRecord[]) {
			records = new Map(
				nextRecords.map((record) => [record.id, normalizeRecord(record)]),
			);
		},
		getRecord(id: string) {
			const record = records.get(id);
			return record ? cloneRecord(record) : undefined;
		},
		setFailOnWriteId(id: string | null) {
			failOnWriteId = id;
		},
	};
});

vi.mock("../src/db/client.js", () => ({
	createDb: syncMock.createDb,
}));

import app from "../src/index";

const makeRecord = (overrides: Partial<SyncApiRecord> = {}): SyncApiRecord => ({
	id: "9e7f6e22-72f8-4ef8-baca-852b7ed8a101",
	createdAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_000,
	deletedAt: null,
	manufacturer: "Team Associated",
	partNumber: "ASC91322",
	purchaseUrl: "https://example.com/spring",
	notes: "Front spring",
	units: "mm",
	d: 1.2,
	D: 10.5,
	n: 6,
	Davg: 9.3,
	k: 0.0000537,
	...overrides,
});

const toStoredRecord = (
	record: SyncApiRecord,
	syncVersion = 1,
): StoredRecord => ({
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

const syncRequest = async (body: unknown): Promise<Response> =>
	app.fetch(
		new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		{ DB: syncMock.createD1Database() },
	);

describe("POST /api/v1/sync", () => {
	beforeEach(() => {
		syncMock.clear();
		syncMock.createDb.mockClear();
	});

	it("returns the standard success envelope for an empty sync", async () => {
		const response = await syncRequest({
			changes: [],
			lastSyncTimestamp: null,
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as SyncSuccessBody;
		expect(body.success).toBe(true);
		expect(body.data.created).toEqual([]);
		expect(body.data.updated).toEqual([]);
		expect(body.data.deleted).toEqual([]);
		expect(body.data.conflicts).toEqual([]);
		expect(body.data.newSyncTimestamp).toBeGreaterThan(0);
	});

	it("validates the sync payload with zod", async () => {
		const response = await syncRequest({
			changes: [{ type: "delete", id: 42 }],
			lastSyncTimestamp: "later",
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as SyncErrorBody;
		expect(body.success).toBe(false);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "changes.0.id" }),
				expect.objectContaining({ path: "changes.0.deletedAt" }),
				expect.objectContaining({ path: "lastSyncTimestamp" }),
			]),
		);
	});

	it("rejects clear operations at validation", async () => {
		const response = await syncRequest({
			changes: [{ type: "clear" }],
			lastSyncTimestamp: null,
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as SyncErrorBody;
		expect(body.success).toBe(false);
		expect(body.error.code).toBe("VALIDATION_ERROR");
	});

	it("syncs a new client record to the server", async () => {
		const record = makeRecord({
			id: "11111111-1111-4111-8111-111111111111",
		});

		const response = await syncRequest({
			changes: [{ type: "add", record }],
			lastSyncTimestamp: null,
		});

		expect(response.status).toBe(200);
		expect(syncMock.getRecord(record.id)).toEqual(toStoredRecord(record));

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.created).toEqual([record]);
		expect(body.data.conflicts).toEqual([]);
	});

	it("does not rewrite server-winning conflicts", async () => {
		const serverRecord = makeRecord({
			createdAt: 500,
			updatedAt: 2_000,
			manufacturer: "Server winner",
		});
		syncMock.seed([toStoredRecord(serverRecord, 3)]);

		const clientRecord = makeRecord({
			createdAt: 500,
			updatedAt: 1_000,
			manufacturer: "Client loser",
		});

		const response = await syncRequest({
			changes: [{ type: "add", record: clientRecord }],
			lastSyncTimestamp: 750,
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(serverRecord.id);
		expect(stored?.manufacturer).toBe("Server winner");
		expect(stored?.syncVersion).toBe(3);

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.conflicts).toHaveLength(1);
		expect(body.data.conflicts[0]?.winner.manufacturer).toBe("Server winner");
		expect(body.data.updated).toEqual([serverRecord]);
	});

	it("applies client-winning conflicts", async () => {
		const serverRecord = makeRecord({
			createdAt: 500,
			updatedAt: 1_000,
			manufacturer: "Server loser",
		});
		syncMock.seed([toStoredRecord(serverRecord, 3)]);

		const clientRecord = makeRecord({
			createdAt: 500,
			updatedAt: 2_000,
			manufacturer: "Client winner",
		});

		const response = await syncRequest({
			changes: [{ type: "add", record: clientRecord }],
			lastSyncTimestamp: 750,
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(clientRecord.id);
		expect(stored?.manufacturer).toBe("Client winner");
		expect(stored?.syncVersion).toBe(4);

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.conflicts).toHaveLength(1);
		expect(body.data.conflicts[0]?.winner.manufacturer).toBe("Client winner");
		expect(body.data.updated).toEqual([clientRecord]);
	});

	it("lets a newer client delete win", async () => {
		const record = makeRecord({ updatedAt: 1_000 });
		syncMock.seed([toStoredRecord(record, 1)]);

		const response = await syncRequest({
			changes: [{ type: "delete", id: record.id, deletedAt: 2_000 }],
			lastSyncTimestamp: 0,
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(record.id);
		expect(stored?.deletedAt).toBe(2_000);
		expect(stored?.updatedAt).toBe(2_000);
		expect(stored?.syncVersion).toBe(2);

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.deleted).toEqual([record.id]);
		expect(body.data.conflicts[0]?.winner.deletedAt).toBe(2_000);
	});

	it("applies bulk deletes with the client deletion timestamp", async () => {
		const firstRecord = makeRecord({
			id: "11111111-1111-4111-8111-111111111111",
			createdAt: 500,
			updatedAt: 1_000,
		});
		const secondRecord = makeRecord({
			id: "22222222-2222-4222-8222-222222222222",
			createdAt: 500,
			updatedAt: 1_000,
		});
		syncMock.seed([toStoredRecord(firstRecord), toStoredRecord(secondRecord)]);

		const response = await syncRequest({
			changes: [
				{
					type: "bulkDelete",
					ids: [firstRecord.id, secondRecord.id],
					deletedAt: 2_000,
				},
			],
			lastSyncTimestamp: 750,
		});

		expect(response.status).toBe(200);
		expect(syncMock.getRecord(firstRecord.id)?.deletedAt).toBe(2_000);
		expect(syncMock.getRecord(secondRecord.id)?.deletedAt).toBe(2_000);

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.deleted).toEqual([firstRecord.id, secondRecord.id]);
	});

	it("does not let a stale client delete erase a newer server record", async () => {
		const record = makeRecord({ createdAt: 500, updatedAt: 2_000 });
		syncMock.seed([toStoredRecord(record, 5)]);

		const response = await syncRequest({
			changes: [{ type: "delete", id: record.id, deletedAt: 1_000 }],
			lastSyncTimestamp: 750,
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(record.id);
		expect(stored?.deletedAt).toBeNull();
		expect(stored?.updatedAt).toBe(2_000);
		expect(stored?.syncVersion).toBe(5);

		const body = (await response.json()) as SyncSuccessBody;
		expect(body.data.conflicts).toHaveLength(1);
		expect(body.data.conflicts[0]?.winner.deletedAt).toBeNull();
		expect(body.data.updated).toEqual([record]);
	});

	it("keeps repeated deletes idempotent", async () => {
		const record = makeRecord({
			updatedAt: 2_000,
			deletedAt: 2_000,
		});
		syncMock.seed([toStoredRecord(record, 2)]);

		const response = await syncRequest({
			changes: [{ type: "delete", id: record.id, deletedAt: 3_000 }],
			lastSyncTimestamp: 0,
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(record.id);
		expect(stored?.deletedAt).toBe(2_000);
		expect(stored?.updatedAt).toBe(2_000);
		expect(stored?.syncVersion).toBe(2);
	});

	it("rolls back the entire batch when one write fails", async () => {
		const okRecord = makeRecord({
			id: "11111111-1111-4111-8111-111111111111",
		});
		const failingRecord = makeRecord({
			id: "22222222-2222-4222-8222-222222222222",
			partNumber: "FAIL-1",
		});
		syncMock.setFailOnWriteId(failingRecord.id);

		const response = await syncRequest({
			changes: [
				{ type: "add", record: okRecord },
				{ type: "add", record: failingRecord },
			],
			lastSyncTimestamp: null,
		});

		expect(response.status).toBe(500);
		expect(syncMock.getRecord(okRecord.id)).toBeUndefined();
		expect(syncMock.getRecord(failingRecord.id)).toBeUndefined();

		const body = (await response.json()) as SyncErrorBody;
		expect(body.success).toBe(false);
		expect(body.error.code).toBe("INTERNAL_ERROR");
		expect(body.error.message).toBe("Internal server error");
	});
});
