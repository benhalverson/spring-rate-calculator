import type { SpringCalcRecord } from "../types/spring";
import type {
	ConflictResolution,
	SyncRequest,
	SyncResponse,
} from "../types/sync";

/**
 * Server-side record stored in D1 database.
 */
interface DbRecord {
	id: string;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
	manufacturer: string;
	part_number: string;
	purchase_url: string | null;
	notes: string | null;
	units: string;
	d: number;
	D: number;
	n: number;
	Davg: number;
	k: number;
}

/**
 * Converts a client SpringCalcRecord to database format.
 */
function toDbRecord(record: SpringCalcRecord): DbRecord {
	return {
		id: record.id,
		created_at: record.createdAt,
		updated_at: record.updatedAt,
		deleted_at: record.deletedAt,
		manufacturer: record.manufacturer,
		part_number: record.partNumber,
		purchase_url: record.purchaseUrl || null,
		notes: record.notes || null,
		units: record.units,
		d: record.d,
		D: record.D,
		n: record.n,
		Davg: record.Davg,
		k: record.k,
	};
}

/**
 * Converts a database record to client SpringCalcRecord format.
 */
function toClientRecord(dbRecord: DbRecord): SpringCalcRecord {
	return {
		id: dbRecord.id,
		createdAt: dbRecord.created_at,
		updatedAt: dbRecord.updated_at,
		deletedAt: dbRecord.deleted_at,
		manufacturer: dbRecord.manufacturer,
		partNumber: dbRecord.part_number,
		purchaseUrl: dbRecord.purchase_url || undefined,
		notes: dbRecord.notes || undefined,
		units: dbRecord.units as "mm" | "in",
		d: dbRecord.d,
		D: dbRecord.D,
		n: dbRecord.n,
		Davg: dbRecord.Davg,
		k: dbRecord.k,
	};
}

/**
 * Implements last-write-wins conflict resolution.
 * Returns the record with the latest updatedAt timestamp.
 */
function resolveConflict(
	clientRecord: SpringCalcRecord,
	serverRecord: SpringCalcRecord,
): ConflictResolution {
	const winner =
		clientRecord.updatedAt > serverRecord.updatedAt
			? clientRecord
			: serverRecord;
	const loser =
		clientRecord.updatedAt > serverRecord.updatedAt
			? serverRecord
			: clientRecord;

	return {
		id: clientRecord.id,
		winner,
		loser,
		reason: `Last-write-wins: ${winner === clientRecord ? "client" : "server"} version (${winner.updatedAt}) is newer than ${winner === clientRecord ? "server" : "client"} version (${loser.updatedAt})`,
	};
}

/**
 * Handles POST /api/v1/sync endpoint for offline sync with conflict resolution.
 */
export async function handleSync(
	request: Request,
	db: D1Database,
): Promise<Response> {
	try {
		// Parse request body
		const syncRequest: SyncRequest = await request.json();
		const { lastSyncTimestamp, created, updated, deleted } = syncRequest;

		const conflicts: ConflictResolution[] = [];
		const newSyncTimestamp = Date.now();

		// Check for conflicts before applying changes
		const recordsToApply: SpringCalcRecord[] = [];

		for (const record of updated) {
			const existingResult = await db
				.prepare(`SELECT * FROM calculations WHERE id = ?`)
				.bind(record.id)
				.first<DbRecord>();

			if (existingResult && existingResult.updated_at > record.updatedAt) {
				// Conflict: server has newer version
				const existingRecord = toClientRecord(existingResult);
				const conflict = resolveConflict(record, existingRecord);
				conflicts.push(conflict);
				recordsToApply.push(conflict.winner);
			} else {
				// No conflict or client has newer version
				recordsToApply.push(record);
			}
		}

		// Use a transaction for atomicity
		await db.batch([
			// Process created records
			...created.map((record) => {
				const dbRecord = toDbRecord(record);
				return db
					.prepare(
						`INSERT OR REPLACE INTO calculations 
          (id, created_at, updated_at, deleted_at, manufacturer, part_number, purchase_url, notes, units, d, D, n, Davg, k)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						dbRecord.id,
						dbRecord.created_at,
						dbRecord.updated_at,
						dbRecord.deleted_at,
						dbRecord.manufacturer,
						dbRecord.part_number,
						dbRecord.purchase_url,
						dbRecord.notes,
						dbRecord.units,
						dbRecord.d,
						dbRecord.D,
						dbRecord.n,
						dbRecord.Davg,
						dbRecord.k,
					);
			}),

			// Process updated records (after conflict resolution)
			...recordsToApply.map((record) => {
				const dbRecord = toDbRecord(record);
				return db
					.prepare(
						`INSERT OR REPLACE INTO calculations 
          (id, created_at, updated_at, deleted_at, manufacturer, part_number, purchase_url, notes, units, d, D, n, Davg, k)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						dbRecord.id,
						dbRecord.created_at,
						dbRecord.updated_at,
						dbRecord.deleted_at,
						dbRecord.manufacturer,
						dbRecord.part_number,
						dbRecord.purchase_url,
						dbRecord.notes,
						dbRecord.units,
						dbRecord.d,
						dbRecord.D,
						dbRecord.n,
						dbRecord.Davg,
						dbRecord.k,
					);
			}),

			// Process deleted records (soft delete with existence check)
			...deleted.map((id) => {
				return db
					.prepare(
						`UPDATE calculations SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
					)
					.bind(newSyncTimestamp, newSyncTimestamp, id);
			}),
		]);

		// Fetch server-side changes since lastSyncTimestamp
		const serverChangesResult = await db
			.prepare(
				`SELECT * FROM calculations WHERE updated_at > ? ORDER BY updated_at ASC`,
			)
			.bind(lastSyncTimestamp)
			.all<DbRecord>();

		const serverChanges = serverChangesResult.results || [];

		// Separate server changes into created, updated, deleted
		const serverCreated: SpringCalcRecord[] = [];
		const serverUpdated: SpringCalcRecord[] = [];
		const serverDeleted: string[] = [];

		for (const dbRecord of serverChanges) {
			const clientRecord = toClientRecord(dbRecord);

			if (
				dbRecord.deleted_at !== null &&
				dbRecord.deleted_at > lastSyncTimestamp
			) {
				serverDeleted.push(dbRecord.id);
			} else if (dbRecord.created_at > lastSyncTimestamp) {
				serverCreated.push(clientRecord);
			} else {
				serverUpdated.push(clientRecord);
			}
		}

		// Build response
		const response: SyncResponse = {
			newSyncTimestamp,
			created: serverCreated,
			updated: serverUpdated,
			deleted: serverDeleted,
			conflicts,
		};

		return new Response(JSON.stringify(response), {
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error("Sync error:", error);
		return new Response(
			JSON.stringify({
				error: "Sync failed",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}
}
