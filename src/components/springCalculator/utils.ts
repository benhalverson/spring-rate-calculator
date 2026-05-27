import type { Units, ValidationResult } from "../../types/spring";

/**
 * Browser install prompt event used by Chromium-based PWA install flow.
 */
export interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Sort options for the saved calculations table.
 */
export type SavedSortOption =
	| "created-desc"
	| "created-asc"
	| "k-asc"
	| "k-desc";

/**
 * Filters used by the saved calculations table.
 */
export interface SavedFilters {
	query: string;
	units: "all" | Units;
	dateFrom: string;
	dateTo: string;
	kMin: string;
	kMax: string;
	dMin: string;
	dMax: string;
	DMin: string;
	DMax: string;
	nMin: string;
	nMax: string;
}

/**
 * Default filter values for saved calculations.
 */
export const EMPTY_SAVED_FILTERS: SavedFilters = {
	query: "",
	units: "all",
	dateFrom: "",
	dateTo: "",
	kMin: "",
	kMax: "",
	dMin: "",
	dMax: "",
	DMin: "",
	DMax: "",
	nMin: "",
	nMax: "",
};

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
 * Returns a user-facing label for the current saved-results sort mode.
 */
export const getSortLabel = (sort: SavedSortOption): string => {
	if (sort === "created-desc") {
		return "Date: newest";
	}
	if (sort === "created-asc") {
		return "Date: oldest";
	}
	if (sort === "k-asc") {
		return "k: low → high";
	}
	return "k: high → low";
};

/**
 * Safely parses optional numeric filter bounds.
 */
export const parseOptionalNumber = (value: string): number | undefined => {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return parsed;
};
