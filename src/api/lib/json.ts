import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ApiBindings } from "../types/env";

export const jsonSuccess = <T>(
	context: Context<ApiBindings>,
	data: T,
	status: ContentfulStatusCode = 200,
): Response => {
	return context.json(
		{
			success: true,
			data,
		},
		status,
	);
};

export const jsonError = (
	context: Context<ApiBindings>,
	message: string,
	status: ContentfulStatusCode = 500,
	requestId?: string,
): Response => {
	return context.json(
		{
			success: false,
			error: {
				message,
				requestId,
			},
		},
		status,
	);
};
