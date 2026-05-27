import type { Context } from "hono";
import { ZodError } from "zod";
import type { ApiErrorResponse } from "../types/api";
import { HttpError } from "../types/api";

/**
 * Unified error handling middleware for Hono.
 * Provides consistent error response shape across all API endpoints.
 */
export async function errorMiddleware(
	err: Error,
	context: Context,
): Promise<Response> {
	console.error("API Error:", err);

	// Handle Zod validation errors (400)
	if (err instanceof ZodError) {
		const details = err.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		}));

		const response: ApiErrorResponse = {
			success: false,
			error: {
				message: "Validation failed",
				code: "VALIDATION_ERROR",
				details,
			},
		};

		return context.json(response, 400);
	}

	// Handle custom HTTP errors
	if (err instanceof HttpError) {
		const response: ApiErrorResponse = {
			success: false,
			error: {
				message: err.message,
				code: err.code,
				details: err.details,
			},
		};

		return context.json(
			response,
			err.statusCode as 400 | 404 | 409 | 500 | 503,
		);
	}

	// Handle generic errors (500)
	const response: ApiErrorResponse = {
		success: false,
		error: {
			message: "Internal server error",
			code: "INTERNAL_ERROR",
		},
	};

	return context.json(response, 500);
}
