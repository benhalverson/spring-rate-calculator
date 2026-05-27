<<<<<<< HEAD
import { handleSync } from "./lib/sync";
=======
import api from "../api/src/index.js";
>>>>>>> origin/main

interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
	DB: D1Database;
}

/**
<<<<<<< HEAD
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
=======
 * Cloudflare Worker entrypoint that serves API routes and built static assets.
 */
export default {
	async fetch(
		request: Request,
		env: WorkerEnv,
		context: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Route API requests to Hono
		if (url.pathname.startsWith("/api/")) {
			return api.fetch(request, env, context);
		}

		// Serve static assets
>>>>>>> origin/main
		return env.ASSETS.fetch(request);
	},
};
