import Dexie, { type EntityTable } from "dexie";

import type { SpringCalcRecord } from "../types/spring";
import {
	createDisabledSyncStatus,
	HybridBackend,
	IndexedDBBackend,
	type StorageBackend,
	type SyncOperation,
	type SyncPersistence,
	type SyncStatus,
} from "./storageAdapter";

type SyncQueueRow = {
	id?: number;
	operation: SyncOperation;
};

type SyncMetaRow = {
	key: "lastSyncedAt";
	value: number;
};

/**
 * Typed Dexie database for spring calculation persistence.
 */
class SpringRateDatabase extends Dexie {
	/** IndexedDB table that stores spring calculation records. */
	calculations!: EntityTable<SpringCalcRecord, "id">;
	/** IndexedDB table that stores pending sync operations. */
	syncQueue!: EntityTable<SyncQueueRow, "id">;
	/** IndexedDB table that stores sync metadata. */
	syncMeta!: EntityTable<SyncMetaRow, "key">;

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
		this.version(4).stores({
			calculations:
				"id, createdAt, updatedAt, deletedAt, manufacturer, partNumber, [manufacturer+partNumber]",
			syncQueue: "++id",
			syncMeta: "key",
		});
	}
}

const db = new SpringRateDatabase();

const isActiveRecord = (record: SpringCalcRecord): boolean =>
	record.deletedAt === null;

const toDeletedRecord = (
	record: SpringCalcRecord,
	deletedAt: number,
): SpringCalcRecord => ({
	...record,
	updatedAt: deletedAt,
	deletedAt,
});

const softDeleteRecords = async (
	ids: string[],
	deletedAt = Date.now(),
): Promise<void> => {
	if (ids.length === 0) {
		return;
	}

	await db.transaction("rw", db.calculations, async () => {
		const records = await db.calculations.bulkGet(ids);
		const tombstones = records
			.filter((record): record is SpringCalcRecord =>
				Boolean(record && isActiveRecord(record)),
			)
			.map((record) => toDeletedRecord(record, deletedAt));

		if (tombstones.length > 0) {
			await db.calculations.bulkPut(tombstones);
		}
	});
};

const softDeleteAllRecords = async (deletedAt = Date.now()): Promise<void> => {
	await db.transaction("rw", db.calculations, async () => {
		const activeRecords = await db.calculations
			.toCollection()
			.filter(isActiveRecord)
			.toArray();

		if (activeRecords.length === 0) {
			return;
		}

		await db.calculations.bulkPut(
			activeRecords.map((record) => toDeletedRecord(record, deletedAt)),
		);
	});
};

const indexedBackend = new IndexedDBBackend({
	add: async (record) => {
		await db.calculations.put(record);
	},
	list: async () =>
		db.calculations
			.orderBy("createdAt")
			.reverse()
			.filter(isActiveRecord)
			.toArray(),
	deleteOne: async (id, deletedAt) => softDeleteRecords([id], deletedAt),
	deleteMany: async (ids, deletedAt) => softDeleteRecords(ids, deletedAt),
	clear: async (deletedAt) => softDeleteAllRecords(deletedAt),
});

const indexedSyncPersistence: SyncPersistence = {
	readQueue: async () => {
		const rows = await db.syncQueue.orderBy("id").toArray();
		return rows.map((row) => row.operation);
	},
	writeQueue: async (operations) => {
		await db.transaction("rw", db.syncQueue, async () => {
			await db.syncQueue.clear();
			if (operations.length > 0) {
				await db.syncQueue.bulkAdd(
					operations.map((operation) => ({ operation })),
				);
			}
		});
	},
	readLastSyncedAt: async () => {
		const row = await db.syncMeta.get("lastSyncedAt");
		return row && Number.isFinite(row.value) ? row.value : undefined;
	},
	writeLastSyncedAt: async (timestamp) => {
		await db.syncMeta.put({ key: "lastSyncedAt", value: timestamp });
	},
};

const cloudSyncFlag = import.meta.env.VITE_ENABLE_CLOUD_SYNC;

export const isCloudSyncEnabled =
	cloudSyncFlag === "true" ||
	(import.meta.env.PROD && cloudSyncFlag !== "false");

const hybridBackend = isCloudSyncEnabled
	? new HybridBackend(indexedBackend, "/api/v1/sync", indexedSyncPersistence)
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
 * Excludes soft-deleted records.
 *
 * @returns Array of persisted records sorted by `createdAt` descending.
 */
export const listCalculations = async (): Promise<SpringCalcRecord[]> => {
	return backend.listCalculations();
};

/**
 * Deletes one saved calculation by id (soft delete).
 *
 * @param id - Unique record id.
 */
export const deleteCalculation = async (id: string): Promise<void> => {
	await backend.deleteCalculation(id);
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
