import { Hono } from "hono";
import { createDb } from "./db/client.js";
import { calculations } from "./db/schema.js";
import { errorMiddleware } from "./middleware/errors.js";
import {
	corsMiddleware,
	rateLimitMiddleware,
	securityHeadersMiddleware,
	sessionMiddleware,
} from "./middleware/index.js";
import calculationsRoutes from "./routes/calculations.js";

type Bindings = {
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();
const serviceVersion = "1.0.0";

const getErrorMessage = (error: unknown): string => {
	return error instanceof Error ? error.message : "Unknown database error";
};

const checkDatabase = async (database?: D1Database) => {
	if (!database) {
		return {
			status: "error" as const,
			message: "D1 binding DB is not configured.",
		};
	}

	try {
		const db = createDb(database);
		await db.select({ id: calculations.id }).from(calculations).limit(1).all();

		return {
			status: "ok" as const,
			table: "calculations",
		};
	} catch (error) {
		return {
			status: "error" as const,
			message: getErrorMessage(error),
		};
	}
};

// Security middleware chain
// Order: security headers first, then rate limit, CORS, and session last
app.use("*", securityHeadersMiddleware);
app.use("*", rateLimitMiddleware);
app.use("*", corsMiddleware);
app.use("*", sessionMiddleware);

// Mount API routes
app.route("/api/v1/calculations", calculationsRoutes);

// Error handling middleware
app.onError(errorMiddleware);

// Health check endpoint
app.get("/api/v1/health", async (c) => {
	const database = await checkDatabase(c.env.DB);
	const isHealthy = database.status === "ok";

	return c.json(
		{
			status: isHealthy ? "ok" : "error",
			timestamp: Date.now(),
			service: "spring-rate-calculator-api",
			version: serviceVersion,
			checks: {
				database,
			},
		},
		isHealthy ? 200 : 503,
	);
});

// Root endpoint
app.get("/", (c) => {
	return c.json({
		message: "Spring Rate Calculator API",
		version: serviceVersion,
		endpoints: {
			health: "/api/v1/health",
		},
	});
});

export default app;
