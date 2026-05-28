import Dexie, { type EntityTable } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpringCalcRecord } from "../types/spring";
import { HybridBackend, IndexedDBBackend } from "./storageAdapter";

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

const apiMock = vi.hoisted(() => {
	let records = new Map<string, StoredRecord>();

	const cloneRecord = (record: StoredRecord): StoredRecord => ({ ...record });

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
			throw new Error(
				"Unsupported Drizzle condition in sync integration mock.",
			);
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
								throw new Error("Unsupported sync lookup condition.");
							}

							const record = records.get(String(parsed.value));
							return record ? cloneRecord(record) : undefined;
						},
						all: async () => {
							if (parsed.column !== "updated_at" || parsed.operator !== "gt") {
								throw new Error("Unsupported sync delta condition.");
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
				onConflictDoUpdate: ({ set }: { set: Partial<StoredRecord> }) => ({
					run: async () => {
						const existing = records.get(value.id);
						records.set(value.id, existing ? { ...existing, ...set } : value);
						return { success: true };
					},
				}),
			}),
		}),
		batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
			const results: unknown[] = [];
			for (const statement of statements) {
				results.push(await statement.run());
			}
			return results;
		},
	});

	return {
		createDb: vi.fn(createDb),
		createD1Database: () => ({}) as D1Database,
		clear() {
			records = new Map();
		},
		seed(nextRecords: StoredRecord[]) {
			records = new Map(nextRecords.map((record) => [record.id, record]));
		},
		getRecord(id: string) {
			const record = records.get(id);
			return record ? cloneRecord(record) : undefined;
		},
	};
});

vi.mock("../../api/src/db/client.js", () => ({
	createDb: apiMock.createDb,
}));

import app from "../../api/src/index";

class TestSpringRateDatabase extends Dexie {
	calculations!: EntityTable<SpringCalcRecord, "id">;

	constructor() {
		super("spring-rate-sync-integration-db");
		this.version(3).stores({
			calculations:
				"id, createdAt, updatedAt, deletedAt, manufacturer, partNumber, [manufacturer+partNumber]",
		});
	}
}

