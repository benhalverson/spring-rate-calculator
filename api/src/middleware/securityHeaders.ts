import type { Context, Next } from "hono";

/**
 * Security headers middleware.
 * Adds CSP and other security headers to API responses.
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
	await next();

	// Content Security Policy for API responses
	c.res.headers.set(
		"Content-Security-Policy",
		"default-src 'none'; frame-ancestors 'none'",
	);

	// Prevent MIME type sniffing
	c.res.headers.set("X-Content-Type-Options", "nosniff");

	// Prevent clickjacking
	c.res.headers.set("X-Frame-Options", "DENY");

	// Control referrer information
	c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

	// Strict Transport Security (1 year)
	c.res.headers.set(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains",
	);

	// Disable browser features not needed for API
	c.res.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=()",
	);
}
