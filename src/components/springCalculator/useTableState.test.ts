import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SpringCalcRecord } from "../../types/spring";
import { useTableState } from "./useTableState";

const createMockRecord = (id: string, k: number): SpringCalcRecord => ({
	id,
	createdAt: Date.now(),
	manufacturer: "Test",
	partNumber: `PART-${id}`,
	units: "mm",
	d: 1,
	D: 10,
	n: 5,
	Davg: 9,
	k,
});

describe("useTableState", () => {
	it("initializes with empty selection and no sorting", () => {
		const records = [createMockRecord("1", 100), createMockRecord("2", 200)];
		const { result } = renderHook(() => useTableState(records));

		expect(result.current.selectedIds.size).toBe(0);
		expect(result.current.kSortDirection).toBe("none");
		expect(result.current.isConfirmingBulkDelete).toBe(false);
		expect(result.current.sortedRecords).toEqual(records);
	});

	it("toggles sorting direction through none -> asc -> desc -> none", () => {
		const records = [
			createMockRecord("1", 300),
			createMockRecord("2", 100),
			createMockRecord("3", 200),
		];
		const { result } = renderHook(() => useTableState(records));

		// Initial state: none
		expect(result.current.kSortDirection).toBe("none");
		expect(result.current.sortedRecords).toEqual(records);

		// Toggle to asc
		act(() => {
			result.current.toggleSort();
		});
		expect(result.current.kSortDirection).toBe("asc");
		expect(result.current.sortedRecords[0].k).toBe(100);
		expect(result.current.sortedRecords[1].k).toBe(200);
		expect(result.current.sortedRecords[2].k).toBe(300);

		// Toggle to desc
		act(() => {
			result.current.toggleSort();
		});
		expect(result.current.kSortDirection).toBe("desc");
		expect(result.current.sortedRecords[0].k).toBe(300);
		expect(result.current.sortedRecords[1].k).toBe(200);
		expect(result.current.sortedRecords[2].k).toBe(100);

		// Toggle back to none
		act(() => {
			result.current.toggleSort();
		});
		expect(result.current.kSortDirection).toBe("none");
		expect(result.current.sortedRecords).toEqual(records);
	});

	it("toggles individual row selection", () => {
		const records = [createMockRecord("1", 100), createMockRecord("2", 200)];
		const { result } = renderHook(() => useTableState(records));

		// Select first record
		act(() => {
			result.current.toggleSelection("1");
		});
		expect(result.current.selectedIds.has("1")).toBe(true);
		expect(result.current.selectedIds.size).toBe(1);

		// Select second record
		act(() => {
			result.current.toggleSelection("2");
		});
		expect(result.current.selectedIds.has("2")).toBe(true);
		expect(result.current.selectedIds.size).toBe(2);

		// Deselect first record
		act(() => {
			result.current.toggleSelection("1");
		});
		expect(result.current.selectedIds.has("1")).toBe(false);
		expect(result.current.selectedIds.has("2")).toBe(true);
		expect(result.current.selectedIds.size).toBe(1);
	});

	it("toggles select all rows", () => {
		const records = [
			createMockRecord("1", 100),
			createMockRecord("2", 200),
			createMockRecord("3", 300),
		];
		const { result } = renderHook(() => useTableState(records));

		// Select all
		act(() => {
			result.current.toggleSelectAll();
		});
		expect(result.current.selectedIds.size).toBe(3);
		expect(result.current.selectedIds.has("1")).toBe(true);
		expect(result.current.selectedIds.has("2")).toBe(true);
		expect(result.current.selectedIds.has("3")).toBe(true);

		// Deselect all
		act(() => {
			result.current.toggleSelectAll();
		});
		expect(result.current.selectedIds.size).toBe(0);
	});

	it("clears selection", () => {
		const records = [createMockRecord("1", 100), createMockRecord("2", 200)];
		const { result } = renderHook(() => useTableState(records));

		// Select both
		act(() => {
			result.current.toggleSelection("1");
			result.current.toggleSelection("2");
		});
		expect(result.current.selectedIds.size).toBe(2);

		// Clear selection
		act(() => {
			result.current.clearSelection();
		});
		expect(result.current.selectedIds.size).toBe(0);
	});

	it("manages bulk delete confirmation state", () => {
		const records = [createMockRecord("1", 100)];
		const { result } = renderHook(() => useTableState(records));

		expect(result.current.isConfirmingBulkDelete).toBe(false);

		// Start confirmation
		act(() => {
			result.current.startBulkDelete();
		});
		expect(result.current.isConfirmingBulkDelete).toBe(true);

		// Cancel confirmation
		act(() => {
			result.current.cancelBulkDelete();
		});
		expect(result.current.isConfirmingBulkDelete).toBe(false);
	});

	it("completes bulk delete by clearing selection and confirmation", () => {
		const records = [createMockRecord("1", 100), createMockRecord("2", 200)];
		const { result } = renderHook(() => useTableState(records));

		// Setup: select rows and start confirmation
		act(() => {
			result.current.toggleSelection("1");
			result.current.toggleSelection("2");
			result.current.startBulkDelete();
		});
		expect(result.current.selectedIds.size).toBe(2);
		expect(result.current.isConfirmingBulkDelete).toBe(true);

		// Complete bulk delete
		act(() => {
			result.current.completeBulkDelete();
		});
		expect(result.current.selectedIds.size).toBe(0);
		expect(result.current.isConfirmingBulkDelete).toBe(false);
	});

	it("removes individual ID from selection", () => {
		const records = [createMockRecord("1", 100), createMockRecord("2", 200)];
		const { result } = renderHook(() => useTableState(records));

		// Select both
		act(() => {
			result.current.toggleSelection("1");
			result.current.toggleSelection("2");
		});
		expect(result.current.selectedIds.size).toBe(2);

		// Remove one from selection
		act(() => {
			result.current.removeFromSelection("1");
		});
		expect(result.current.selectedIds.has("1")).toBe(false);
		expect(result.current.selectedIds.has("2")).toBe(true);
		expect(result.current.selectedIds.size).toBe(1);
	});

	it("sorts records based on current sort direction", () => {
		const records = [
			createMockRecord("1", 500),
			createMockRecord("2", 100),
			createMockRecord("3", 300),
		];
		const { result } = renderHook(() => useTableState(records));

		// Toggle to asc
		act(() => {
			result.current.toggleSort();
		});
		const sortedAsc = result.current.sortedRecords;
		expect(sortedAsc.map((r) => r.k)).toEqual([100, 300, 500]);

		// Toggle to desc
		act(() => {
			result.current.toggleSort();
		});
		const sortedDesc = result.current.sortedRecords;
		expect(sortedDesc.map((r) => r.k)).toEqual([500, 300, 100]);
	});

	it("maintains selection across sorting changes", () => {
		const records = [
			createMockRecord("1", 300),
			createMockRecord("2", 100),
			createMockRecord("3", 200),
		];
		const { result } = renderHook(() => useTableState(records));

		// Select middle record
		act(() => {
			result.current.toggleSelection("3");
		});
		expect(result.current.selectedIds.has("3")).toBe(true);

		// Change sort - selection should persist
		act(() => {
			result.current.toggleSort();
		});
		expect(result.current.selectedIds.has("3")).toBe(true);
		expect(result.current.selectedIds.size).toBe(1);
	});
});
