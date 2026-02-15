import { beforeEach, describe, expect, it } from "vitest";

import type { SpringCalcRecord } from "../types/spring";
import {
	addCalculation,
	clearCalculations,
	deleteCalculation,
	listCalculations,
} from "./db";

const baseRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: "id-1",
	createdAt: 1_700_000_000_000,
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
});
