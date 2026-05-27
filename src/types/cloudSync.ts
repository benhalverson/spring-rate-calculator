export type CloudSyncState =
	| "disabled"
	| "idle"
	| "syncing"
	| "backoff"
	| "error";

export interface CloudSyncStatus {
	state: CloudSyncState;
	queuedCount: number;
	lastError?: string;
	nextAttemptAt?: number;
}

export type CloudSyncListener = (status: CloudSyncStatus) => void;
