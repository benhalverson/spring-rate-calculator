import Dexie, { type EntityTable } from "dexie";

import type { CloudSyncListener, CloudSyncStatus } from "../../types/cloudSync";
import type { SpringCalcRecord } from "../../types/spring";
import type { StorageBackend } from "./StorageBackend";

/**
 * Typed Dexie database for spring calculation persistence.
 */
class SpringRateDatabase extends Dexie {
	/** IndexedDB table that stores spring calculation records. */
	calculations!: EntityTable<SpringCalcRecord, "id">;
	/** Sync queue table reserved for hybrid cloud sync mode. */
	syncQueue!: EntityTable<
		{
			id: string;
			createdAt: number;
			nextAttemptAt: number;
			type: string;
			attempts: number;
			payload?: unknown;
		},
		"id"
	>;

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
		this.version(3).stores({
			calculations:
				"id, createdAt, manufacturer, partNumber, [manufacturer+partNumber]",
			syncQueue: "id, createdAt, nextAttemptAt, type, attempts",
		});
	}
}

const DISABLED_STATUS: CloudSyncStatus = { state: "disabled", queuedCount: 0 };

export class IndexedDBBackend implements StorageBackend {
	readonly #db: SpringRateDatabase;

	constructor() {
		this.#db = new SpringRateDatabase();
	}

	async addCalculation(record: SpringCalcRecord): Promise<void> {
		await this.#db.calculations.put(record);
	}

	async listCalculations(): Promise<SpringCalcRecord[]> {
		return this.#db.calculations.orderBy("createdAt").reverse().toArray();
	}

	async deleteCalculation(id: string): Promise<void> {
		await this.#db.calculations.delete(id);
	}

	async bulkDeleteCalculations(ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.#db.calculations.bulkDelete(ids);
	}

	async clearCalculations(): Promise<void> {
		await this.#db.calculations.clear();
	}

	getCloudSyncStatus(): CloudSyncStatus {
		return DISABLED_STATUS;
	}

	subscribeCloudSyncStatus(_listener: CloudSyncListener): () => void {
		return () => {};
	}

	async flushCloudSyncNow(): Promise<void> {
		// No-op for local-only backend.
	}
}
