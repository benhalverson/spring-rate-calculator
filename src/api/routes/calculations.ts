import { Hono } from "hono";

import { jsonError } from "../lib/json";
import type { ApiBindings } from "../types/env";

/**
 * Placeholder calculations routes. Issue #34 will implement full CRUD behavior.
 */
export const calculationsRoutes = new Hono<ApiBindings>()
	.get("/", (context) => {
		const requestId = context.get("requestId");
		return jsonError(context, "Not implemented yet.", 501, requestId);
	})
	.post("/", (context) => {
		const requestId = context.get("requestId");
		return jsonError(context, "Not implemented yet.", 501, requestId);
	});
