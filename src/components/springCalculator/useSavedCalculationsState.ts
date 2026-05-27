import { useCallback, useMemo, useReducer } from "react";
import type { SpringCalcRecord, Units } from "../../types/spring";
import {
	EMPTY_SAVED_FILTERS,
	parseOptionalNumber,
	type SavedFilters,
	type SavedSortOption,
} from "./utils";

interface SavedCalculationsState {
	history: SpringCalcRecord[];
	selectedIds: Set<string>;
	sortOption: SavedSortOption;
	filters: SavedFilters;
	isConfirmingBulkDelete: boolean;
	isConfirmingClearAll: boolean;
	showComparePanel: boolean;
}

type SavedCalculationsAction =
	| { type: "hydrateHistory"; records: SpringCalcRecord[] }
	| { type: "prependRecord"; record: SpringCalcRecord }
	| { type: "deleteRecord"; id: string }
	| { type: "deleteRecords"; ids: Set<string> }
	| { type: "clearHistory" }
	| { type: "setConfirmingBulkDelete"; value: boolean }
	| { type: "setConfirmingClearAll"; value: boolean }
	| { type: "setSortOption"; sortOption: SavedSortOption }
	| {
			type: "setFilter";
			key: keyof SavedFilters;
			value: string | Units | "all";
	  }
	| { type: "clearFilters" }
	| { type: "toggleSelection"; id: string }
	| { type: "toggleSelectAll"; ids: string[] }
	| { type: "setSelectedIds"; ids: string[] }
	| { type: "clearSelection" }
	| { type: "setShowComparePanel"; value: boolean };

const INITIAL_STATE: SavedCalculationsState = {
	history: [],
	selectedIds: new Set(),
	sortOption: "created-desc",
	filters: EMPTY_SAVED_FILTERS,
	isConfirmingBulkDelete: false,
	isConfirmingClearAll: false,
	showComparePanel: false,
};

const savedCalculationsReducer = (
	state: SavedCalculationsState,
	action: SavedCalculationsAction,
): SavedCalculationsState => {
	switch (action.type) {
		case "hydrateHistory": {
			return {
				...state,
				history: action.records,
			};
		}

		case "prependRecord": {
			return {
				...state,
				history: [action.record, ...state.history],
			};
		}

		case "deleteRecord": {
			const nextSelected = new Set(state.selectedIds);
			nextSelected.delete(action.id);
			return {
				...state,
				history: state.history.filter((record) => record.id !== action.id),
				selectedIds: nextSelected,
			};
		}

		case "deleteRecords": {
			return {
				...state,
				history: state.history.filter((record) => !action.ids.has(record.id)),
				selectedIds: new Set(),
				isConfirmingBulkDelete: false,
				showComparePanel: false,
			};
		}

		case "clearHistory": {
			return {
				...state,
				history: [],
				selectedIds: new Set(),
				isConfirmingBulkDelete: false,
				isConfirmingClearAll: false,
				showComparePanel: false,
			};
		}

		case "setConfirmingBulkDelete": {
			return {
				...state,
				isConfirmingBulkDelete: action.value,
			};
		}

		case "setConfirmingClearAll": {
			return {
				...state,
				isConfirmingClearAll: action.value,
			};
		}

		case "setSortOption": {
			return {
				...state,
				sortOption: action.sortOption,
			};
		}

		case "setFilter": {
			return {
				...state,
				filters: {
					...state.filters,
					[action.key]: String(action.value),
				},
				selectedIds: new Set(),
				isConfirmingBulkDelete: false,
				showComparePanel: false,
			};
		}

		case "clearFilters": {
			return {
				...state,
				filters: EMPTY_SAVED_FILTERS,
				selectedIds: new Set(),
				isConfirmingBulkDelete: false,
				showComparePanel: false,
			};
		}

		case "toggleSelection": {
			const nextSelected = new Set(state.selectedIds);
			if (nextSelected.has(action.id)) {
				nextSelected.delete(action.id);
			} else {
				nextSelected.add(action.id);
			}
			return {
				...state,
				selectedIds: nextSelected,
			};
		}

		case "toggleSelectAll": {
			if (state.selectedIds.size === action.ids.length) {
				return {
					...state,
					selectedIds: new Set(),
				};
			}
			return {
				...state,
				selectedIds: new Set(action.ids),
			};
		}

		case "setSelectedIds": {
			return {
				...state,
				selectedIds: new Set(action.ids),
			};
		}

		case "clearSelection": {
			return {
				...state,
				selectedIds: new Set(),
				showComparePanel: false,
			};
		}

		case "setShowComparePanel": {
			return {
				...state,
				showComparePanel: action.value,
			};
		}

		default:
			return state;
	}
};

/**
 * Consolidates saved-results table state and derived views to keep interactions stable.
 */
