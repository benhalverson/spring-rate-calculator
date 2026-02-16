import { describe, expect, it } from "vitest";
import type { SpringCalcRecord } from "../../types/spring";
import type { FilterState } from "./FilterControls";
import {
	applyFilters,
	countActiveFilters,
	getEmptyFilters,
} from "./filterUtils";

const mockRecords: SpringCalcRecord[] = [
	{
		id: "1",
		createdAt: new Date("2024-01-15").getTime(),
		manufacturer: "Eibach",
		partNumber: "ERS-200-100",
		notes: "Front suspension spring",
		units: "mm",
		d: 10,
		D: 50,
		n: 8,
		Davg: 40,
		k: 100,
	},
	{
		id: "2",
		createdAt: new Date("2024-02-20").getTime(),
		manufacturer: "Hyperco",
		partNumber: "HC-250-120",
		notes: "Rear coilover",
		units: "in",
		d: 0.5,
		D: 2.5,
		n: 10,
		Davg: 2,
		k: 250,
	},
	{
		id: "3",
		createdAt: new Date("2024-03-10").getTime(),
		manufacturer: "Swift",
		partNumber: "SW-180-90",
		notes: "Track day setup",
		units: "mm",
		d: 12,
		D: 60,
		n: 9,
		Davg: 48,
		k: 180,
	},
];

describe("getEmptyFilters", () => {
	it("should return filter state with all empty values", () => {
		const filters = getEmptyFilters();
		expect(filters.searchQuery).toBe("");
		expect(filters.unitFilter).toBe("all");
		expect(filters.dateFrom).toBe("");
		expect(filters.dateTo).toBe("");
		expect(filters.kMin).toBe("");
		expect(filters.kMax).toBe("");
		expect(filters.dMin).toBe("");
		expect(filters.dMax).toBe("");
		expect(filters.DMin).toBe("");
		expect(filters.DMax).toBe("");
		expect(filters.nMin).toBe("");
		expect(filters.nMax).toBe("");
	});
});

describe("countActiveFilters", () => {
	it("should return 0 for empty filters", () => {
		const filters = getEmptyFilters();
		expect(countActiveFilters(filters)).toBe(0);
	});

	it("should count search query", () => {
		const filters: FilterState = {
			...getEmptyFilters(),
			searchQuery: "test",
		};
		expect(countActiveFilters(filters)).toBe(1);
	});

	it("should count unit filter", () => {
		const filters: FilterState = {
			...getEmptyFilters(),
			unitFilter: "mm",
		};
		expect(countActiveFilters(filters)).toBe(1);
	});

	it("should count date filters", () => {
		const filters: FilterState = {
			...getEmptyFilters(),
			dateFrom: "2024-01-01",
			dateTo: "2024-12-31",
		};
		expect(countActiveFilters(filters)).toBe(2);
	});

	it("should count numeric range filters", () => {
		const filters: FilterState = {
			...getEmptyFilters(),
			kMin: "100",
			dMax: "15",
		};
		expect(countActiveFilters(filters)).toBe(2);
	});

	it("should count all active filters", () => {
		const filters: FilterState = {
			searchQuery: "test",
			unitFilter: "mm",
			dateFrom: "2024-01-01",
			dateTo: "2024-12-31",
			kMin: "100",
			kMax: "200",
			dMin: "10",
			dMax: "15",
			DMin: "40",
			DMax: "60",
			nMin: "8",
			nMax: "10",
		};
		expect(countActiveFilters(filters)).toBe(8);
	});
});

describe("applyFilters", () => {
	it("should return all records with empty filters", () => {
		const filters = getEmptyFilters();
		const result = applyFilters(mockRecords, filters);
		expect(result).toHaveLength(3);
	});

	describe("search filter", () => {
		it("should filter by manufacturer (case-insensitive)", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "eibach",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].manufacturer).toBe("Eibach");
		});

		it("should filter by part number", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "HC-250",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].partNumber).toBe("HC-250-120");
		});

		it("should filter by notes", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "coilover",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].notes).toBe("Rear coilover");
		});

		it("should be case-insensitive", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "SWIFT",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].manufacturer).toBe("Swift");
		});

		it("should match partial strings", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "200",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
		});
	});

	describe("unit filter", () => {
		it("should filter by mm units", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				unitFilter: "mm",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.units === "mm")).toBe(true);
		});

		it("should filter by in units", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				unitFilter: "in",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].units).toBe("in");
		});
	});

	describe("date range filter", () => {
		it("should filter by date from", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				dateFrom: "2024-02-01",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});

		it("should filter by date to", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				dateTo: "2024-02-01",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
		});

		it("should filter by date range", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				dateFrom: "2024-02-01",
				dateTo: "2024-02-28",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("2");
		});
	});

	describe("k range filter", () => {
		it("should filter by minimum k", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				kMin: "150",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.k >= 150)).toBe(true);
		});

		it("should filter by maximum k", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				kMax: "200",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.k <= 200)).toBe(true);
		});

		it("should filter by k range", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				kMin: "150",
				kMax: "200",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].k).toBe(180);
		});
	});

	describe("d range filter", () => {
		it("should filter by minimum d", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				dMin: "10",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});

		it("should filter by maximum d", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				dMax: "10",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.d <= 10)).toBe(true);
		});
	});

	describe("D range filter", () => {
		it("should filter by minimum D", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				DMin: "50",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});

		it("should filter by maximum D", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				DMax: "50",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
			expect(result.every((r) => r.D <= 50)).toBe(true);
		});
	});

	describe("n range filter", () => {
		it("should filter by minimum n", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				nMin: "9",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});

		it("should filter by maximum n", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				nMax: "9",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});
	});

	describe("combined filters", () => {
		it("should combine search and unit filter", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "spring",
				unitFilter: "mm",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("1");
		});

		it("should combine multiple range filters", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				kMin: "100",
				kMax: "200",
				dMin: "10",
				nMin: "8",
				nMax: "9",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(2);
		});

		it("should return empty array when no matches", () => {
			const filters: FilterState = {
				...getEmptyFilters(),
				searchQuery: "nonexistent",
			};
			const result = applyFilters(mockRecords, filters);
			expect(result).toHaveLength(0);
		});
	});
});
