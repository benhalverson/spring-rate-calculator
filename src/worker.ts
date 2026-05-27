import { Hono } from "hono";
import {
	corsMiddleware,
	rateLimitMiddleware,
	securityHeadersMiddleware,
	sessionMiddleware,
} from "./api/middleware";

interface WorkerEnv {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
}

const app = new Hono<{ Bindings: WorkerEnv }>();

// Apply middleware to all API routes
// Order: security headers first, then rate limit, CORS, and session last
app.use("/api/*", securityHeadersMiddleware);
app.use("/api/*", rateLimitMiddleware);
app.use("/api/*", corsMiddleware);
app.use("/api/*", sessionMiddleware);

// Health check endpoint
app.get("/api/v1/health", (c) => {
	return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Fallback: serve static assets for non-API routes
app.all("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
