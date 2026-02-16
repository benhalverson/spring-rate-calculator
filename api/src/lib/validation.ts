import { z } from "zod";

/**
 * Validation schema for spring calculation records.
 * Validates units, numeric constraints, URL formats, and ID types.
 */
export const SpringCalcRecordSchema = z.object({
	id: z.string().uuid("ID must be a valid UUID"),
	createdAt: z
		.number()
		.int("createdAt must be an integer")
		.positive("createdAt must be positive"),
	manufacturer: z
		.string()
		.min(1, "manufacturer is required")
		.max(255, "manufacturer must be 255 characters or less"),
	partNumber: z
		.string()
		.min(1, "partNumber is required")
		.max(255, "partNumber must be 255 characters or less"),
	purchaseUrl: z
		.string()
		.url("purchaseUrl must be a valid URL")
		.optional()
		.or(z.literal("")),
	notes: z
		.string()
		.max(5000, "notes must be 5000 characters or less")
		.optional(),
	units: z.enum(["mm", "in"], {
		errorMap: () => ({ message: "units must be either 'mm' or 'in'" }),
	}),
	d: z.number().positive("d (wire diameter) must be positive"),
	D: z.number().positive("D (coil outer diameter) must be positive"),
	n: z.number().positive("n (active coils) must be positive"),
	Davg: z.number().positive("Davg (average diameter) must be positive"),
	k: z.number().positive("k (spring rate) must be positive"),
});

/**
 * Schema for creating a new calculation (allows partial createdAt).
 */
export const CreateCalculationSchema = SpringCalcRecordSchema.omit({
	createdAt: true,
}).extend({
	createdAt: z
		.number()
		.int("createdAt must be an integer")
		.positive("createdAt must be positive")
		.optional(),
});

/**
 * Schema for updating an existing calculation.
 * All fields are optional except those that cannot be changed.
 */
export const UpdateCalculationSchema = z
	.object({
		manufacturer: z
			.string()
			.min(1, "manufacturer must not be empty")
			.max(255, "manufacturer must be 255 characters or less")
			.optional(),
		partNumber: z
			.string()
			.min(1, "partNumber must not be empty")
			.max(255, "partNumber must be 255 characters or less")
			.optional(),
		purchaseUrl: z
			.string()
			.url("purchaseUrl must be a valid URL")
			.optional()
			.or(z.literal("")),
		notes: z
			.string()
			.max(5000, "notes must be 5000 characters or less")
			.optional(),
		units: z
			.enum(["mm", "in"], {
				errorMap: () => ({ message: "units must be either 'mm' or 'in'" }),
			})
			.optional(),
		d: z.number().positive("d (wire diameter) must be positive").optional(),
		D: z
			.number()
			.positive("D (coil outer diameter) must be positive")
			.optional(),
		n: z.number().positive("n (active coils) must be positive").optional(),
		Davg: z
			.number()
			.positive("Davg (average diameter) must be positive")
			.optional(),
		k: z.number().positive("k (spring rate) must be positive").optional(),
	})
	.strict();

/**
 * Schema for listing calculations with query parameters.
 */
export const ListCalculationsQuerySchema = z.object({
	manufacturer: z.string().optional(),
	partNumber: z.string().optional(),
	units: z.enum(["mm", "in"]).optional(),
	fromDate: z.coerce
		.number()
		.int("fromDate must be an integer")
		.positive("fromDate must be positive")
		.optional(),
	toDate: z.coerce
		.number()
		.int("toDate must be an integer")
		.positive("toDate must be positive")
		.optional(),
	limit: z.coerce
		.number()
		.int("limit must be an integer")
		.positive("limit must be positive")
		.max(100, "limit cannot exceed 100")
		.default(100),
	offset: z.coerce
		.number()
		.int("offset must be an integer")
		.nonnegative("offset must be non-negative")
		.default(0),
	orderBy: z.enum(["createdAt", "k"]).default("createdAt"),
	orderDirection: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Schema for bulk delete operations.
 */
export const BulkDeleteSchema = z.object({
	ids: z
		.array(z.string().uuid("Each ID must be a valid UUID"))
		.min(1, "ids array must contain at least one ID")
		.max(100, "Cannot delete more than 100 items at once"),
});

/**
 * Schema for UUID path parameters.
 */
export const UuidParamSchema = z.object({
	id: z.string().uuid("ID must be a valid UUID"),
});
