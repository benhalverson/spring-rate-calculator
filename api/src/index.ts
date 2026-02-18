import { Hono } from "hono";

// Define types for Cloudflare Worker environment
// biome-ignore lint/complexity/noBannedTypes: Empty object type is intentional for future bindings
type Bindings = {
	// Add D1 database binding here in the future:
	// DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
app.get("/api/v1/health", (c) => {
	return c.json({
		status: "ok",
		timestamp: Date.now(),
		service: "spring-rate-calculator-api",
		version: "1.0.0",
	});
});

// Root endpoint
app.get("/", (c) => {
	return c.json({
		message: "Spring Rate Calculator API",
		version: "1.0.0",
		endpoints: {
			health: "/api/v1/health",
		},
	});
});

export default app;
