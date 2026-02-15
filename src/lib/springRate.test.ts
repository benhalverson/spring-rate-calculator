import { describe, expect, it } from "vitest";

import {
	computeDavg,
	computeK,
	computePhysicalK,
	getSpringSteelShearModulus,
	SPRING_STEEL_G_IN,
	SPRING_STEEL_G_MM,
	validateInputs,
} from "./springRate";

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

describe("computePhysicalK", () => {
	it("computes physical spring rate with k = (G * d^4) / (8 * n * Davg^3)", () => {
		const G = SPRING_STEEL_G_MM;
		const d = 1.2;
		const n = 6;
		const Davg = 9.3;
		const expected = (G * d ** 4) / (8 * n * Davg ** 3);

		expect(computePhysicalK(G, d, n, Davg)).toBeCloseTo(expected, 12);
	});
});

describe("getSpringSteelShearModulus", () => {
	it("returns metric spring steel shear modulus for mm", () => {
		expect(getSpringSteelShearModulus("mm")).toBe(SPRING_STEEL_G_MM);
	});

	it("returns imperial spring steel shear modulus for in", () => {
		expect(getSpringSteelShearModulus("in")).toBe(SPRING_STEEL_G_IN);
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
