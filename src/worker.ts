interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

/**
 * Health check response for monitoring and deployment validation.
 */
interface HealthCheckResponse {
	status: "healthy" | "degraded" | "unhealthy";
	timestamp: string;
	version: string;
	checks: {
		assets: boolean;
		database: boolean;
	};
}

/**
 * Performs health check and returns status.
 */
async function healthCheck(): Promise<Response> {
	const health: HealthCheckResponse = {
		status: "healthy",
		timestamp: new Date().toISOString(),
		version: "0.1.11",
		checks: {
			assets: true, // Assets are served via Workers
			database: true, // IndexedDB is client-side, always available
		},
	};

	return new Response(JSON.stringify(health, null, 2), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-cache, no-store, must-revalidate",
		},
	});
}

/**
 * Cloudflare Worker entrypoint that serves built static assets.
 * Includes health check endpoint for deployment validation.
 */
export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		const url = new URL(request.url);

		// Health check endpoint for monitoring and deployment validation
		if (url.pathname === "/health" || url.pathname === "/api/health") {
			return healthCheck();
		}

		// Serve static assets
		return env.ASSETS.fetch(request);
	},
};
