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

export type SyncOperation =
	| { type: "add"; record: SpringCalcRecord }
	| { type: "delete"; id: string; deletedAt: number }
	| { type: "bulkDelete"; ids: string[]; deletedAt: number };

export interface SyncPersistence {
	readQueue(): Promise<unknown[]>;
	writeQueue(operations: SyncOperation[]): Promise<void>;
	readLastSyncedAt(): Promise<number | undefined>;
	writeLastSyncedAt(timestamp: number): Promise<void>;
}

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

const canUseWindow = (): boolean => {
	return typeof window !== "undefined";
};

const createMemorySyncPersistence = (): SyncPersistence => {
	let queue: SyncOperation[] = [];
	let lastSyncedAt: number | undefined;

	return {
		readQueue: async () => [...queue],
		writeQueue: async (operations) => {
			queue = [...operations];
		},
		readLastSyncedAt: async () => lastSyncedAt,
		writeLastSyncedAt: async (timestamp) => {
			lastSyncedAt = timestamp;
		},
	};
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === "string";

const readOptionalString = (value: unknown): string | undefined => {
	if (value === undefined) {
		return undefined;
	}

	return isString(value) ? value : undefined;
};

const normalizeQueuedRecord = (value: unknown): SpringCalcRecord | null => {
	if (!isObject(value)) {
		return null;
	}

	const {
		id,
		createdAt,
		updatedAt,
		deletedAt,
		manufacturer,
		partNumber,
		purchaseUrl,
		notes,
		units,
		d,
		D,
		n,
		Davg,
		k,
	} = value;

	if (
		!isString(id) ||
		!isNumber(createdAt) ||
		!isString(manufacturer) ||
		!isString(partNumber) ||
		(units !== "mm" && units !== "in") ||
		!isNumber(d) ||
		!isNumber(D) ||
		!isNumber(n) ||
		!isNumber(Davg) ||
		!isNumber(k)
	) {
		return null;
	}

	const normalizedPurchaseUrl = readOptionalString(purchaseUrl);
	const normalizedNotes = readOptionalString(notes);

	if (
		(purchaseUrl !== undefined && normalizedPurchaseUrl === undefined) ||
		(notes !== undefined && normalizedNotes === undefined)
	) {
		return null;
	}

	if (deletedAt !== undefined && deletedAt !== null && !isNumber(deletedAt)) {
		return null;
	}

	return {
		id,
		createdAt,
		updatedAt: isNumber(updatedAt) ? updatedAt : createdAt,
		deletedAt: deletedAt === undefined ? null : deletedAt,
		manufacturer,
		partNumber,
		...(normalizedPurchaseUrl === undefined
			? {}
			: { purchaseUrl: normalizedPurchaseUrl }),
		...(normalizedNotes === undefined ? {} : { notes: normalizedNotes }),
		units,
		d,
		D,
		n,
		Davg,
		k,
	};
};

const normalizeQueuedOperation = (value: unknown): SyncOperation | null => {
	if (typeof value !== "object" || value === null || !("type" in value)) {
		return null;
	}

	const operation = value as {
		type?: unknown;
		record?: unknown;
		id?: unknown;
		ids?: unknown;
		deletedAt?: unknown;
	};

	if (operation.type === "add") {
		const record = normalizeQueuedRecord(operation.record);
		return record ? { type: "add", record } : null;
	}

	if (operation.type === "delete") {
		if (!isString(operation.id)) {
			return null;
		}

		return {
			type: "delete",
			id: operation.id,
			deletedAt: isNumber(operation.deletedAt)
				? operation.deletedAt
				: Date.now(),
		};
	}

	if (operation.type === "bulkDelete") {
		if (
			!Array.isArray(operation.ids) ||
			operation.ids.length === 0 ||
			!operation.ids.every(isString)
		) {
			return null;
		}

		return {
			type: "bulkDelete",
			ids: operation.ids,
			deletedAt: isNumber(operation.deletedAt)
				? operation.deletedAt
				: Date.now(),
		};
	}

	return null;
};

const normalizeQueuedOperations = (values: unknown[]): SyncOperation[] => {
	return values.flatMap((value) => {
		const operation = normalizeQueuedOperation(value);
		return operation ? [operation] : [];
	});
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
	private readonly persistence: SyncPersistence;
	private readonly ready: Promise<void>;
	private readonly listeners = new Set<(status: SyncStatus) => void>();
	private readonly queue: SyncOperation[] = [];

	private status: SyncStatus;
	private syncPromise: Promise<void> | null = null;

	constructor(
		localBackend: StorageBackend,
		syncEndpoint = "/api/v1/sync",
		persistence: SyncPersistence = createMemorySyncPersistence(),
	) {
		this.localBackend = localBackend;
		this.syncEndpoint = syncEndpoint;
		this.persistence = persistence;

		this.status = {
			state: "idle",
			pending: 0,
		};
		this.ready = this.loadSyncState();

		if (canUseWindow()) {
			window.addEventListener("online", () => {
				void this.triggerBackgroundSync();
			});
		}

		void this.triggerBackgroundSync();
	}

	private async loadSyncState(): Promise<void> {
		try {
			const [storedQueue, lastSyncedAt] = await Promise.all([
				this.persistence.readQueue(),
				this.persistence.readLastSyncedAt(),
			]);
			const queue = normalizeQueuedOperations(storedQueue);
			this.queue.splice(0, this.queue.length, ...queue);
			await this.persistence.writeQueue(this.queue);

			this.setStatus({
				state: this.queue.length > 0 ? "queued" : "idle",
				pending: this.queue.length,
				lastSyncedAt,
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load sync state.";

			this.setStatus({
				state: "error",
				pending: this.queue.length,
				lastSyncedAt: this.status.lastSyncedAt,
				lastError: message,
			});
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

	private async enqueue(operation: SyncOperation): Promise<void> {
		await this.ready;
		this.queue.push(operation);
		await this.persistence.writeQueue(this.queue);

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

		this.syncPromise = this.runBackgroundSync().finally(() => {
			this.syncPromise = null;
		});

		return this.syncPromise;
	}

	private async runBackgroundSync(): Promise<void> {
		await this.ready;

		if (!this.isOnline()) {
			if (this.queue.length > 0) {
				this.setStatus({
					state: "queued",
					pending: this.queue.length,
					lastSyncedAt: this.status.lastSyncedAt,
				});
			}
			return;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 250);
		});
		await this.flushQueue();
	}

	private async flushQueue(): Promise<void> {
		await this.ready;

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
			await Promise.all([
				this.persistence.writeQueue(this.queue),
				this.persistence.writeLastSyncedAt(syncResponse.newSyncTimestamp),
			]);

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
		await this.enqueue({ type: "add", record });
	}

	listCalculations(): Promise<SpringCalcRecord[]> {
		return this.localBackend.listCalculations();
	}

	async deleteCalculation(id: string): Promise<void> {
		const deletedAt = Date.now();
		await this.localBackend.deleteCalculation(id, deletedAt);
		await this.enqueue({ type: "delete", id, deletedAt });
	}

	async bulkDeleteCalculations(ids: string[]): Promise<void> {
		const deletedAt = Date.now();
		await this.localBackend.bulkDeleteCalculations(ids, deletedAt);

		if (ids.length > 0) {
			await this.enqueue({ type: "bulkDelete", ids: [...ids], deletedAt });
		}
	}

	async clearCalculations(): Promise<void> {
		const records = await this.localBackend.listCalculations();
		const deletedAt = Date.now();

		await this.localBackend.clearCalculations(deletedAt);

		const ids = records.map((record) => record.id);

		if (ids.length > 0) {
			await this.enqueue({ type: "bulkDelete", ids, deletedAt });
		}
	}
}

export const createDisabledSyncStatus = (): SyncStatus => ({
	state: "disabled",
	pending: 0,
});
