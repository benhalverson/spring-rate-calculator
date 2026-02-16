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
	await db.calculations.put(record);
};

/**
 * Lists all saved calculations ordered from newest to oldest.
 *
 * @returns Array of persisted records sorted by `createdAt` descending.
 */
export const listCalculations = async (): Promise<SpringCalcRecord[]> => {
	return db.calculations.orderBy("createdAt").reverse().toArray();
};

/**
 * Deletes one saved calculation by id.
 *
 * @param id - Unique record id.
 */
export const deleteCalculation = async (id: string): Promise<void> => {
	await db.calculations.delete(id);
};

/**
 * Deletes multiple saved calculations by their ids.
 *
 * @param ids - Array of unique record ids to delete.
 */
export const bulkDeleteCalculations = async (ids: string[]): Promise<void> => {
	if (ids.length === 0) {
		return;
	}
	await db.calculations.bulkDelete(ids);
};

/**
 * Deletes all saved calculations.
 */
export const clearCalculations = async (): Promise<void> => {
	await db.calculations.clear();
};
