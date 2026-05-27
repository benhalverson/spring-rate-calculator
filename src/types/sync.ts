import type { SpringCalcRecord } from "./spring";

/**
 * Sync request body sent from client to server.
 */
export interface SyncRequest {
	/** Client's last successful sync timestamp (epoch ms). */
	lastSyncTimestamp: number;
	/** Records created on the client since last sync. */
	created: SpringCalcRecord[];
	/** Records updated on the client since last sync. */
	updated: SpringCalcRecord[];
	/** Record IDs deleted on the client since last sync. */
	deleted: string[];
}

/**
 * Conflict metadata when server and client both modified same record.
 */
export interface ConflictResolution {
	/** Record ID that had a conflict. */
	id: string;
	/** The record version that won (server's version). */
	winner: SpringCalcRecord;
	/** The record version that lost (client's version). */
	loser: SpringCalcRecord;
	/** Reason for conflict resolution. */
	reason: string;
}

/**
 * Sync response returned from server to client.
 */
export interface SyncResponse {
	/** New sync timestamp to use for next sync. */
	newSyncTimestamp: number;
	/** Records created on server since lastSyncTimestamp. */
	created: SpringCalcRecord[];
	/** Records updated on server since lastSyncTimestamp. */
	updated: SpringCalcRecord[];
	/** Record IDs deleted on server since lastSyncTimestamp. */
	deleted: string[];
	/** Conflicts that were resolved during sync. */
	conflicts: ConflictResolution[];
}
