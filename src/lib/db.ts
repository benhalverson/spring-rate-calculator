import type { CloudSyncListener, CloudSyncStatus } from "../types/cloudSync";
import type { SpringCalcRecord } from "../types/spring";
import { isCloudSyncEnabled } from "./env";
import { HybridBackend } from "./storage/hybridBackend";
import { IndexedDBBackend } from "./storage/indexedDbBackend";
import type { StorageBackend } from "./storage/StorageBackend";

const createBackend = (): StorageBackend => {
	if (isCloudSyncEnabled()) {
		return new HybridBackend();
	}
	return new IndexedDBBackend();
};

const backend = createBackend();

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
	await backend.bulkDeleteCalculations(ids);
};

/**
 * Deletes all saved calculations.
 */
export const clearCalculations = async (): Promise<void> => {
	await backend.clearCalculations();
};

export const getCloudSyncStatus = (): CloudSyncStatus => {
	return (
		backend.getCloudSyncStatus?.() ?? { state: "disabled", queuedCount: 0 }
	);
};

export const subscribeCloudSyncStatus = (
	listener: CloudSyncListener,
): (() => void) => {
	return backend.subscribeCloudSyncStatus?.(listener) ?? (() => {});
};

export const flushCloudSyncNow = async (): Promise<void> => {
	await backend.flushCloudSyncNow?.();
};
