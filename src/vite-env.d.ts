/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_ENABLE_CLOUD_SYNC?: string;
	readonly VITE_CLOUD_SYNC_URL?: string;
}
