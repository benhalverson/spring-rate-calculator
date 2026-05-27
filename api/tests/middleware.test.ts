import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { corsMiddleware } from "../src/middleware/cors";
import { rateLimitMiddleware } from "../src/middleware/rateLimit";
import { securityHeadersMiddleware } from "../src/middleware/securityHeaders";
import { getSessionId, sessionMiddleware } from "../src/middleware/session";

describe("CORS middleware", () => {
	let app: Hono;

	beforeEach(() => {
		app = new Hono();
		app.use("*", corsMiddleware);
		app.get("/test", (c) => c.json({ ok: true }));
	});

	it("returns CORS headers for allowed origin", async () => {
		const res = await app.request("/test", {
			headers: { Origin: "http://localhost:5173" },
		});
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"http://localhost:5173",
		);
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("defaults to production origin for unknown origins", async () => {
		const res = await app.request("/test", {
			headers: { Origin: "http://evil.com" },
		});
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://spring-rate-calculator.benhalverson.workers.dev",
		);
	});

	it("handles preflight OPTIONS requests", async () => {
		const res = await app.request("/test", {
			method: "OPTIONS",
			headers: { Origin: "http://localhost:5173" },
		});
		expect(res.status).toBe(204);
		expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
		expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
			"X-Session-ID",
		);
		expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
	});
});

describe("Session middleware", () => {
	let app: Hono<{
		Variables: { sessionId: string; isNewSession: boolean };
	}>;

	beforeEach(() => {
		app = new Hono();
		app.use("*", sessionMiddleware);
		app.get("/test", (c) => {
			return c.json({
				sessionId: getSessionId(c),
				isNewSession: c.get("isNewSession"),
			});
		});
	});

	it("generates a new session ID when none provided", async () => {
		const res = await app.request("/test");
		const body = await res.json();
		expect(body.sessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(body.isNewSession).toBe(true);
		expect(res.headers.get("X-Session-ID")).toBe(body.sessionId);
	});

	it("accepts a valid session ID from header", async () => {
		const validId = "550e8400-e29b-41d4-a716-446655440000";
		const res = await app.request("/test", {
			headers: { "X-Session-ID": validId },
		});
		const body = await res.json();
		expect(body.sessionId).toBe(validId);
		expect(body.isNewSession).toBe(false);
	});

	it("rejects invalid session ID format", async () => {
		const res = await app.request("/test", {
			headers: { "X-Session-ID": "not-a-uuid" },
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain("Invalid session ID format");
	});

	it("rejects empty session ID", async () => {
		const res = await app.request("/test", {
			headers: { "X-Session-ID": "   " },
		});
		const body = await res.json();
		// Should generate a new one
		expect(body.isNewSession).toBe(true);
	});
});

describe("Rate limit middleware", () => {
	let app: Hono;

	beforeEach(() => {
		app = new Hono();
		app.use("*", rateLimitMiddleware);
		app.get("/test", (c) => c.json({ ok: true }));
	});

	it("allows requests within limit", async () => {
		const res = await app.request("/test", {
			headers: { "X-Session-ID": "rate-test-allow" },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
		expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
	});

	it("includes rate limit headers", async () => {
		const res = await app.request("/test", {
			headers: { "X-Session-ID": "rate-test-headers" },
		});
		expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
		expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
		expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
	});
});

describe("Security headers middleware", () => {
	let app: Hono;

	beforeEach(() => {
		app = new Hono();
		app.use("*", securityHeadersMiddleware);
		app.get("/test", (c) => c.json({ ok: true }));
	});

	it("adds security headers to response", async () => {
		const res = await app.request("/test");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(res.headers.get("Strict-Transport-Security")).toContain(
			"max-age=31536000",
		);
		expect(res.headers.get("Content-Security-Policy")).toContain(
			"default-src 'none'",
		);
		expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
	});
});
