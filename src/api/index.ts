import { Hono } from "hono";

import { jsonError } from "./lib/json";
import { requestIdMiddleware } from "./middleware/request-id";
import { calculationsRoutes } from "./routes/calculations";
import { healthRoutes } from "./routes/health";
import { syncRoutes } from "./routes/sync";
import type { ApiBindings } from "./types/env";

/**
 * Creates and configures the Hono API app mounted in the existing Worker.
 */
export const createApiApp = (): Hono<ApiBindings> => {
	const api = new Hono<ApiBindings>();

	api.use("*", requestIdMiddleware);

	api.onError((error, context) => {
		const requestId = context.get("requestId");
		const message =
			error instanceof Error ? error.message : "Internal server error.";
		return jsonError(context, message, 500, requestId);
	});

	api.notFound((context) => {
		const requestId = context.get("requestId");
		return jsonError(context, "Route not found.", 404, requestId);
	});

	api.route("/health", healthRoutes);
	api.route("/calculations", calculationsRoutes);
	api.route("/sync", syncRoutes);

	return api;
};
