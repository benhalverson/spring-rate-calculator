import { describe, expect, it } from "vitest";

import { computeDavg, computeK, validateInputs } from "./springRate";

describe("computeDavg", () => {
	it("computes Davg as D - d", () => {
		expect(computeDavg(10.5, 1.2)).toBeCloseTo(9.3);
	});
});

describe("computeK", () => {
	it("computes spring rate with k = d^4 / (8 * n * Davg^3)", () => {
		const d = 1.2;
		const n = 6;
		const Davg = 9.3;
		const expected = d ** 4 / (8 * n * Davg ** 3);

		expect(computeK(d, n, Davg)).toBeCloseTo(expected, 12);
	});
});

describe("validateInputs", () => {
	it("returns ok=true for valid inputs", () => {
		const result = validateInputs(1.2, 10.5, 6);

		expect(result.ok).toBe(true);
		expect(result.errors).toEqual({});
		expect(result.warnings).toEqual({});
	});

	it("blocks d <= 1", () => {
		const result = validateInputs(1, 10.5, 6);

		expect(result.ok).toBe(false);
		expect(result.errors.d).toBe("Wire diameter d must be greater than 1.");
	});

	it("blocks D <= 0", () => {
		const result = validateInputs(1.2, 0, 6);

		expect(result.ok).toBe(false);
		expect(result.errors.D).toBe("Coil OD D must be greater than 0.");
	});

	it("blocks n <= 0", () => {
		const result = validateInputs(1.2, 10.5, 0);

		expect(result.ok).toBe(false);
		expect(result.errors.n).toBe("Active coils n must be greater than 0.");
	});

	it("blocks Davg <= 0 when D <= d", () => {
		const result = validateInputs(2.5, 2.5, 6);

		expect(result.ok).toBe(false);
		expect(result.errors.Davg).toBe("D must be greater than d.");
	});

	it("adds warning when n is not an integer", () => {
		const result = validateInputs(1.2, 10.5, 6.5);

		expect(result.ok).toBe(true);
		expect(result.warnings.n).toBe("Active coils is typically an integer.");
	});
});
