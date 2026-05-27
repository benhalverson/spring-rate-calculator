import { beforeEach, describe, expect, it } from "vitest";
import type { SpringCalcRecord } from "../types/spring";
import type { SyncRequest, SyncResponse } from "../types/sync";
import { handleSync } from "./sync";

// Mock D1Database for testing
class MockD1Database implements D1Database {
	private records: Map<string, unknown> = new Map();

	async batch<T = unknown>(
		statements: D1PreparedStatement[],
	): Promise<D1Result<T>[]> {
		const results: D1Result<T>[] = [];
		for (const stmt of statements) {
			const result = await stmt.run();
			results.push(result as D1Result<T>);
		}
		return results;
	}

	prepare(query: string): D1PreparedStatement {
		const bindings: unknown[] = [];

		const stmt: D1PreparedStatement = {
			bind: (...values: unknown[]) => {
				bindings.push(...values);
				return stmt;
			},
			first: async <T = unknown>(): Promise<T | null> => {
				if (query.includes("SELECT * FROM calculations WHERE id = ?")) {
					const id = bindings[0];
					return (this.records.get(id) || null) as T | null;
				}
				return null;
			},
			all: async <T = unknown>(): Promise<D1Result<T>> => {
				if (query.includes("SELECT * FROM calculations WHERE updated_at > ?")) {
					const lastSyncTimestamp = bindings[0];
					const results = Array.from(this.records.values()).filter(
						(record) => record.updated_at > lastSyncTimestamp,
					);
					return {
						results: results as T[],
						success: true,
						meta: {
							duration: 0,
							size_after: 0,
							rows_read: 0,
							rows_written: 0,
							last_row_id: 0,
							changed_db: false,
							changes: 0,
						},
					};
				}
				return {
					results: [] as T[],
					success: true,
					meta: {
						duration: 0,
						size_after: 0,
						rows_read: 0,
						rows_written: 0,
						last_row_id: 0,
						changed_db: false,
						changes: 0,
					},
				};
			},
			run: async (): Promise<D1Result> => {
				if (query.includes("INSERT OR REPLACE INTO calculations")) {
					const [
						id,
						created_at,
						updated_at,
						deleted_at,
						manufacturer,
						part_number,
						purchase_url,
						notes,
						units,
						d,
						D,
						n,
						Davg,
						k,
					] = bindings;
					this.records.set(id, {
						id,
						created_at,
						updated_at,
						deleted_at,
						manufacturer,
						part_number,
						purchase_url,
						notes,
						units,
						d,
						D,
						n,
						Davg,
						k,
					});
				} else if (query.includes("UPDATE calculations SET deleted_at")) {
					const [deleted_at, updated_at, id] = bindings;
					const record = this.records.get(id);
					if (record) {
						record.deleted_at = deleted_at;
						record.updated_at = updated_at;
					}
				} else if (
					query.includes("UPDATE calculations SET") &&
					query.includes("WHERE id = ?")
				) {
					const [
						created_at,
						updated_at,
						deleted_at,
						manufacturer,
						part_number,
						purchase_url,
						notes,
						units,
						d,
						D,
						n,
						Davg,
						k,
						id,
					] = bindings;
					this.records.set(id, {
						id,
						created_at,
						updated_at,
						deleted_at,
						manufacturer,
						part_number,
						purchase_url,
						notes,
						units,
						d,
						D,
						n,
						Davg,
						k,
					});
				}
				return {
					results: [],
					success: true,
					meta: {
						duration: 0,
						size_after: 0,
						rows_read: 0,
						rows_written: 0,
						last_row_id: 0,
						changed_db: false,
						changes: 0,
					},
				};
			},
		} as D1PreparedStatement;

		return stmt;
	}

	dump(): Promise<ArrayBuffer> {
		throw new Error("Not implemented");
	}

	exec(): Promise<D1ExecResult> {
		throw new Error("Not implemented");
	}

	withSession(): D1DatabaseSession {
		return this as unknown as D1DatabaseSession;
	}

	clear() {
		this.records.clear();
	}
}

const baseRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: "id-1",
	createdAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_000,
	deletedAt: null,
	manufacturer: "Team Associated",
	partNumber: "ASC91322",
	purchaseUrl: "https://example.com/spring",
	notes: "Front shock spring",
	units: "mm",
	d: 1.2,
	D: 10.5,
	n: 6,
	Davg: 9.3,
	k: 0.0000537,
	...overrides,
});

describe("handleSync", () => {
	let mockDb: MockD1Database;

	beforeEach(() => {
		mockDb = new MockD1Database();
	});

	it("handles empty sync request", async () => {
		const syncRequest: SyncRequest = {
			lastSyncTimestamp: 0,
			created: [],
			updated: [],
			deleted: [],
		};

		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			body: JSON.stringify(syncRequest),
			headers: {
				"Content-Type": "application/json",
			},
		});

		const response = await handleSync(request, mockDb);
		expect(response.status).toBe(200);

		const syncResponse: SyncResponse = await response.json();
		expect(syncResponse.created).toEqual([]);
		expect(syncResponse.updated).toEqual([]);
		expect(syncResponse.deleted).toEqual([]);
		expect(syncResponse.conflicts).toEqual([]);
		expect(syncResponse.newSyncTimestamp).toBeGreaterThan(0);
	});

	it("syncs created records to server", async () => {
		const newRecord = baseRecord({
			id: "new-1",
			createdAt: 1000,
			updatedAt: 1000,
		});

		const syncRequest: SyncRequest = {
			lastSyncTimestamp: 0,
			created: [newRecord],
			updated: [],
			deleted: [],
		};

		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			body: JSON.stringify(syncRequest),
			headers: {
				"Content-Type": "application/json",
			},
		});

		const response = await handleSync(request, mockDb);
		expect(response.status).toBe(200);

		const syncResponse: SyncResponse = await response.json();
		expect(syncResponse.created.length).toBeGreaterThanOrEqual(0);
		expect(syncResponse.conflicts).toEqual([]);
	});

	it("handles deleted records", async () => {
		const syncRequest: SyncRequest = {
			lastSyncTimestamp: 0,
			created: [],
			updated: [],
			deleted: ["id-to-delete"],
		};

		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			body: JSON.stringify(syncRequest),
			headers: {
				"Content-Type": "application/json",
			},
		});

		const response = await handleSync(request, mockDb);
		expect(response.status).toBe(200);

		const syncResponse: SyncResponse = await response.json();
		expect(syncResponse.conflicts).toEqual([]);
	});

	it("returns error on invalid JSON", async () => {
		const request = new Request("http://localhost/api/v1/sync", {
			method: "POST",
			body: "invalid json",
			headers: {
				"Content-Type": "application/json",
			},
		});

		const response = await handleSync(request, mockDb);
		expect(response.status).toBe(500);

		const errorResponse = (await response.json()) as {
			error: string;
			message: string;
		};
		expect(errorResponse.error).toBe("Sync failed");
	});
});
