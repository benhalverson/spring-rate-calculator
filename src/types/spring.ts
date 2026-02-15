/**
 * Unit labels used by the calculator UI.
 *
 * These are display-only units and do not trigger automatic conversion.
 */
export type Units = "mm" | "in";

/**
 * Persisted spring calculation record stored in IndexedDB.
 */
export interface SpringCalcRecord {
	/** Unique identifier for the saved record (UUID). */
	id: string;
	/** Creation timestamp in epoch milliseconds. */
	createdAt: number;
	/** Unit label selected when the calculation was saved. */
	units: Units;
	/** Wire diameter (little d). */
	d: number;
	/** Coil outer diameter (big D / OD). */
	D: number;
	/** Number of active coils. */
	n: number;
	/** Derived average diameter: `Davg = D - d`. */
	Davg: number;
	/** Calculated spring rate: `k = d^4 / (8 * n * Davg^3)`. */
	k: number;
}

/**
 * Result shape returned by input validation.
 */
export interface ValidationResult {
	/** True when there are no blocking validation errors. */
	ok: boolean;
	/** Blocking validation messages keyed by field or derived value name. */
	errors: Record<string, string>;
	/** Non-blocking advisory messages keyed by field name. */
	warnings: Record<string, string>;
}
