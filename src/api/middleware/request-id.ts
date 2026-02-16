import type { MiddlewareHandler } from "hono";

import type { ApiBindings } from "../types/env";

/**
 * Adds a per-request identifier to request context and response headers.
 */
export const requestIdMiddleware: MiddlewareHandler<ApiBindings> = async (
	context,
	next,
) => {
	const requestId = crypto.randomUUID();
	context.set("requestId", requestId);
	await next();
	context.header("x-request-id", requestId);
};
