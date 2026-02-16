import type { SpringCalcRecord } from "../types/spring";

export type SyncState = "disabled" | "idle" | "queued" | "syncing" | "error";

export interface SyncStatus {
	state: SyncState;
	pending: number;
	lastSyncedAt?: number;
	lastError?: string;
}

export interface StorageBackend {
	addCalculation(record: SpringCalcRecord): Promise<void>;
	listCalculations(): Promise<SpringCalcRecord[]>;
	deleteCalculation(id: string): Promise<void>;
	bulkDeleteCalculations(ids: string[]): Promise<void>;
	clearCalculations(): Promise<void>;
}

interface SyncAwareBackend {
	getSyncStatus(): SyncStatus;
	subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void;
	triggerBackgroundSync(): Promise<void>;
}

type SyncOperation =
	| { type: "add"; record: SpringCalcRecord }
	| { type: "delete"; id: string }
	| { type: "bulkDelete"; ids: string[] }
	| { type: "clear" };

const QUEUE_STORAGE_KEY = "spring-rate-sync-queue";

const canUseWindow = (): boolean => {
	return typeof window !== "undefined";
};

const readQueuedOperations = (): SyncOperation[] => {
	if (!canUseWindow()) {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed as SyncOperation[];
	} catch {
		return [];
	}
};

const writeQueuedOperations = (operations: SyncOperation[]): void => {
	if (!canUseWindow()) {
		return;
	}

	try {
		window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(operations));
	} catch {
		// Ignore storage failures and continue with in-memory queue.
	}
};

export class IndexedDBBackend implements StorageBackend {
	private readonly methods: {
		add: (record: SpringCalcRecord) => Promise<void>;
		list: () => Promise<SpringCalcRecord[]>;
		deleteOne: (id: string) => Promise<void>;
		deleteMany: (ids: string[]) => Promise<void>;
		clear: () => Promise<void>;
	};

	constructor(methods: {
		add: (record: SpringCalcRecord) => Promise<void>;
		list: () => Promise<SpringCalcRecord[]>;
		deleteOne: (id: string) => Promise<void>;
		deleteMany: (ids: string[]) => Promise<void>;
		clear: () => Promise<void>;
	}) {
		this.methods = methods;
	}

	addCalculation(record: SpringCalcRecord): Promise<void> {
		return this.methods.add(record);
	}

	listCalculations(): Promise<SpringCalcRecord[]> {
		return this.methods.list();
	}

	deleteCalculation(id: string): Promise<void> {
		return this.methods.deleteOne(id);
	}

	bulkDeleteCalculations(ids: string[]): Promise<void> {
		return this.methods.deleteMany(ids);
	}

	clearCalculations(): Promise<void> {
		return this.methods.clear();
	}
}

export class HybridBackend implements StorageBackend, SyncAwareBackend {
	private readonly localBackend: StorageBackend;
	private readonly syncEndpoint: string;
	private readonly listeners = new Set<(status: SyncStatus) => void>();
	private readonly queue: SyncOperation[];
	private status: SyncStatus;
	private syncTimer: number | null = null;

	constructor(localBackend: StorageBackend, syncEndpoint = "/api/v1/sync") {
		this.localBackend = localBackend;
		this.syncEndpoint = syncEndpoint;
		this.queue = readQueuedOperations();
		this.status = {
			state: this.queue.length > 0 ? "queued" : "idle",
			pending: this.queue.length,
		};

		if (canUseWindow()) {
			window.addEventListener("online", () => {
				void this.triggerBackgroundSync();
			});
		}

		if (this.queue.length > 0) {
			void this.triggerBackgroundSync();
		}
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener(this.status);
		}
	}

	private setStatus(next: SyncStatus): void {
		this.status = next;
		this.notify();
	}

	private enqueue(operation: SyncOperation): void {
		this.queue.push(operation);
		writeQueuedOperations(this.queue);
		this.setStatus({
			state: "queued",
			pending: this.queue.length,
			lastSyncedAt: this.status.lastSyncedAt,
		});
		void this.triggerBackgroundSync();
	}

	private isOnline(): boolean {
		if (!canUseWindow()) {
			return false;
		}
		return window.navigator.onLine;
	}

	async triggerBackgroundSync(): Promise<void> {
		if (this.syncTimer !== null) {
			return;
		}
		if (this.queue.length === 0 || !this.isOnline()) {
			return;
		}

		this.syncTimer = window.setTimeout(() => {
			this.syncTimer = null;
			void this.flushQueue();
		}, 250);
	}

	private async flushQueue(): Promise<void> {
		if (this.queue.length === 0) {
			this.setStatus({
				state: "idle",
				pending: 0,
				lastSyncedAt: this.status.lastSyncedAt,
			});
			return;
		}

		if (!this.isOnline()) {
			this.setStatus({
				state: "queued",
				pending: this.queue.length,
				lastSyncedAt: this.status.lastSyncedAt,
			});
			return;
		}

		const batch = [...this.queue];
		this.setStatus({
			state: "syncing",
			pending: batch.length,
			lastSyncedAt: this.status.lastSyncedAt,
		});

		try {
			const response = await fetch(this.syncEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					changes: batch,
					lastSyncTimestamp: this.status.lastSyncedAt ?? null,
				}),
			});

			if (!response.ok) {
				throw new Error(`Sync failed with status ${response.status}`);
			}

			this.queue.splice(0, batch.length);
			writeQueuedOperations(this.queue);

			const syncedAt = Date.now();
			this.setStatus({
				state: this.queue.length > 0 ? "queued" : "idle",
				pending: this.queue.length,
				lastSyncedAt: syncedAt,
			});

			if (this.queue.length > 0) {
				void this.triggerBackgroundSync();
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to sync queued changes.";
			this.setStatus({
				state: "error",
				pending: this.queue.length,
				lastSyncedAt: this.status.lastSyncedAt,
				lastError: message,
			});
		}
	}

	getSyncStatus(): SyncStatus {
		return this.status;
	}

	subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
		this.listeners.add(listener);
		listener(this.status);
		return () => {
			this.listeners.delete(listener);
		};
	}

	async addCalculation(record: SpringCalcRecord): Promise<void> {
		await this.localBackend.addCalculation(record);
		this.enqueue({ type: "add", record });
	}

	listCalculations(): Promise<SpringCalcRecord[]> {
		return this.localBackend.listCalculations();
	}

	async deleteCalculation(id: string): Promise<void> {
		await this.localBackend.deleteCalculation(id);
		this.enqueue({ type: "delete", id });
	}

	async bulkDeleteCalculations(ids: string[]): Promise<void> {
		await this.localBackend.bulkDeleteCalculations(ids);
		if (ids.length > 0) {
			this.enqueue({ type: "bulkDelete", ids: [...ids] });
		}
	}

	async clearCalculations(): Promise<void> {
		await this.localBackend.clearCalculations();
		this.enqueue({ type: "clear" });
	}
}

export const createDisabledSyncStatus = (): SyncStatus => ({
	state: "disabled",
	pending: 0,
});
