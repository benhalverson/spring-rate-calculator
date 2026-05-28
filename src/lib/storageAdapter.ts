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
	deleteCalculation(id: string, deletedAt?: number): Promise<void>;
	bulkDeleteCalculations(ids: string[], deletedAt?: number): Promise<void>;
	clearCalculations(deletedAt?: number): Promise<void>;
}

interface SyncAwareBackend {
	getSyncStatus(): SyncStatus;
	subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void;
	triggerBackgroundSync(): Promise<void>;
}

type SyncOperation =
	| { type: "add"; record: SpringCalcRecord }
	| { type: "delete"; id: string; deletedAt: number }
	| { type: "bulkDelete"; ids: string[]; deletedAt: number };

type SyncConflict = {
	id: string;
	winner: SpringCalcRecord;
	loser: SpringCalcRecord;
	reason: string;
};

type SyncResponseData = {
	newSyncTimestamp: number;
	created: SpringCalcRecord[];
	updated: SpringCalcRecord[];
	deleted: string[];
	conflicts: SyncConflict[];
};

type SyncResponseEnvelope =
	| {
			success: true;
			data: SyncResponseData;
	  }
	| {
			success: false;
			error: {
				message: string;
				code?: string;
			};
	  };

const QUEUE_STORAGE_KEY = "spring-rate-sync-queue";
const LAST_SYNC_STORAGE_KEY = "spring-rate-last-synced-at";

const canUseWindow = (): boolean => {
	return typeof window !== "undefined";
};

