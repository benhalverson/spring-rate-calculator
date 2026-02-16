import type { Units, ValidationResult } from "../../types/spring";

/**
 * Browser install prompt event used by Chromium-based PWA install flow.
 */
export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Sorting state for the saved calculations table `k` column.
 */
export type KSortDirection = "none" | "asc" | "desc";

/**
 * Sorting state for the saved calculations table by creation date.
 */
export type DateSortDirection = "none" | "newest" | "oldest";

/**
 * Raw form input values managed as strings for input UX.
 */
export interface CalculatorInputs {
	dInput: string;
	DInput: string;
	nInput: string;
	manufacturerInput: string;
	partNumberInput: string;
	purchaseUrlInput: string;
	notesInput: string;
}

/**
 * Empty validation object used before all required values are parseable.
 */
export const EMPTY_VALIDATION: ValidationResult = {
	ok: false,
	errors: {},
	warnings: {},
};

/**
 * Parses user text input into a finite number.
 * Returns `undefined` for blank or invalid numeric strings.
 */
export const parseNumber = (value: string): number | undefined => {
	if (!value.trim()) {
		return undefined;
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return parsed;
};

/**
 * Formats spring rate values for display, with placeholder for missing values.
 */
export const formatK = (value: number | undefined): string => {
	if (value === undefined || !Number.isFinite(value)) {
		return "—";
	}
	return value.toLocaleString(undefined, {
		maximumSignificantDigits: 6,
	});
};

/**
 * Formats numeric geometry values for display in form/results tables.
 */
export const formatValue = (value: number): string => {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: 4,
	});
};

/**
 * Returns the spring-rate output unit label for the selected geometry units.
 */
export const getRateUnitsLabel = (units: Units): string => {
	return units === "mm" ? "N/mm" : "lbf/in";
};

/**
 * Formats the shear modulus assumption value used in the physical formula.
 */
export const formatShearModulus = (value: number): string => {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: 0,
	});
};

/**
 * Cycles the `k` sort direction through none -> asc -> desc -> none.
 */
export const toggleKSortDirection = (
	current: KSortDirection,
): KSortDirection => {
	if (current === "none") {
		return "asc";
	}
	if (current === "asc") {
		return "desc";
	}
	return "none";
};

/**
 * Produces a user-facing label for the current `k` sort direction.
 */
export const getKSortLabel = (direction: KSortDirection): string => {
	if (direction === "none") {
		return "Sort k";
	}
	if (direction === "asc") {
		return "Sort k ↑";
	}
	return "Sort k ↓";
};

/**
 * Cycles the date sort direction through none -> newest -> oldest -> none.
 */
export const toggleDateSortDirection = (
	current: DateSortDirection,
): DateSortDirection => {
	if (current === "none") {
		return "newest";
	}
	if (current === "newest") {
		return "oldest";
	}
	return "none";
};

/**
 * Produces a user-facing label for the current date sort direction.
 */
export const getDateSortLabel = (direction: DateSortDirection): string => {
	if (direction === "none") {
		return "Sort date";
	}
	if (direction === "newest") {
		return "Sort date ↓";
	}
	return "Sort date ↑";
};