const baseRecord = (
	overrides: Partial<SpringCalcRecord> = {},
): SpringCalcRecord => ({
	id: "11111111-1111-4111-8111-111111111111",
	createdAt: 1_000,
	updatedAt: 1_000,
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
	record: SpringCalcRecord,
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

const createLocalBackend = (db: TestSpringRateDatabase): IndexedDBBackend => {
	const isActiveRecord = (record: SpringCalcRecord): boolean =>
		record.deletedAt === null;

	const softDeleteRecords = async (
		ids: string[],
		deletedAt = Date.now(),
	): Promise<void> => {
		if (ids.length === 0) {
			return;
		}

		await db.transaction("rw", db.calculations, async () => {
			const records = await db.calculations.bulkGet(ids);
			const tombstones = records
				.filter((record): record is SpringCalcRecord =>
					Boolean(record && isActiveRecord(record)),
				)
				.map((record) => ({
					...record,
					updatedAt: deletedAt,
					deletedAt,
				}));

			if (tombstones.length > 0) {
				await db.calculations.bulkPut(tombstones);
			}
		});
	};

	return new IndexedDBBackend({
		add: async (record) => {
			await db.calculations.put(record);
		},
		list: () =>
			db.calculations
				.orderBy("createdAt")
				.reverse()
				.filter(isActiveRecord)
				.toArray(),
		deleteOne: (id, deletedAt) => softDeleteRecords([id], deletedAt),
		deleteMany: (ids, deletedAt) => softDeleteRecords(ids, deletedAt),
		clear: async (deletedAt) => {
			const records = await db.calculations
				.toCollection()
				.filter(isActiveRecord)
				.toArray();
			await softDeleteRecords(
				records.map((record) => record.id),
				deletedAt,
			);
		},
	});
};

const flushSync = async (backend: HybridBackend): Promise<void> => {
	await backend.triggerBackgroundSync();
};

describe("HybridBackend sync integration", () => {
	let db: TestSpringRateDatabase;
	let onlineSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(async () => {
		apiMock.clear();
		window.localStorage.clear();
		await Dexie.delete("spring-rate-sync-integration-db");
		db = new TestSpringRateDatabase();
		onlineSpy = vi.spyOn(window.navigator, "onLine", "get");
		onlineSpy.mockReturnValue(true);

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = new URL(String(input), "http://localhost");
				const request = new Request(url, init);
				return app.fetch(request, { DB: apiMock.createD1Database() });
			}),
		);
	});

	afterEach(() => {
		db?.close();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("flushes a queued IndexedDB save to the sync API", async () => {
		const localBackend = createLocalBackend(db);
		const backend = new HybridBackend(localBackend, "/api/v1/sync");
		const record = baseRecord();

		await backend.addCalculation(record);
		await flushSync(backend);

		expect(apiMock.getRecord(record.id)).toEqual(toStoredRecord(record));
		expect(window.localStorage.getItem("spring-rate-sync-queue")).toBe("[]");
		expect(
			Number(window.localStorage.getItem("spring-rate-last-synced-at")),
		).toBe(backend.getSyncStatus().lastSyncedAt);
		expect(backend.getSyncStatus().pending).toBe(0);
	});

	it("normalizes stale queued add records before flushing", async () => {
		const record = baseRecord({
			id: "55555555-5555-4555-8555-555555555555",
			createdAt: 1_500,
			updatedAt: 1_500,
			deletedAt: null,
		});
		const { updatedAt, deletedAt, ...staleQueuedRecord } = record;
		void updatedAt;
		void deletedAt;
		window.localStorage.setItem(
			"spring-rate-sync-queue",
			JSON.stringify([{ type: "add", record: staleQueuedRecord }]),
		);

		const localBackend = createLocalBackend(db);
		const backend = new HybridBackend(localBackend, "/api/v1/sync");
		await flushSync(backend);

		expect(apiMock.getRecord(record.id)).toEqual(toStoredRecord(record));
		expect(window.localStorage.getItem("spring-rate-sync-queue")).toBe("[]");
	});

	it("hydrates IndexedDB from a pull-only startup sync", async () => {
		const record = baseRecord({
			id: "22222222-2222-4222-8222-222222222222",
		});
		apiMock.seed([toStoredRecord(record)]);

		const localBackend = createLocalBackend(db);
		const backend = new HybridBackend(localBackend, "/api/v1/sync");
		await flushSync(backend);

		await expect(backend.listCalculations()).resolves.toEqual([record]);
		expect(backend.getSyncStatus().lastSyncedAt).toBeGreaterThan(0);
	});

	it("keeps offline changes queued and flushes them when online", async () => {
		onlineSpy.mockReturnValue(false);
		const localBackend = createLocalBackend(db);
		const backend = new HybridBackend(localBackend, "/api/v1/sync");
		const record = baseRecord({
			id: "33333333-3333-4333-8333-333333333333",
		});

		await backend.addCalculation(record);
		await backend.triggerBackgroundSync();
		expect(apiMock.getRecord(record.id)).toBeUndefined();
		expect(backend.getSyncStatus().state).toBe("queued");

		onlineSpy.mockReturnValue(true);
		window.dispatchEvent(new Event("online"));
		await flushSync(backend);

		expect(apiMock.getRecord(record.id)).toEqual(toStoredRecord(record));
		expect(backend.getSyncStatus().state).toBe("idle");
	});

	it("soft-deletes local IndexedDB rows from server delete deltas", async () => {
		const record = baseRecord({
			id: "44444444-4444-4444-8444-444444444444",
			createdAt: 1_000,
			updatedAt: 1_000,
		});
		const deletedRecord = {
			...record,
			updatedAt: 2_000,
			deletedAt: 2_000,
		};
		apiMock.seed([toStoredRecord(deletedRecord, 2)]);
		window.localStorage.setItem("spring-rate-last-synced-at", "1500");

		const localBackend = createLocalBackend(db);
		await localBackend.addCalculation(record);
		const backend = new HybridBackend(localBackend, "/api/v1/sync");

		await flushSync(backend);

		await expect(backend.listCalculations()).resolves.toEqual([]);
		const storedRows = await db.calculations.toArray();
		expect(storedRows).toHaveLength(1);
		expect(storedRows[0]?.deletedAt).not.toBeNull();
	});
});
