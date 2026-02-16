import type { SpringCalcRecord } from "../../types/spring";
import type { FilterState } from "./FilterControls";

/**
 * Apply all active filters to a list of records.
 * Returns filtered records based on search query and filter constraints.
 */
export function applyFilters(
	records: SpringCalcRecord[],
	filters: FilterState,
): SpringCalcRecord[] {
	return records.filter((record) => {
		// Search filter (case-insensitive, searches manufacturer, part number, notes)
		if (filters.searchQuery) {
			const query = filters.searchQuery.toLowerCase();
			const manufacturer = (record.manufacturer || "").toLowerCase();
			const partNumber = (record.partNumber || "").toLowerCase();
			const notes = (record.notes || "").toLowerCase();

			const matchesSearch =
				manufacturer.includes(query) ||
				partNumber.includes(query) ||
				notes.includes(query);

			if (!matchesSearch) {
				return false;
			}
		}

		// Units filter
		if (filters.unitFilter !== "all" && record.units !== filters.unitFilter) {
			return false;
		}

		// Date range filter
		if (filters.dateFrom) {
			const fromTimestamp = new Date(filters.dateFrom).getTime();
			if (record.createdAt < fromTimestamp) {
				return false;
			}
		}

		if (filters.dateTo) {
			// Add one day to include the entire "to" date
			const toDate = new Date(filters.dateTo);
			toDate.setDate(toDate.getDate() + 1);
			const toTimestamp = toDate.getTime();
			if (record.createdAt >= toTimestamp) {
				return false;
			}
		}

		// k range filter
		if (filters.kMin && record.k < Number.parseFloat(filters.kMin)) {
			return false;
		}
		if (filters.kMax && record.k > Number.parseFloat(filters.kMax)) {
			return false;
		}

		// d range filter
		if (filters.dMin && record.d < Number.parseFloat(filters.dMin)) {
			return false;
		}
		if (filters.dMax && record.d > Number.parseFloat(filters.dMax)) {
			return false;
		}

		// D range filter
		if (filters.DMin && record.D < Number.parseFloat(filters.DMin)) {
			return false;
		}
		if (filters.DMax && record.D > Number.parseFloat(filters.DMax)) {
			return false;
		}

		// n range filter
		if (filters.nMin && record.n < Number.parseFloat(filters.nMin)) {
			return false;
		}
		if (filters.nMax && record.n > Number.parseFloat(filters.nMax)) {
			return false;
		}

		return true;
	});
}

/**
 * Count the number of active filters.
 */
export function countActiveFilters(filters: FilterState): number {
	let count = 0;

	if (filters.searchQuery) count++;
	if (filters.unitFilter !== "all") count++;
	if (filters.dateFrom) count++;
	if (filters.dateTo) count++;
	if (filters.kMin || filters.kMax) count++;
	if (filters.dMin || filters.dMax) count++;
	if (filters.DMin || filters.DMax) count++;
	if (filters.nMin || filters.nMax) count++;

	return count;
}

/**
 * Get initial/empty filter state.
 */
export function getEmptyFilters(): FilterState {
	return {
		searchQuery: "",
		unitFilter: "all",
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
}
