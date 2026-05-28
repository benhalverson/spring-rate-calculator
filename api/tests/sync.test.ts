import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredRecord = {
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

const syncMock = vi.hoisted(() => {
	let records = new Map<string, StoredRecord>();
	let failOnWriteId: string | null = null;

	const cloneRecord = (record: StoredRecord): StoredRecord => ({ ...record });

	const createResult = <T>(results: T[] = []): D1Result<T> => ({
		results,
		success: true,
		meta: {
			duration: 0,
			size_after: 0,
			rows_read: 0,
			rows_written: 0,
			last_row_id: 0,
			changed_db: false,
			changes: 0,
		},
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
		const sqlText = chunks
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
			operator: sqlText.includes(">")
				? "gt"
				: sqlText.includes("=")
					? "eq"
					: "unknown",
		};
	};

	const createQueryDb = () => ({
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
	});

	const createD1Database = (): D1Database => ({
		prepare: (query: string) => {
			let bindings: unknown[] = [];

			const statement: D1PreparedStatement = {
				bind: (...values: unknown[]) => {
					bindings = values;
					return statement;
				},
				first: async <T = unknown>() => null as T | null,
				all: async <T = unknown>() => createResult<T>(),
				raw: async () => [[] as string[]] as [string[], ...unknown[]],
				run: async () => {
					if (query.includes("INSERT INTO calculations")) {
						const [
							id,
							createdAt,
							updatedAt,
							deletedAt,
							userId,
							sessionId,
							manufacturer,
							partNumber,
							purchaseUrl,
							notes,
							units,
							wireDiameter,
							outerDiameter,
							activeCoils,
							averageDiameter,
							springRate,
							deviceId,
						] = bindings;

						if (id === failOnWriteId) {
							throw new Error("Simulated batch write failure");
						}

						const existing = records.get(String(id));
						records.set(String(id), {
							id: String(id),
							createdAt: Number(createdAt),
							updatedAt: Number(updatedAt),
							deletedAt: deletedAt === null ? null : Number(deletedAt),
							manufacturer: String(manufacturer),
							partNumber: String(partNumber),
							purchaseUrl: typeof purchaseUrl === "string" ? purchaseUrl : null,
							notes: typeof notes === "string" ? notes : null,
							units: units as "mm" | "in",
							wireDiameter: Number(wireDiameter),
							outerDiameter: Number(outerDiameter),
							activeCoils: Number(activeCoils),
							averageDiameter: Number(averageDiameter),
							springRate: Number(springRate),
							syncVersion: existing ? existing.syncVersion + 1 : 1,
							userId: typeof userId === "string" ? userId : null,
							sessionId: typeof sessionId === "string" ? sessionId : null,
							deviceId: typeof deviceId === "string" ? deviceId : null,
						});

						return createResult();
					}

					if (query.includes("UPDATE calculations")) {
						const [deletedAt, updatedAt, id] = bindings;
						const existing = records.get(String(id));

						if (existing && existing.deletedAt === null) {
							records.set(String(id), {
								...existing,
								deletedAt: Number(deletedAt),
								updatedAt: Number(updatedAt),
								syncVersion: existing.syncVersion + 1,
							});
						}

						return createResult();
					}

					throw new Error(`Unexpected D1 statement in sync test: ${query}`);
				},
			};

			return statement;
		},
		batch: async <T = unknown>(statements: D1PreparedStatement[]) => {
			const snapshot = new Map(
				Array.from(records.entries()).map(([id, record]) => [
					id,
					cloneRecord(record),
				]),
			);

			try {
				const results: D1Result<T>[] = [];
				for (const statement of statements) {
					results.push((await statement.run()) as D1Result<T>);
				}
				return results;
			} catch (error) {
				records = snapshot;
				throw error;
			}
		},
		exec: async () => ({ count: 0, duration: 0 }),
		dump: async () => new ArrayBuffer(0),
		withSession: () => createD1Database() as unknown as D1DatabaseSession,
	});

	return {
		createDb: vi.fn(() => createQueryDb()),
		clear() {
			records = new Map();
			failOnWriteId = null;
		},
		seed(nextRecords: StoredRecord[]) {
			records = new Map(
				nextRecords.map((record) => [record.id, cloneRecord(record)]),
			);
		},
		getRecord(id: string) {
			const record = records.get(id);
			return record ? cloneRecord(record) : undefined;
		},
		setFailOnWriteId(id: string | null) {
			failOnWriteId = id;
		},
		createD1Database,
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
	userId: null,
	sessionId: null,
	deviceId: null,
});

describe("POST /api/v1/sync", () => {
	beforeEach(() => {
		syncMock.clear();
		syncMock.createDb.mockClear();
	});

	it("returns the standard success envelope for an empty sync", async () => {
		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				changes: [],
				lastSyncTimestamp: null,
			}),
		});

		const response = await app.fetch(request, {
			DB: syncMock.createD1Database(),
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			success: true;
			data: {
				newSyncTimestamp: number;
				created: SyncApiRecord[];
				updated: SyncApiRecord[];
				deleted: string[];
				conflicts: Array<{ id: string }>;
			};
		};

		expect(body.success).toBe(true);
		expect(body.data.created).toEqual([]);
		expect(body.data.updated).toEqual([]);
		expect(body.data.deleted).toEqual([]);
		expect(body.data.conflicts).toEqual([]);
		expect(body.data.newSyncTimestamp).toBeGreaterThan(0);
	});

	it("validates the sync payload with zod", async () => {
		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				changes: [{ type: "delete", id: 42 }],
				lastSyncTimestamp: "later",
			}),
		});

		const response = await app.fetch(request, {
			DB: syncMock.createD1Database(),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			success: false;
			error: {
				message: string;
				code: string;
				details: Array<{ path: string; message: string }>;
			};
		};

		expect(body.success).toBe(false);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Validation failed");
		expect(body.error.details).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "changes.0.id" }),
				expect.objectContaining({ path: "lastSyncTimestamp" }),
			]),
		);
	});

	it("returns the standard API error shape for unsupported clear operations", async () => {
		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				changes: [{ type: "clear" }],
				lastSyncTimestamp: null,
			}),
		});

		const response = await app.fetch(request, {
			DB: syncMock.createD1Database(),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			success: false;
			error: { message: string; code: string };
		};

		expect(body.success).toBe(false);
		expect(body.error.code).toBe("UNSUPPORTED_OPERATION");
		expect(body.error.message).toContain("Clear operation not yet supported");
	});

	it("does not rewrite server-winning conflicts", async () => {
		const serverRecord = makeRecord({
			updatedAt: 2_000,
			manufacturer: "Server winner",
		});
		syncMock.seed([toStoredRecord(serverRecord, 3)]);

		const clientRecord = makeRecord({
			updatedAt: 1_000,
			manufacturer: "Client loser",
		});

		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				changes: [{ type: "add", record: clientRecord }],
				lastSyncTimestamp: 0,
			}),
		});

		const response = await app.fetch(request, {
			DB: syncMock.createD1Database(),
		});

		expect(response.status).toBe(200);
		const stored = syncMock.getRecord(serverRecord.id);
		expect(stored?.manufacturer).toBe("Server winner");
		expect(stored?.syncVersion).toBe(3);

		const body = (await response.json()) as {
			success: true;
			data: { conflicts: Array<{ id: string }> };
		};
		expect(body.data.conflicts).toHaveLength(1);
		expect(body.data.conflicts[0]?.id).toBe(serverRecord.id);
	});

	it("keeps repeated deletes idempotent", async () => {
		const record = makeRecord();
		syncMock.seed([toStoredRecord(record, 1)]);

		const makeDeleteRequest = () =>
			new Request("http://localhost/api/v1/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					changes: [{ type: "delete", id: record.id }],
					lastSyncTimestamp: 0,
				}),
			});

		const firstResponse = await app.fetch(makeDeleteRequest(), {
			DB: syncMock.createD1Database(),
		});
		expect(firstResponse.status).toBe(200);

		const firstDelete = syncMock.getRecord(record.id);
		expect(firstDelete?.deletedAt).not.toBeNull();
		expect(firstDelete?.syncVersion).toBe(2);

		const secondResponse = await app.fetch(makeDeleteRequest(), {
			DB: syncMock.createD1Database(),
		});
		expect(secondResponse.status).toBe(200);

		const secondDelete = syncMock.getRecord(record.id);
		expect(secondDelete?.deletedAt).toBe(firstDelete?.deletedAt);
		expect(secondDelete?.syncVersion).toBe(2);
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

		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				changes: [
					{ type: "add", record: okRecord },
					{ type: "add", record: failingRecord },
				],
				lastSyncTimestamp: null,
			}),
		});

		const response = await app.fetch(request, {
			DB: syncMock.createD1Database(),
		});

		expect(response.status).toBe(500);
		expect(syncMock.getRecord(okRecord.id)).toBeUndefined();
		expect(syncMock.getRecord(failingRecord.id)).toBeUndefined();

		const body = (await response.json()) as {
			success: false;
			error: { code: string; message: string };
		};
		expect(body.success).toBe(false);
		expect(body.error.code).toBe("INTERNAL_ERROR");
		expect(body.error.message).toBe("Internal server error");
	});
});
