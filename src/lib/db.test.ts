import { beforeEach, describe, expect, it } from "vitest";

import type { SpringCalcRecord } from "../types/spring";
import {
	addCalculation,
	bulkDeleteCalculations,
	clearCalculations,
	deleteCalculation,
	listCalculations,
} from "./db";

const baseRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: "id-1",
	createdAt: 1_700_000_000_000,
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

describe("db", () => {
	beforeEach(async () => {
		await clearCalculations();
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
	});

	it("clears all calculations", async () => {
		await addCalculation(baseRecord({ id: "a" }));
		await addCalculation(baseRecord({ id: "b", createdAt: 500 }));

		await clearCalculations();

		await expect(listCalculations()).resolves.toEqual([]);
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
