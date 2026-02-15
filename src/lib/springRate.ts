import type { ValidationResult } from "../types/spring";

/**
 * Computes the mean spring diameter from outer diameter and wire diameter.
 *
 * Formula: `Davg = D - d`
 *
 * @param D - Spring outer diameter.
 * @param d - Wire diameter.
 * @returns The derived mean diameter `Davg`.
 */
export const computeDavg = (D: number, d: number): number => D - d;

/**
 * Computes spring rate `k` using the provided unit-consistent formula.
 *
 * Formula: `k = d^4 / (8 * n * Davg^3)`
 *
 * @param d - Wire diameter.
 * @param n - Number of active coils.
 * @param Davg - Mean spring diameter, typically `D - d`.
 * @returns The calculated spring rate `k`.
 */
export const computeK = (d: number, n: number, Davg: number): number => {
	return d ** 4 / (8 * n * Davg ** 3);
};

/**
 * Validates calculator inputs against business rules and returns
 * blocking errors plus non-blocking warnings.
 *
 * Blocking conditions:
 * - `d <= 1`
 * - `D <= 0`
 * - `n <= 0`
 * - `Davg = D - d <= 0`
 *
 * Non-blocking warning:
 * - `n` is not an integer.
 *
 * @param d - Wire diameter.
 * @param D - Spring outer diameter.
 * @param n - Number of active coils.
 * @returns Validation object containing `ok`, `errors`, and `warnings`.
 */
export const validateInputs = (
	d: number,
	D: number,
	n: number,
): ValidationResult => {
	const errors: Record<string, string> = {};
	const warnings: Record<string, string> = {};

	if (!Number.isFinite(d)) {
		errors.d = "Wire diameter d must be a valid number.";
	} else if (d <= 1) {
		errors.d = "Wire diameter d must be greater than 1.";
	}

	if (!Number.isFinite(D)) {
		errors.D = "Coil OD D must be a valid number.";
	} else if (D <= 0) {
		errors.D = "Coil OD D must be greater than 0.";
	}

	if (!Number.isFinite(n)) {
		errors.n = "Active coils n must be a valid number.";
	} else if (n <= 0) {
		errors.n = "Active coils n must be greater than 0.";
	} else if (!Number.isInteger(n)) {
		warnings.n = "Active coils is typically an integer.";
	}

	if (Number.isFinite(D) && Number.isFinite(d) && computeDavg(D, d) <= 0) {
		errors.Davg = "D must be greater than d.";
	}

	return {
		ok: Object.keys(errors).length === 0,
		errors,
		warnings,
	};
};
