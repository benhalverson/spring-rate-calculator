/**
 * API response types for consistency across all endpoints.
 */

export interface ApiSuccessResponse<T = unknown> {
	success: true;
	data: T;
}

export interface ApiErrorResponse {
	success: false;
	error: {
		message: string;
		code?: string;
		details?: unknown;
	};
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Custom error class for HTTP errors.
 */
export class HttpError extends Error {
	statusCode: number;
	code?: string;
	details?: unknown;

	constructor(
		statusCode: number,
		message: string,
		code?: string,
		details?: unknown,
	) {
		super(message);
		this.name = "HttpError";
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}
