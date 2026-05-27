import Dexie, { type EntityTable } from "dexie";

import type { CloudSyncListener, CloudSyncStatus } from "../../types/cloudSync";
import type { SpringCalcRecord } from "../../types/spring";
import { getCloudSyncUrl } from "../env";
import type { StorageBackend } from "./StorageBackend";

type SyncOperationType = "put" | "delete" | "bulkDelete" | "clear";

interface SyncQueueEntry {
	id: string;
	createdAt: number;
	type: SyncOperationType;
	attempts: number;
	nextAttemptAt: number;
	payload?: unknown;
}

class HybridDatabase extends Dexie {
	calculations!: EntityTable<SpringCalcRecord, "id">;
	syncQueue!: EntityTable<SyncQueueEntry, "id">;

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

const makeId = (): string => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `sync-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const computeBackoffMs = (attempts: number): number => {
	const cappedAttempts = clamp(attempts, 0, 8);
	const base = 1000 * 2 ** cappedAttempts;
	const jitter = Math.floor(Math.random() * 250);
	return clamp(base + jitter, 1000, 60_000);
};

export class HybridBackend implements StorageBackend {
	readonly #db: HybridDatabase;
	readonly #listeners = new Set<CloudSyncListener>();
	#status: CloudSyncStatus = { state: "idle", queuedCount: 0 };
	#flushTimer: number | undefined;
	#flushInFlight: Promise<void> | null = null;

	constructor() {
		this.#db = new HybridDatabase();

		if (typeof window !== "undefined") {
			window.addEventListener("online", this.#handleOnline);
			void this.#refreshQueuedCount();
			this.#scheduleFlush();
		}
	}

	destroy(): void {
		if (typeof window !== "undefined") {
			window.removeEventListener("online", this.#handleOnline);
		}
		if (this.#flushTimer !== undefined) {
			window.clearTimeout(this.#flushTimer);
		}
		this.#listeners.clear();
	}

	#handleOnline = () => {
		this.#scheduleFlush(0);
	};

	getCloudSyncStatus(): CloudSyncStatus {
		return this.#status;
	}

	subscribeCloudSyncStatus(listener: CloudSyncListener): () => void {
		this.#listeners.add(listener);
		listener(this.#status);
		return () => {
			this.#listeners.delete(listener);
		};
	}

	#setStatus(next: CloudSyncStatus): void {
		this.#status = next;
		for (const listener of this.#listeners) {
			listener(next);
		}
	}

	async addCalculation(record: SpringCalcRecord): Promise<void> {
		await this.#db.calculations.put(record);
		await this.#enqueue("put", record);
	}

	async listCalculations(): Promise<SpringCalcRecord[]> {
		return this.#db.calculations.orderBy("createdAt").reverse().toArray();
	}

	async deleteCalculation(id: string): Promise<void> {
		await this.#db.calculations.delete(id);
		await this.#enqueue("delete", { id });
	}

	async bulkDeleteCalculations(ids: string[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.#db.calculations.bulkDelete(ids);
		await this.#enqueue("bulkDelete", { ids: [...ids] });
	}

	async clearCalculations(): Promise<void> {
		await this.#db.calculations.clear();
		await this.#enqueue("clear", {});
	}

	async flushCloudSyncNow(): Promise<void> {
		await this.#flushQueue();
	}

	async #enqueue(type: SyncOperationType, payload: unknown): Promise<void> {
		const now = Date.now();
		await this.#db.syncQueue.add({
			id: makeId(),
			createdAt: now,
			type,
			attempts: 0,
			nextAttemptAt: now,
			payload,
		});
		await this.#refreshQueuedCount();
		this.#scheduleFlush(0);
	}

	async #refreshQueuedCount(): Promise<void> {
		const count = await this.#db.syncQueue.count();
		this.#setStatus({
			...this.#status,
			queuedCount: count,
		});
	}

	#scheduleFlush(delayMs?: number): void {
		if (typeof window === "undefined") {
			return;
		}

		if (this.#flushTimer !== undefined) {
			window.clearTimeout(this.#flushTimer);
			this.#flushTimer = undefined;
		}

		const schedule = async () => {
			const next = await this.#db.syncQueue
				.orderBy("nextAttemptAt")
				.first()
				.catch(() => undefined);
			const nextAt = next?.nextAttemptAt;
			if (nextAt === undefined) {
				return;
			}
			const waitMs =
				delayMs !== undefined ? delayMs : Math.max(0, nextAt - Date.now());
			this.#flushTimer = window.setTimeout(() => {
				void this.#flushQueue();
			}, waitMs);
		};

		void schedule();
	}

	async #flushQueue(): Promise<void> {
		if (this.#flushInFlight) {
			return this.#flushInFlight;
		}

		this.#flushInFlight = (async () => {
			const url = getCloudSyncUrl();
			if (!url) {
				this.#setStatus({
					...this.#status,
					state: "error",
					lastError: "Cloud sync URL is not configured.",
				});
				return;
			}

			if (typeof navigator !== "undefined" && !navigator.onLine) {
				return;
			}

			const dueEntries = await this.#db.syncQueue
				.where("nextAttemptAt")
				.belowOrEqual(Date.now())
				.sortBy("createdAt");

			if (dueEntries.length === 0) {
				this.#setStatus({ ...this.#status, state: "idle" });
				return;
			}

			this.#setStatus({
				...this.#status,
				state: "syncing",
				lastError: undefined,
			});

			try {
				const response = await fetch(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ operations: dueEntries }),
				});

				if (!response.ok) {
					throw new Error(`Cloud sync failed with status ${response.status}`);
				}

				await this.#db.syncQueue.bulkDelete(
					dueEntries.map((entry) => entry.id),
				);
				await this.#refreshQueuedCount();
				this.#setStatus({
					...this.#status,
					state: "idle",
					lastError: undefined,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				const now = Date.now();
				for (const entry of dueEntries) {
					const attempts = entry.attempts + 1;
					const backoff = computeBackoffMs(attempts);
					await this.#db.syncQueue.update(entry.id, {
						attempts,
						nextAttemptAt: now + backoff,
					});
				}
				const nextAttemptAt =
					now + computeBackoffMs(dueEntries[0]?.attempts ?? 0);
				await this.#refreshQueuedCount();
				this.#setStatus({
					...this.#status,
					state: "backoff",
					lastError: message,
					nextAttemptAt,
				});
			} finally {
				this.#scheduleFlush();
			}
		})().finally(() => {
			this.#flushInFlight = null;
		});

		return this.#flushInFlight;
	}
}
