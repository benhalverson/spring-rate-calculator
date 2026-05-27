import { useEffect, useState } from "react";

import { getCloudSyncStatus, subscribeCloudSyncStatus } from "../lib/db";
import { isCloudSyncEnabled } from "../lib/env";
import type { CloudSyncStatus } from "../types/cloudSync";
import { Badge } from "./ui/badge";

const getVariant = (
	status: CloudSyncStatus,
): "secondary" | "success" | "warning" => {
	switch (status.state) {
		case "idle":
			return status.queuedCount > 0 ? "warning" : "success";
		case "syncing":
			return "secondary";
		case "backoff":
		case "error":
			return "warning";
		default:
			return "secondary";
	}
};

const getLabel = (status: CloudSyncStatus): string => {
	switch (status.state) {
		case "idle":
			return status.queuedCount > 0 ? "Sync queued" : "Sync idle";
		case "syncing":
			return "Syncing…";
		case "backoff":
			return "Sync retrying…";
		case "error":
			return "Sync error";
		default:
			return "Sync off";
	}
};

export function SyncStatusPill() {
	const enabled = isCloudSyncEnabled();
	const [status, setStatus] = useState<CloudSyncStatus>(() =>
		enabled ? getCloudSyncStatus() : { state: "disabled", queuedCount: 0 },
	);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		return subscribeCloudSyncStatus(setStatus);
	}, [enabled]);

	if (!enabled) {
		return null;
	}

	const title = status.lastError
		? status.nextAttemptAt
			? `${status.lastError} (next retry: ${new Date(status.nextAttemptAt).toLocaleTimeString()})`
			: status.lastError
		: undefined;

	return (
		<Badge
			variant={getVariant(status)}
			title={title}
			className="gap-1.5 border-slate-200 bg-white px-2.5 py-1 text-[0.86rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
			aria-label={`Cloud sync status: ${status.state}`}
		>
			<span className="size-2 rounded-full bg-purple-500" aria-hidden="true" />
			{getLabel(status)}
			{status.queuedCount > 0 ? ` (${status.queuedCount})` : null}
		</Badge>
	);
}
