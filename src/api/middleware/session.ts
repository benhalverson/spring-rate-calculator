import type { Context, Next } from "hono";
import { v4 as uuidv4 } from "uuid";

/**
 * Session context that will be available on requests after middleware runs.
 */
export interface SessionContext {
	sessionId: string;
	isNewSession: boolean;
}

/**
 * Middleware that validates or creates session IDs.
 * Enforces that all requests have a valid X-Session-ID header.
 * If missing, generates a new session ID and returns it in response headers.
 */
export async function sessionMiddleware(c: Context, next: Next) {
	const sessionId = c.req.header("X-Session-ID");

	if (!sessionId || sessionId.trim() === "") {
		// Generate new session ID for requests without one
		const newSessionId = uuidv4();

		// Set in context for use in handlers
		c.set("sessionId", newSessionId);
		c.set("isNewSession", true);

		// Continue with the request
		await next();

		// Add session ID to response headers
		c.res.headers.set("X-Session-ID", newSessionId);
		return;
	}

	// Validate session ID format (UUID v4)
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(sessionId)) {
		return c.json(
			{
				success: false,
				error: "Invalid session ID format. Must be a valid UUID v4.",
			},
			400,
		);
	}

	// Session ID is valid, set in context
	c.set("sessionId", sessionId);
	c.set("isNewSession", false);

	await next();
}

/**
 * Helper to get session ID from context.
 */
export function getSessionId(c: Context): string {
	const sessionId = c.get("sessionId");
	if (!sessionId) {
		throw new Error("Session ID not found in context");
	}
	return sessionId;
}
