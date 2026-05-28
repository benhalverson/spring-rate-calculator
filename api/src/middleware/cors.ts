import type { Context, Next } from "hono";

/**
 * CORS middleware configuration for production.
 * Allows requests from the production origin and common development origins.
 */
const DEFAULT_ALLOWED_ORIGIN =
	"https://spring-rate-calculator.benhalverson.workers.dev";

const ALLOWED_ORIGINS = [
	DEFAULT_ALLOWED_ORIGIN,
	"http://localhost:5173", // Vite dev server
	"http://localhost:4173", // Vite preview
	"http://127.0.0.1:5173",
	"http://127.0.0.1:4173",
];

/**
 * CORS middleware that enforces origin restrictions.
 * Handles preflight OPTIONS requests and adds appropriate CORS headers.
 */
export async function corsMiddleware(c: Context, next: Next) {
	const origin = c.req.header("Origin");

	// Handle preflight requests
	if (c.req.method === "OPTIONS") {
		const allowedOrigin =
			origin && ALLOWED_ORIGINS.includes(origin)
				? origin
				: DEFAULT_ALLOWED_ORIGIN;

		return c.body(null, 204, {
			"Access-Control-Allow-Origin": allowedOrigin,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers":
				"Content-Type, Authorization, X-Session-ID",
			"Access-Control-Max-Age": "86400", // 24 hours
			"Access-Control-Allow-Credentials": "true",
		});
	}

	// For actual requests, validate origin and add CORS headers
	const allowedOrigin =
		origin && ALLOWED_ORIGINS.includes(origin)
			? origin
			: DEFAULT_ALLOWED_ORIGIN;

	// Set CORS headers
	c.header("Access-Control-Allow-Origin", allowedOrigin);
	c.header("Access-Control-Allow-Credentials", "true");
	c.header("Access-Control-Expose-Headers", "X-Session-ID");

	await next();
}
