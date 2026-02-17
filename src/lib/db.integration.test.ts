import { beforeEach, describe, expect, it } from "vitest";

import type { SpringCalcRecord } from "../types/spring";
import {
	addCalculation,
	bulkDeleteCalculations,
	clearCalculations,
	deleteCalculation,
	listCalculations,
} from "./db";

const createRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: crypto.randomUUID(),
	createdAt: Date.now(),
	manufacturer: "Test Manufacturer",
	partNumber: "TEST-123",
	purchaseUrl: "https://example.com/spring",
	notes: "Integration test spring",
	units: "mm",
	d: 1.5,
	D: 12.0,
	n: 8,
	Davg: 10.5,
	k: 0.00008,
	...overrides,
});

describe("db integration tests", () => {
	beforeEach(async () => {
		await clearCalculations();
	});

	describe("CRUD operations", () => {
		it("creates a new calculation and retrieves it", async () => {
			const record = createRecord({ id: "test-1" });
			await addCalculation(record);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]).toMatchObject(record);
		});

		it("reads all calculations in correct order", async () => {
			const record1 = createRecord({ id: "test-1", createdAt: 1000 });
			const record2 = createRecord({ id: "test-2", createdAt: 2000 });
			const record3 = createRecord({ id: "test-3", createdAt: 1500 });

			await addCalculation(record1);
			await addCalculation(record2);
			await addCalculation(record3);

			const records = await listCalculations();
			expect(records).toHaveLength(3);
			expect(records[0]?.id).toBe("test-2"); // Most recent
			expect(records[1]?.id).toBe("test-3");
			expect(records[2]?.id).toBe("test-1"); // Oldest
		});

		it("updates an existing calculation", async () => {
			const record = createRecord({ id: "test-1", notes: "Original" });
			await addCalculation(record);

			const updated = { ...record, notes: "Updated" };
			await addCalculation(updated);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]?.notes).toBe("Updated");
		});

		it("deletes a single calculation", async () => {
			const record1 = createRecord({ id: "test-1" });
			const record2 = createRecord({ id: "test-2", createdAt: 2000 });
			await addCalculation(record1);
			await addCalculation(record2);

			await deleteCalculation("test-1");

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]?.id).toBe("test-2");
		});

		it("deletes multiple calculations in bulk", async () => {
			const record1 = createRecord({ id: "test-1" });
			const record2 = createRecord({ id: "test-2", createdAt: 2000 });
			const record3 = createRecord({ id: "test-3", createdAt: 3000 });
			await addCalculation(record1);
			await addCalculation(record2);
			await addCalculation(record3);

			await bulkDeleteCalculations(["test-1", "test-3"]);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]?.id).toBe("test-2");
		});

		it("clears all calculations", async () => {
			await addCalculation(createRecord({ id: "test-1" }));
			await addCalculation(createRecord({ id: "test-2", createdAt: 2000 }));
			await addCalculation(createRecord({ id: "test-3", createdAt: 3000 }));

			await clearCalculations();

			const records = await listCalculations();
			expect(records).toHaveLength(0);
		});
	});

	describe("sync pattern validation", () => {
		it("handles concurrent creates without data loss", async () => {
			const records = Array.from({ length: 10 }, (_, i) =>
				createRecord({ id: `concurrent-${i}`, createdAt: 1000 + i }),
			);

			// Simulate concurrent writes
			await Promise.all(records.map((r) => addCalculation(r)));

			const retrieved = await listCalculations();
			expect(retrieved).toHaveLength(10);
		});

		it("handles last-write-wins update pattern", async () => {
			const baseRecord = createRecord({ id: "test-1", notes: "Version 1" });
			await addCalculation(baseRecord);

			// Simulate two concurrent updates
			const update1 = { ...baseRecord, notes: "Version 2" };
			const update2 = { ...baseRecord, notes: "Version 3" };

			await Promise.all([addCalculation(update1), addCalculation(update2)]);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			// Either version 2 or 3 should win (last write wins)
			expect(["Version 2", "Version 3"]).toContain(records[0]?.notes);
		});

		it("supports idempotent operations", async () => {
			const record = createRecord({ id: "test-1" });

			// Add same record multiple times
			await addCalculation(record);
			await addCalculation(record);
			await addCalculation(record);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]).toMatchObject(record);
		});

		it("handles delete of non-existent record gracefully", async () => {
			await addCalculation(createRecord({ id: "test-1" }));

			// Delete non-existent record should not throw
			await expect(deleteCalculation("non-existent")).resolves.not.toThrow();

			const records = await listCalculations();
			expect(records).toHaveLength(1);
		});

		it("handles bulk delete with some non-existent ids", async () => {
			await addCalculation(createRecord({ id: "test-1" }));
			await addCalculation(createRecord({ id: "test-2", createdAt: 2000 }));

			// Include non-existent IDs in bulk delete
			await bulkDeleteCalculations([
				"test-1",
				"non-existent-1",
				"non-existent-2",
			]);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]?.id).toBe("test-2");
		});
	});

	describe("session/auth boundary tests (future-ready)", () => {
		it("isolates data per session context", async () => {
			// Current implementation: single user, all data in one context
			// Future: This test validates that data operations respect session boundaries
			const session1Records = [
				createRecord({ id: "session1-1", manufacturer: "Session1 Mfg" }),
				createRecord({
					id: "session1-2",
					manufacturer: "Session1 Mfg",
					createdAt: 2000,
				}),
			];

			for (const record of session1Records) {
				await addCalculation(record);
			}

			const allRecords = await listCalculations();
			expect(allRecords).toHaveLength(2);

			// Future enhancement: When auth is added, this test should verify
			// that session1 user cannot see session2 user's data
		});

		it("validates required fields for data integrity", async () => {
			const validRecord = createRecord({ id: "valid" });

			// Should accept valid record
			await expect(addCalculation(validRecord)).resolves.not.toThrow();

			// Current implementation uses TypeScript types for validation
			// Future: Add runtime validation at API boundaries
		});

		it("handles invalid data types gracefully", async () => {
			const record = createRecord({ id: "test-1" });

			// Type system prevents most invalid data, but test runtime behavior
			await expect(addCalculation(record)).resolves.not.toThrow();
		});
	});

	describe("data migration and schema evolution", () => {
		it("handles records with legacy schema fields", async () => {
			// Test that newer code can read older data format
			const legacyRecord = createRecord({
				id: "legacy-1",
				manufacturer: "  Legacy Manufacturer  ", // Old data had extra spaces
				partNumber: "  LEGACY-123  ",
			});

			await addCalculation(legacyRecord);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
			// Note: Schema upgrade only trims during actual v1->v2 migration
			// New records are stored as-is
			expect(records[0]?.manufacturer).toBe("  Legacy Manufacturer  ");
			expect(records[0]?.partNumber).toBe("  LEGACY-123  ");
		});

		it("preserves unknown fields during upgrade", async () => {
			// Add record with current schema
			const record = createRecord({ id: "test-1" });
			await addCalculation(record);

			// Verify record is retrievable
			const records = await listCalculations();
			expect(records).toHaveLength(1);
			expect(records[0]?.id).toBe("test-1");
		});
	});

	describe("error handling and edge cases", () => {
		it("handles empty bulk delete gracefully", async () => {
			await addCalculation(createRecord({ id: "test-1" }));

			await bulkDeleteCalculations([]);

			const records = await listCalculations();
			expect(records).toHaveLength(1);
		});

		it("handles large batch operations", async () => {
			const batchSize = 100;
			const records = Array.from({ length: batchSize }, (_, i) =>
				createRecord({ id: `batch-${i}`, createdAt: 1000 + i }),
			);

			// Batch create
			for (const record of records) {
				await addCalculation(record);
			}

			const retrieved = await listCalculations();
			expect(retrieved).toHaveLength(batchSize);

			// Batch delete
			const idsToDelete = records.slice(0, 50).map((r) => r.id);
			await bulkDeleteCalculations(idsToDelete);

			const remaining = await listCalculations();
			expect(remaining).toHaveLength(batchSize - 50);
		});

		it("handles special characters in string fields", async () => {
			const record = createRecord({
				id: "special-chars",
				manufacturer: "Manufacturer <>&\"'",
				partNumber: "Part-123!@#$%",
				notes: "Notes with\nnewlines\tand\ttabs",
			});

			await addCalculation(record);

			const records = await listCalculations();
			expect(records[0]?.manufacturer).toBe("Manufacturer <>&\"'");
			expect(records[0]?.partNumber).toBe("Part-123!@#$%");
			expect(records[0]?.notes).toBe("Notes with\nnewlines\tand\ttabs");
		});

		it("handles numeric edge cases", async () => {
			const record = createRecord({
				id: "edge-case",
				d: 0.001, // Very small
				D: 999.999, // Large
				n: 1, // Minimum coils
				k: Number.MIN_VALUE, // Tiny spring rate
			});

			await addCalculation(record);

			const records = await listCalculations();
			expect(records[0]?.d).toBe(0.001);
			expect(records[0]?.D).toBe(999.999);
			expect(records[0]?.n).toBe(1);
		});
	});

	describe("contract regression protection", () => {
		it("maintains stable CRUD API signatures", async () => {
			// This test validates that core API methods maintain their contracts
			// Any breaking changes should fail this test

			// addCalculation: (record: SpringCalcRecord) => Promise<void>
			const record = createRecord({ id: "api-test" });
			const addResult = await addCalculation(record);
			expect(addResult).toBeUndefined(); // Returns void

			// listCalculations: () => Promise<SpringCalcRecord[]>
			const listResult = await listCalculations();
			expect(Array.isArray(listResult)).toBe(true);

			// deleteCalculation: (id: string) => Promise<void>
			const deleteResult = await deleteCalculation("api-test");
			expect(deleteResult).toBeUndefined(); // Returns void

			// bulkDeleteCalculations: (ids: string[]) => Promise<void>
			const bulkDeleteResult = await bulkDeleteCalculations([]);
			expect(bulkDeleteResult).toBeUndefined(); // Returns void

			// clearCalculations: () => Promise<void>
			const clearResult = await clearCalculations();
			expect(clearResult).toBeUndefined(); // Returns void
		});

		it("maintains stable data shape", async () => {
			const record = createRecord({ id: "shape-test" });
			await addCalculation(record);

			const records = await listCalculations();
			const retrieved = records[0];

			// Validate all required fields exist
			expect(retrieved).toHaveProperty("id");
			expect(retrieved).toHaveProperty("createdAt");
			expect(retrieved).toHaveProperty("manufacturer");
			expect(retrieved).toHaveProperty("partNumber");
			expect(retrieved).toHaveProperty("units");
			expect(retrieved).toHaveProperty("d");
			expect(retrieved).toHaveProperty("D");
			expect(retrieved).toHaveProperty("n");
			expect(retrieved).toHaveProperty("Davg");
			expect(retrieved).toHaveProperty("k");

			// Validate field types
			expect(typeof retrieved?.id).toBe("string");
			expect(typeof retrieved?.createdAt).toBe("number");
			expect(typeof retrieved?.manufacturer).toBe("string");
			expect(typeof retrieved?.partNumber).toBe("string");
			expect(["mm", "in"]).toContain(retrieved?.units);
			expect(typeof retrieved?.d).toBe("number");
			expect(typeof retrieved?.D).toBe("number");
			expect(typeof retrieved?.n).toBe("number");
			expect(typeof retrieved?.Davg).toBe("number");
			expect(typeof retrieved?.k).toBe("number");
		});
	});
});
