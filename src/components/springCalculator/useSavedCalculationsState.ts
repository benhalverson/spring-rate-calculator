import { useCallback, useMemo, useReducer } from "react";

import type { SpringCalcRecord } from "../../types/spring";
import { type KSortDirection, toggleKSortDirection } from "./utils";

interface SavedCalculationsState {
	history: SpringCalcRecord[];
	selectedIds: Set<string>;
	kSortDirection: KSortDirection;
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
	| { type: "toggleKSort" }
	| { type: "toggleSelection"; id: string }
	| { type: "toggleSelectAll"; ids: string[] }
	| { type: "setSelectedIds"; ids: string[] }
	| { type: "clearSelection" }
	| { type: "setShowComparePanel"; value: boolean };

const INITIAL_STATE: SavedCalculationsState = {
	history: [],
	selectedIds: new Set(),
	kSortDirection: "none",
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

		case "toggleKSort": {
			return {
				...state,
				kSortDirection: toggleKSortDirection(state.kSortDirection),
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
		if (state.kSortDirection === "none") {
			return state.history;
		}

		const sorted = [...state.history].sort((a, b) => {
			return state.kSortDirection === "asc" ? a.k - b.k : b.k - a.k;
		});

		return sorted;
	}, [state.history, state.kSortDirection]);

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
	const toggleKSort = useCallback(() => dispatch({ type: "toggleKSort" }), []);
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
			hydrateHistory,
			prependRecord,
			deleteRecord,
			deleteRecords,
			clearHistory,
			setConfirmingBulkDelete,
			setConfirmingClearAll,
			toggleKSort,
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
			hydrateHistory,
			prependRecord,
			deleteRecord,
			deleteRecords,
			clearHistory,
			setConfirmingBulkDelete,
			setConfirmingClearAll,
			toggleKSort,
			toggleSelection,
			toggleSelectAll,
			setSelectedIds,
			clearSelection,
			setShowComparePanel,
		],
	);
};
