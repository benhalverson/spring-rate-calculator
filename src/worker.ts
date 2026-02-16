import { Hono } from "hono";

import { createApiApp } from "./api";
import type { ApiBindings } from "./api/types/env";

const app = new Hono<ApiBindings>();

app.route("/api/v1", createApiApp());
app.all("*", async (context) => {
	return context.env.ASSETS.fetch(context.req.raw);
});

/**
 * Cloudflare Worker entrypoint that serves built static assets.
 */
export default app;
