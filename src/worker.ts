import { handleSync } from "./lib/sync";

interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
	DB: D1Database;
}

/**
 * Cloudflare Worker entrypoint that serves built static assets and API endpoints.
 */
export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		const url = new URL(request.url);

		// Handle sync endpoint
		if (url.pathname === "/api/v1/sync" && request.method === "POST") {
			return handleSync(request, env.DB);
		}

		// Serve static assets for all other requests
		return env.ASSETS.fetch(request);
	},
};
