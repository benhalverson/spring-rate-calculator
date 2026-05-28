import Dexie, { type EntityTable } from "dexie";
import { beforeEach, describe, expect, it } from "vitest";

import type { SpringCalcRecord } from "../types/spring";
import {
	addCalculation,
	bulkDeleteCalculations,
	clearCalculations,
	deleteCalculation,
	listCalculations,
} from "./db";
import type { SyncOperation } from "./storageAdapter";

const baseRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: "id-1",
	createdAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_000,
	deletedAt: null,
	manufacturer: "Team Associated",
	partNumber: "ASC91322",
	purchaseUrl: "https://example.com/spring",
	notes: "Front shock spring",
	units: "mm",
	d: 1.2,
	D: 10.5,
	n: 6,
	Davg: 9.3,
	k: 0.0000537,
	...overrides,
});

class TestSpringRateDatabase extends Dexie {
	calculations!: EntityTable<SpringCalcRecord, "id">;
	syncQueue!: EntityTable<{ id?: number; operation: SyncOperation }, "id">;
	syncMeta!: EntityTable<{ key: "lastSyncedAt"; value: number }, "key">;

	constructor() {
		super("spring-rate-db");
		this.version(4).stores({
			calculations:
				"id, createdAt, updatedAt, deletedAt, manufacturer, partNumber, [manufacturer+partNumber]",
			syncQueue: "++id",
			syncMeta: "key",
		});
	}
}

const readAllStoredRecords = async (): Promise<SpringCalcRecord[]> => {
	const db = new TestSpringRateDatabase();
	try {
		return await db.calculations.orderBy("createdAt").reverse().toArray();
	} finally {
		db.close();
	}
};

const resetStoredRecords = async (): Promise<void> => {
	const db = new TestSpringRateDatabase();
	try {
		await db.calculations.clear();
	} finally {
		db.close();
	}
};

describe("db", () => {
	beforeEach(async () => {
		await resetStoredRecords();
	});

	it("adds and lists calculations sorted by createdAt desc", async () => {
		await addCalculation(
			baseRecord({
				id: "older",
				createdAt: 100,
			}),
		);
		await addCalculation(
			baseRecord({
				id: "newer",
				createdAt: 200,
			}),
		);

		const records = await listCalculations();

		expect(records).toHaveLength(2);
		expect(records[0]?.id).toBe("newer");
		expect(records[1]?.id).toBe("older");
	});

	it("deletes a calculation by id", async () => {
		await addCalculation(baseRecord({ id: "keep" }));
		await addCalculation(baseRecord({ id: "remove", createdAt: 101 }));

		await deleteCalculation("remove");

		const records = await listCalculations();
		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe("keep");

		const storedRecords = await readAllStoredRecords();
		expect(storedRecords).toHaveLength(2);
		const removedRecord = storedRecords.find(
			(record) => record.id === "remove",
		);
		expect(removedRecord?.deletedAt).not.toBeNull();
		expect(removedRecord?.updatedAt).toBe(removedRecord?.deletedAt);
	});

	it("clears all calculations", async () => {
		await addCalculation(baseRecord({ id: "a" }));
		await addCalculation(baseRecord({ id: "b", createdAt: 500 }));

		await clearCalculations();

		await expect(listCalculations()).resolves.toEqual([]);

		const storedRecords = await readAllStoredRecords();
		expect(storedRecords).toHaveLength(2);
		expect(storedRecords.every((record) => record.deletedAt !== null)).toBe(
			true,
		);
	});

	it("bulkDeleteCalculations does nothing with empty array", async () => {
		await addCalculation(baseRecord({ id: "keep-1" }));
		await addCalculation(baseRecord({ id: "keep-2", createdAt: 101 }));

		await bulkDeleteCalculations([]);

		const records = await listCalculations();
		expect(records).toHaveLength(2);
		expect(records.map((r) => r.id)).toContain("keep-1");
		expect(records.map((r) => r.id)).toContain("keep-2");
	});

	it("bulkDeleteCalculations deletes subset of records", async () => {
		await addCalculation(baseRecord({ id: "keep" }));
		await addCalculation(baseRecord({ id: "remove-1", createdAt: 101 }));
		await addCalculation(baseRecord({ id: "remove-2", createdAt: 102 }));

		await bulkDeleteCalculations(["remove-1", "remove-2"]);

		const records = await listCalculations();
		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe("keep");

		const storedRecords = await readAllStoredRecords();
		expect(storedRecords).toHaveLength(3);
		expect(
			storedRecords
				.filter((record) => record.deletedAt !== null)
				.map((record) => record.id),
		).toEqual(["remove-2", "remove-1"]);
	});

	it("bulkDeleteCalculations preserves non-selected records", async () => {
		await addCalculation(baseRecord({ id: "keep-1" }));
		await addCalculation(baseRecord({ id: "remove", createdAt: 101 }));
		await addCalculation(baseRecord({ id: "keep-2", createdAt: 102 }));
		await addCalculation(baseRecord({ id: "keep-3", createdAt: 103 }));

		await bulkDeleteCalculations(["remove"]);

		const records = await listCalculations();
		expect(records).toHaveLength(3);
		const ids = records.map((r) => r.id);
		expect(ids).toContain("keep-1");
		expect(ids).toContain("keep-2");
		expect(ids).toContain("keep-3");
		expect(ids).not.toContain("remove");
	});
});
