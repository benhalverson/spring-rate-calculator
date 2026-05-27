import type { Context, Next } from "hono";

/**
 * Simple in-memory rate limiter using a sliding window approach.
 * Note: In a multi-instance deployment, this is per-isolate.
 * For distributed rate limiting, use Cloudflare's Rate Limiting or Durable Objects.
 */
interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Maximum requests per window */
const MAX_REQUESTS = 100;

/** Window size in milliseconds (1 minute) */
const WINDOW_MS = 60_000;

/**
 * Get a client identifier from the request.
 * Uses X-Session-ID if available, falls back to CF-Connecting-IP.
 */
function getClientId(c: Context): string {
	return (
		c.req.header("X-Session-ID") ||
		c.req.header("CF-Connecting-IP") ||
		c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

/**
 * Clean up expired entries periodically to prevent memory leaks.
 */
let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupExpiredEntries() {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
		return;
	}
	lastCleanup = now;
	for (const [key, entry] of rateLimitStore) {
		if (now >= entry.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}

/**
 * Rate limiting middleware.
 * Limits requests per client to MAX_REQUESTS per WINDOW_MS.
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
	const clientId = getClientId(c);
	const now = Date.now();

	// Time-based cleanup
	cleanupExpiredEntries();

	const entry = rateLimitStore.get(clientId);

	if (!entry || now >= entry.resetTime) {
		// New window
		rateLimitStore.set(clientId, {
			count: 1,
			resetTime: now + WINDOW_MS,
		});

		c.header("X-RateLimit-Limit", MAX_REQUESTS.toString());
		c.header("X-RateLimit-Remaining", (MAX_REQUESTS - 1).toString());
		c.header(
			"X-RateLimit-Reset",
			Math.ceil((now + WINDOW_MS) / 1000).toString(),
		);

		await next();
		return;
	}

	if (entry.count >= MAX_REQUESTS) {
		const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

		c.header("X-RateLimit-Limit", MAX_REQUESTS.toString());
		c.header("X-RateLimit-Remaining", "0");
		c.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());
		c.header("Retry-After", retryAfter.toString());

		return c.json(
			{
				success: false,
				error: "Too many requests. Please try again later.",
			},
			429,
		);
	}

	// Increment counter
	entry.count++;

	c.header("X-RateLimit-Limit", MAX_REQUESTS.toString());
	c.header("X-RateLimit-Remaining", (MAX_REQUESTS - entry.count).toString());
	c.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000).toString());

	await next();
}
