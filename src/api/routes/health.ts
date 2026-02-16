import { Hono } from "hono";

import { jsonSuccess } from "../lib/json";
import type { ApiBindings } from "../types/env";

/**
 * Health endpoints for local/dev and deployment checks.
 */
export const healthRoutes = new Hono<ApiBindings>().get("/", (_context) => {
	return jsonSuccess(
		_context,
		{
			status: "ok",
			service: "spring-rate-calculator-api",
			timestamp: new Date().toISOString(),
		},
		200,
	);
});