export const useSavedCalculationsState = () => {
	const [state, dispatch] = useReducer(savedCalculationsReducer, INITIAL_STATE);

	const displayedHistory = useMemo(() => {
		const searchTerm = state.filters.query.trim().toLowerCase();
		const fromTimestamp = state.filters.dateFrom
			? new Date(`${state.filters.dateFrom}T00:00:00`).getTime()
			: undefined;
		const toTimestamp = state.filters.dateTo
			? new Date(`${state.filters.dateTo}T23:59:59.999`).getTime()
			: undefined;

		const kMin = parseOptionalNumber(state.filters.kMin);
		const kMax = parseOptionalNumber(state.filters.kMax);
		const dMin = parseOptionalNumber(state.filters.dMin);
		const dMax = parseOptionalNumber(state.filters.dMax);
		const DMin = parseOptionalNumber(state.filters.DMin);
		const DMax = parseOptionalNumber(state.filters.DMax);
		const nMin = parseOptionalNumber(state.filters.nMin);
		const nMax = parseOptionalNumber(state.filters.nMax);

		const filtered = state.history.filter((record) => {
			if (
				state.filters.units !== "all" &&
				record.units !== state.filters.units
			) {
				return false;
			}

			if (searchTerm) {
				const combined =
					`${record.manufacturer} ${record.partNumber} ${record.notes ?? ""}`.toLowerCase();
				if (!combined.includes(searchTerm)) {
					return false;
				}
			}

			if (fromTimestamp !== undefined && record.createdAt < fromTimestamp) {
				return false;
			}
			if (toTimestamp !== undefined && record.createdAt > toTimestamp) {
				return false;
			}
			if (kMin !== undefined && record.k < kMin) {
				return false;
			}
			if (kMax !== undefined && record.k > kMax) {
				return false;
			}
			if (dMin !== undefined && record.d < dMin) {
				return false;
			}
			if (dMax !== undefined && record.d > dMax) {
				return false;
			}
			if (DMin !== undefined && record.D < DMin) {
				return false;
			}
			if (DMax !== undefined && record.D > DMax) {
				return false;
			}
			if (nMin !== undefined && record.n < nMin) {
				return false;
			}
			if (nMax !== undefined && record.n > nMax) {
				return false;
			}

			return true;
		});

		const sorted = [...filtered].sort((a, b) => {
			if (state.sortOption === "created-desc") {
				return b.createdAt - a.createdAt;
			}
			if (state.sortOption === "created-asc") {
				return a.createdAt - b.createdAt;
			}
			if (state.sortOption === "k-asc") {
				const delta = a.k - b.k;
				return delta !== 0 ? delta : b.createdAt - a.createdAt;
			}
			const delta = b.k - a.k;
			return delta !== 0 ? delta : b.createdAt - a.createdAt;
		});

		return sorted;
	}, [state.history, state.filters, state.sortOption]);

	const activeFilterCount = useMemo(() => {
		return (
			(state.filters.query.trim() ? 1 : 0) +
			(state.filters.units !== "all" ? 1 : 0) +
			(state.filters.dateFrom ? 1 : 0) +
			(state.filters.dateTo ? 1 : 0) +
			(state.filters.kMin ? 1 : 0) +
			(state.filters.kMax ? 1 : 0) +
			(state.filters.dMin ? 1 : 0) +
			(state.filters.dMax ? 1 : 0) +
			(state.filters.DMin ? 1 : 0) +
			(state.filters.DMax ? 1 : 0) +
			(state.filters.nMin ? 1 : 0) +
			(state.filters.nMax ? 1 : 0)
		);
	}, [state.filters]);

	const selectedRecords = useMemo(() => {
		return state.history.filter((record) => state.selectedIds.has(record.id));
	}, [state.history, state.selectedIds]);

	const hydrateHistory = useCallback(
		(records: SpringCalcRecord[]) =>
			dispatch({ type: "hydrateHistory", records }),
		[],
	);
	const prependRecord = useCallback(
		(record: SpringCalcRecord) => dispatch({ type: "prependRecord", record }),
		[],
	);
	const deleteRecord = useCallback(
		(id: string) => dispatch({ type: "deleteRecord", id }),
		[],
	);
	const deleteRecords = useCallback(
		(ids: Set<string>) => dispatch({ type: "deleteRecords", ids }),
		[],
	);
	const clearHistory = useCallback(
		() => dispatch({ type: "clearHistory" }),
		[],
	);
	const setConfirmingBulkDelete = useCallback(
		(value: boolean) => dispatch({ type: "setConfirmingBulkDelete", value }),
		[],
	);
	const setConfirmingClearAll = useCallback(
		(value: boolean) => dispatch({ type: "setConfirmingClearAll", value }),
		[],
	);
	const setSortOption = useCallback(
		(sortOption: SavedSortOption) =>
			dispatch({ type: "setSortOption", sortOption }),
		[],
	);
	const setFilter = useCallback(
		(key: keyof SavedFilters, value: string | Units | "all") =>
			dispatch({ type: "setFilter", key, value }),
		[],
	);
	const clearFilters = useCallback(
		() => dispatch({ type: "clearFilters" }),
		[],
	);
	const toggleSelection = useCallback(
		(id: string) => dispatch({ type: "toggleSelection", id }),
		[],
	);
	const toggleSelectAll = useCallback(
		(ids: string[]) => dispatch({ type: "toggleSelectAll", ids }),
		[],
	);
	const setSelectedIds = useCallback(
		(ids: string[]) => dispatch({ type: "setSelectedIds", ids }),
		[],
	);
	const clearSelection = useCallback(
		() => dispatch({ type: "clearSelection" }),
		[],
	);
	const setShowComparePanel = useCallback(
		(value: boolean) => dispatch({ type: "setShowComparePanel", value }),
		[],
	);

	return useMemo(
		() => ({
			state,
			displayedHistory,
			selectedRecords,
			activeFilterCount,
			hydrateHistory,
			prependRecord,
			deleteRecord,
			deleteRecords,
			clearHistory,
			setConfirmingBulkDelete,
			setConfirmingClearAll,
			setSortOption,
			setFilter,
			clearFilters,
			toggleSelection,
			toggleSelectAll,
			setSelectedIds,
			clearSelection,
			setShowComparePanel,
		}),
		[
			state,
			displayedHistory,
			selectedRecords,
			activeFilterCount,
			hydrateHistory,
			prependRecord,
			deleteRecord,
			deleteRecords,
			clearHistory,
			setConfirmingBulkDelete,
			setConfirmingClearAll,
			setSortOption,
			setFilter,
			clearFilters,
			toggleSelection,
			toggleSelectAll,
			setSelectedIds,
			clearSelection,
			setShowComparePanel,
		],
	);
};