const isQueuedOperation = (value: unknown): value is SyncOperation => {
	if (typeof value !== "object" || value === null || !("type" in value)) {
		return false;
	}

	const operation = value as {
		type?: unknown;
		record?: unknown;
		id?: unknown;
		ids?: unknown;
		deletedAt?: unknown;
	};

	if (operation.type === "add") {
		return typeof operation.record === "object" && operation.record !== null;
	}

	if (operation.type === "delete") {
		return (
			typeof operation.id === "string" &&
			typeof operation.deletedAt === "number"
		);
	}

	if (operation.type === "bulkDelete") {
		return (
			Array.isArray(operation.ids) &&
			operation.ids.every((id) => typeof id === "string") &&
			typeof operation.deletedAt === "number"
		);
	}

	return false;
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

		return parsed.filter(isQueuedOperation);
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

const readLastSyncedAt = (): number | undefined => {
	if (!canUseWindow()) {
		return undefined;
	}

	try {
		const raw = window.localStorage.getItem(LAST_SYNC_STORAGE_KEY);

		if (!raw) {
			return undefined;
		}

		const parsed = Number(raw);
		return Number.isFinite(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
};

const writeLastSyncedAt = (timestamp?: number): void => {
	if (!canUseWindow()) {
		return;
	}

	try {
		if (timestamp === undefined) {
			window.localStorage.removeItem(LAST_SYNC_STORAGE_KEY);
			return;
		}

		window.localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(timestamp));
	} catch {
		// Ignore storage failures and continue with in-memory state.
	}
};

const dedupeRecords = (records: SpringCalcRecord[]): SpringCalcRecord[] => {
	const byId = new Map<string, SpringCalcRecord>();

	for (const record of records) {
		const existing = byId.get(record.id);

		if (!existing || record.updatedAt >= existing.updatedAt) {
			byId.set(record.id, record);
		}
	}

	return Array.from(byId.values());
};

export class IndexedDBBackend implements StorageBackend {
	private readonly methods: {
		add: (record: SpringCalcRecord) => Promise<void>;
		list: () => Promise<SpringCalcRecord[]>;
		deleteOne: (id: string, deletedAt?: number) => Promise<void>;
		deleteMany: (ids: string[], deletedAt?: number) => Promise<void>;
		clear: (deletedAt?: number) => Promise<void>;
	};

	constructor(methods: {
		add: (record: SpringCalcRecord) => Promise<void>;
		list: () => Promise<SpringCalcRecord[]>;
		deleteOne: (id: string, deletedAt?: number) => Promise<void>;
		deleteMany: (ids: string[], deletedAt?: number) => Promise<void>;
		clear: (deletedAt?: number) => Promise<void>;
	}) {
		this.methods = methods;
	}

	addCalculation(record: SpringCalcRecord): Promise<void> {
		return this.methods.add(record);
	}

	listCalculations(): Promise<SpringCalcRecord[]> {
		return this.methods.list();
	}

	deleteCalculation(id: string, deletedAt?: number): Promise<void> {
		return this.methods.deleteOne(id, deletedAt);
	}

	bulkDeleteCalculations(ids: string[], deletedAt?: number): Promise<void> {
		return this.methods.deleteMany(ids, deletedAt);
	}

	clearCalculations(deletedAt?: number): Promise<void> {
		return this.methods.clear(deletedAt);
	}
}

export class HybridBackend implements StorageBackend, SyncAwareBackend {
	private readonly localBackend: StorageBackend;
	private readonly syncEndpoint: string;
	private readonly listeners = new Set<(status: SyncStatus) => void>();
	private readonly queue: SyncOperation[];

	private status: SyncStatus;
	private syncPromise: Promise<void> | null = null;

	constructor(localBackend: StorageBackend, syncEndpoint = "/api/v1/sync") {
		this.localBackend = localBackend;
		this.syncEndpoint = syncEndpoint;
		this.queue = readQueuedOperations();

		writeQueuedOperations(this.queue);

		const lastSyncedAt = readLastSyncedAt();

		this.status = {
			state: this.queue.length > 0 ? "queued" : "idle",
			pending: this.queue.length,
			lastSyncedAt,
		};

		if (canUseWindow()) {
			window.addEventListener("online", () => {
				void this.triggerBackgroundSync();
			});
		}

		void this.triggerBackgroundSync();
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener(this.status);
		}
	}

	private setStatus(next: SyncStatus): void {
		this.status = next;
		writeLastSyncedAt(next.lastSyncedAt);
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

	private async readSyncResponse(
		response: Response,
	): Promise<SyncResponseData> {
		let body: SyncResponseEnvelope | null = null;

		try {
			body = (await response.json()) as SyncResponseEnvelope;
		} catch {
			body = null;
		}

		if (!response.ok) {
			if (body && !body.success) {
				throw new Error(body.error.message);
			}

			throw new Error(`Sync failed with status ${response.status}`);
		}

		if (!body?.success) {
			throw new Error("Sync response had an unexpected format.");
		}

		return body.data;
	}

	private async applySyncResponse(data: SyncResponseData): Promise<void> {
		const conflictWinners = data.conflicts.map((conflict) => conflict.winner);

		const recordsToUpsert = dedupeRecords([
			...data.created,
			...data.updated,
			...conflictWinners,
		]);

		for (const record of recordsToUpsert) {
			await this.localBackend.addCalculation(record);
		}

		if (data.deleted.length > 0) {
			await this.localBackend.bulkDeleteCalculations(data.deleted);
		}
	}

	private isOnline(): boolean {
		if (!canUseWindow()) {
			return false;
		}

		return window.navigator.onLine;
	}

	triggerBackgroundSync(): Promise<void> {
		if (this.syncPromise) {
			return this.syncPromise;
		}

		if (!this.isOnline()) {
			if (this.queue.length > 0) {
				this.setStatus({
					state: "queued",
					pending: this.queue.length,
					lastSyncedAt: this.status.lastSyncedAt,
				});
			}
			return Promise.resolve();
		}

		this.syncPromise = new Promise((resolve) => {
			setTimeout(() => {
				void this.flushQueue().finally(() => {
					this.syncPromise = null;
					resolve();
				});
			}, 250);
		});

		return this.syncPromise;
	}

	private async flushQueue(): Promise<void> {
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

			const syncResponse = await this.readSyncResponse(response);

			await this.applySyncResponse(syncResponse);

			this.queue.splice(0, batch.length);
			writeQueuedOperations(this.queue);

			this.setStatus({
				state: this.queue.length > 0 ? "queued" : "idle",
				pending: this.queue.length,
				lastSyncedAt: syncResponse.newSyncTimestamp,
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
		const deletedAt = Date.now();
		await this.localBackend.deleteCalculation(id, deletedAt);
		this.enqueue({ type: "delete", id, deletedAt });
	}

	async bulkDeleteCalculations(ids: string[]): Promise<void> {
		const deletedAt = Date.now();
		await this.localBackend.bulkDeleteCalculations(ids, deletedAt);

		if (ids.length > 0) {
			this.enqueue({ type: "bulkDelete", ids: [...ids], deletedAt });
		}
	}

	async clearCalculations(): Promise<void> {
		const records = await this.localBackend.listCalculations();
		const deletedAt = Date.now();

		await this.localBackend.clearCalculations(deletedAt);

		const ids = records.map((record) => record.id);

		if (ids.length > 0) {
			this.enqueue({ type: "bulkDelete", ids, deletedAt });
		}
	}
}

export const createDisabledSyncStatus = (): SyncStatus => ({
	state: "disabled",
	pending: 0,
});
