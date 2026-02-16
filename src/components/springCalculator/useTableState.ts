import { useCallback, useMemo, useState } from "react";
import type { SpringCalcRecord } from "../../types/spring";
import { type KSortDirection, toggleKSortDirection } from "./utils";

/**
 * Consolidated state management for the saved calculations table.
 * Manages selection, sorting, filtering, and confirmation states.
 */
export function useTableState(records: SpringCalcRecord[]) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [kSortDirection, setKSortDirection] = useState<KSortDirection>("none");
	const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);

	// Memoized sorted records for performance
	const sortedRecords = useMemo(() => {
		if (kSortDirection === "none") {
			return records;
		}

		return [...records].sort((a, b) => {
			return kSortDirection === "asc" ? a.k - b.k : b.k - a.k;
		});
	}, [records, kSortDirection]);

	// Toggle sorting direction
	const toggleSort = useCallback(() => {
		setKSortDirection((current) => toggleKSortDirection(current));
	}, []);

	// Toggle individual row selection
	const toggleSelection = useCallback((id: string) => {
		setSelectedIds((previous) => {
			const next = new Set(previous);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	// Toggle select all rows
	const toggleSelectAll = useCallback(() => {
		setSelectedIds((previous) => {
			if (previous.size === sortedRecords.length) {
				return new Set();
			}
			return new Set(sortedRecords.map((record) => record.id));
		});
	}, [sortedRecords]);

	// Clear all selections
	const clearSelection = useCallback(() => {
		setSelectedIds(new Set());
	}, []);

	// Initiate bulk delete confirmation
	const startBulkDelete = useCallback(() => {
		setIsConfirmingBulkDelete(true);
	}, []);

	// Cancel bulk delete confirmation
	const cancelBulkDelete = useCallback(() => {
		setIsConfirmingBulkDelete(false);
	}, []);

	// Remove deleted IDs from selection
	const removeFromSelection = useCallback((id: string) => {
		setSelectedIds((previous) => {
			const next = new Set(previous);
			next.delete(id);
			return next;
		});
	}, []);

	// Clear selection after bulk delete completes
	const completeBulkDelete = useCallback(() => {
		setSelectedIds(new Set());
		setIsConfirmingBulkDelete(false);
	}, []);

	return {
		// State
		selectedIds,
		kSortDirection,
		isConfirmingBulkDelete,
		sortedRecords,

		// Actions
		toggleSort,
		toggleSelection,
		toggleSelectAll,
		clearSelection,
		startBulkDelete,
		cancelBulkDelete,
		removeFromSelection,
		completeBulkDelete,
	};
}
