import api from "../api/src/index.js";

interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
	DB: D1Database;
}

/**
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
		return env.ASSETS.fetch(request);
	},
};
