export const getEnvVar = (key: string): string | undefined => {
	const nodeProcess = (
		globalThis as unknown as {
			process?: { env?: Record<string, string | undefined> };
		}
	).process;

	if (nodeProcess?.env) {
		const value = nodeProcess.env[key];
		if (value !== undefined) {
			return value;
		}
	}

	const metaEnv = (import.meta as unknown as { env?: Record<string, string> })
		.env;
	return metaEnv?.[key];
};

export const getEnvFlag = (key: string): boolean => {
	const raw = getEnvVar(key);
	if (!raw) {
		return false;
	}
	return (
		raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes"
	);
};

export const isCloudSyncEnabled = (): boolean =>
	getEnvFlag("VITE_ENABLE_CLOUD_SYNC");

export const getCloudSyncUrl = (): string | undefined => {
	const url = getEnvVar("VITE_CLOUD_SYNC_URL")?.trim();
	return url ? url : undefined;
};
