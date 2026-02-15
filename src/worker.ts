interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

/**
 * Cloudflare Worker entrypoint that serves built static assets.
 */
export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		return env.ASSETS.fetch(request);
	},
};
