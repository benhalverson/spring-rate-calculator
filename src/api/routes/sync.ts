import { Hono } from "hono";

import { jsonError } from "../lib/json";
import type { ApiBindings } from "../types/env";

/**
 * Placeholder sync routes. Issue #36 will implement sync behavior.
 */
export const syncRoutes = new Hono<ApiBindings>().post("/", (context) => {
	const requestId = context.get("requestId");
	return jsonError(context, "Not implemented yet.", 501, requestId);
});
