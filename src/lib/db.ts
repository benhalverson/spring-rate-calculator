import Dexie, { type EntityTable } from "dexie";

import type { SpringCalcRecord } from "../types/spring";

/**
 * Typed Dexie database for spring calculation persistence.
 */
class SpringRateDatabase extends Dexie {
	/** IndexedDB table that stores spring calculation records. */
	calculations!: EntityTable<SpringCalcRecord, "id">;

	constructor() {
		super("spring-rate-db");
		this.version(1).stores({
			calculations: "id, createdAt",
		});
		this.version(2)
			.stores({
				calculations:
					"id, createdAt, manufacturer, partNumber, [manufacturer+partNumber]",
			})
			.upgrade((transaction) => {
				return transaction
					.table("calculations")
					.toCollection()
					.modify((record: Partial<SpringCalcRecord>) => {
						record.manufacturer =
							record.manufacturer?.trim() || "Unknown manufacturer";
						record.partNumber =
							record.partNumber?.trim() || "Unknown part number";
					});
			});
		this.version(3)
			.stores({
				calculations:
					"id, createdAt, updatedAt, deletedAt, manufacturer, partNumber, [manufacturer+partNumber]",
			})
			.upgrade((transaction) => {
				return transaction
					.table("calculations")
					.toCollection()
					.modify((record: Partial<SpringCalcRecord>) => {
						// Set updatedAt to createdAt for existing records
						if (record.createdAt && !record.updatedAt) {
							record.updatedAt = record.createdAt;
						}
						// Set deletedAt to null for existing records
						if (record.deletedAt === undefined) {
							record.deletedAt = null;
						}
					});
			});
	}
}

const db = new SpringRateDatabase();

/**
 * Persists a spring calculation record.
 *
 * @param record - Fully computed record to save.
 */
export const addCalculation = async (
	record: SpringCalcRecord,
): Promise<void> => {
	const now = Date.now();
	const recordWithTimestamps = {
		...record,
		// Preserve existing updatedAt for sync operations, set to now for new records
		updatedAt: record.updatedAt || now,
		deletedAt: record.deletedAt !== undefined ? record.deletedAt : null,
	};
	await db.calculations.put(recordWithTimestamps);
};

/**
 * Lists all saved calculations ordered from newest to oldest.
 * Excludes soft-deleted records.
 *
 * @returns Array of persisted records sorted by `createdAt` descending.
 */
export const listCalculations = async (): Promise<SpringCalcRecord[]> => {
	const records = await db.calculations
		.filter((record) => record.deletedAt === null)
		.sortBy("createdAt");
	return records.reverse();
};

/**
 * Deletes one saved calculation by id (soft delete).
 *
 * @param id - Unique record id.
 */
export const deleteCalculation = async (id: string): Promise<void> => {
	const now = Date.now();
	await db.calculations.update(id, {
		updatedAt: now,
		deletedAt: now,
	});
};

/**
 * Deletes multiple saved calculations by their ids (soft delete).
 *
 * @param ids - Array of unique record ids to delete.
 */
export const bulkDeleteCalculations = async (ids: string[]): Promise<void> => {
	if (ids.length === 0) {
		return;
	}
	const now = Date.now();
	await db.transaction("rw", db.calculations, async () => {
		for (const id of ids) {
			await db.calculations.update(id, {
				updatedAt: now,
				deletedAt: now,
			});
		}
	});
};

/**
 * Deletes all saved calculations.
 */
export const clearCalculations = async (): Promise<void> => {
	await db.calculations.clear();
};
