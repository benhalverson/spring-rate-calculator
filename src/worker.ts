import api from "../api/src/index";

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
		if (url.pathname.startsWith("/api/")) {
			return api.fetch(request, env, context);
		}

		return env.ASSETS.fetch(request);
	},
};
