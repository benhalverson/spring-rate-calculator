import Dexie, { type EntityTable } from "dexie";

import type { SpringCalcRecord } from "../types/spring";
import {
	createDisabledSyncStatus,
	HybridBackend,
	IndexedDBBackend,
	type StorageBackend,
	type SyncStatus,
} from "./storageAdapter";

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

const indexedBackend = new IndexedDBBackend({
	add: async (record) => {
		await db.calculations.put(record);
	},
	list: async () => db.calculations.orderBy("createdAt").reverse().toArray(),
	deleteOne: async (id) => db.calculations.delete(id),
	deleteMany: async (ids) => db.calculations.bulkDelete(ids),
	clear: async () => db.calculations.clear(),
});

export const isCloudSyncEnabled =
	import.meta.env.VITE_ENABLE_CLOUD_SYNC === "true";

const hybridBackend = isCloudSyncEnabled
	? new HybridBackend(indexedBackend)
	: null;

const backend: StorageBackend = hybridBackend ?? indexedBackend;

/**
 * Persists a spring calculation record.
 *
 * @param record - Fully computed record to save.
 */
export const addCalculation = async (
	record: SpringCalcRecord,
): Promise<void> => {
	await backend.addCalculation(record);
};

/**
 * Lists all saved calculations ordered from newest to oldest.
 *
 * @returns Array of persisted records sorted by `createdAt` descending.
 */
export const listCalculations = async (): Promise<SpringCalcRecord[]> => {
	return backend.listCalculations();
};

/**
 * Deletes one saved calculation by id.
 *
 * @param id - Unique record id.
 */
export const deleteCalculation = async (id: string): Promise<void> => {
	await backend.deleteCalculation(id);
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
	await backend.bulkDeleteCalculations(ids);
};

/**
 * Deletes all saved calculations.
 */
export const clearCalculations = async (): Promise<void> => {
	await backend.clearCalculations();
};

/**
 * Reads current cloud sync status for the optional hybrid backend.
 */
export const getSyncStatus = (): SyncStatus => {
	return hybridBackend?.getSyncStatus() ?? createDisabledSyncStatus();
};

/**
 * Subscribes to cloud sync status updates in hybrid mode.
 */
export const subscribeSyncStatus = (
	listener: (status: SyncStatus) => void,
): (() => void) => {
	if (!hybridBackend) {
		listener(createDisabledSyncStatus());
		return () => {};
	}

	return hybridBackend.subscribeSyncStatus(listener);
};

/**
 * Requests a background sync attempt when cloud sync mode is enabled.
 */
export const triggerBackgroundSync = async (): Promise<void> => {
	if (!hybridBackend) {
		return;
	}
	await hybridBackend.triggerBackgroundSync();
};
