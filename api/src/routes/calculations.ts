import type { SQL } from "drizzle-orm";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	sql,
} from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import type { z } from "zod";
import { type AppDb, createDb } from "../db/client.js";
import {
	type Calculation,
	calculations,
	type NewCalculation,
} from "../db/schema.js";
import {
	BulkDeleteSchema,
	type CalculationRecordSchema,
	CreateCalculationSchema,
	ListCalculationsQuerySchema,
	UpdateCalculationSchema,
	UuidParamSchema,
} from "../lib/validation.js";
import type { ApiErrorResponse, ApiSuccessResponse } from "../types/api.js";
import { HttpError } from "../types/api.js";

type Bindings = {
	DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings }>;
type CalculationPayload = z.infer<typeof CalculationRecordSchema>;
type CalculationResponse = CalculationPayload;
type CreateCalculationInput = z.infer<typeof CreateCalculationSchema>;
type ListCalculationsQuery = z.infer<typeof ListCalculationsQuerySchema>;
type ValidationDetail = {
	path: string;
	message: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const SPRING_STEEL_SHEAR_MODULUS_MM = 79_000;
const SPRING_STEEL_SHEAR_MODULUS_IN = 11_500_000;

const getDb = (context: AppContext): AppDb => {
	if (!context.env.DB) {
		throw new HttpError(
			503,
			"D1 binding DB is not configured.",
			"DATABASE_UNAVAILABLE",
		);
	}

	return createDb(context.env.DB);
};

const validationErrorResponse = (
	context: AppContext,
	details: ValidationDetail[],
): Response => {
	const response: ApiErrorResponse = {
		success: false,
		error: {
			message: "Validation failed",
			code: "VALIDATION_ERROR",
			details,
		},
	};

	return context.json(response, 400);
};

const parseJsonRequest = async (
	context: AppContext,
): Promise<unknown | Response> => {
	try {
		return await context.req.json();
	} catch {
		return validationErrorResponse(context, [
			{
				path: "body",
				message: "Request body must be valid JSON.",
			},
		]);
	}
};

const validateRequest = <T>(
	schema: z.ZodType<T>,
	data: unknown,
	context: AppContext,
): T | Response => {
	const result = schema.safeParse(data);

	if (!result.success) {
		const details = result.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message,
		}));

		return validationErrorResponse(context, details);
	}

	return result.data;
};

const getSpringSteelShearModulus = (units: "mm" | "in"): number =>
	units === "mm"
		? SPRING_STEEL_SHEAR_MODULUS_MM
		: SPRING_STEEL_SHEAR_MODULUS_IN;

const computeAverageDiameter = (
	outerDiameter: number,
	wireDiameter: number,
): number => outerDiameter - wireDiameter;

const computeSpringRate = (record: {
	units: "mm" | "in";
	wireDiameter: number;
	activeCoils: number;
	averageDiameter: number;
}): number => {
	const shearModulus = getSpringSteelShearModulus(record.units);

	return (
		(shearModulus * record.wireDiameter ** 4) /
		(8 * record.activeCoils * record.averageDiameter ** 3)
	);
};

const buildCalculationRecord = (
	input: CreateCalculationInput,
	now: number,
): CalculationResponse => {
	const averageDiameter = computeAverageDiameter(
		input.outerDiameter,
		input.wireDiameter,
	);

	return {
		...input,
		id: crypto.randomUUID(),
		createdAt: now,
		averageDiameter,
		springRate: computeSpringRate({
			...input,
			averageDiameter,
		}),
	};
};

const recalculateDerivedFields = (
	record: CalculationResponse,
): CalculationResponse => {
	const averageDiameter = computeAverageDiameter(
		record.outerDiameter,
		record.wireDiameter,
	);

	return {
		...record,
		averageDiameter,
		springRate: computeSpringRate({
			...record,
			averageDiameter,
		}),
	};
};

const validateUpdatedCalculation = (
	record: CalculationResponse,
	context: AppContext,
): Response | undefined => {
	if (record.outerDiameter <= record.wireDiameter) {
		return validationErrorResponse(context, [
			{
				path: "outerDiameter",
				message: "outerDiameter must be greater than wireDiameter",
			},
		]);
	}
};

const toCalculationResponse = (row: Calculation): CalculationResponse => ({
	id: row.id,
	createdAt: row.createdAt,
	manufacturer: row.manufacturer,
	partNumber: row.partNumber,
	...(row.purchaseUrl === null ? {} : { purchaseUrl: row.purchaseUrl }),
	...(row.notes === null ? {} : { notes: row.notes }),
	units: row.units,
	wireDiameter: row.wireDiameter,
	outerDiameter: row.outerDiameter,
	activeCoils: row.activeCoils,
	averageDiameter: row.averageDiameter,
	springRate: row.springRate,
});

const toNewCalculation = (
	record: CalculationResponse,
	now: number,
): NewCalculation => ({
	id: record.id,
	createdAt: record.createdAt,
	updatedAt: now,
	deletedAt: null,
	userId: null,
	sessionId: null,
	manufacturer: record.manufacturer,
	partNumber: record.partNumber,
	purchaseUrl: record.purchaseUrl ?? null,
	notes: record.notes ?? null,
	units: record.units,
	wireDiameter: record.wireDiameter,
	outerDiameter: record.outerDiameter,
	activeCoils: record.activeCoils,
	averageDiameter: record.averageDiameter,
	springRate: record.springRate,
	syncVersion: 1,
	deviceId: null,
});

const toCalculationUpdate = (record: CalculationResponse, now: number) => ({
	updatedAt: now,
	manufacturer: record.manufacturer,
	partNumber: record.partNumber,
	purchaseUrl: record.purchaseUrl ?? null,
	notes: record.notes ?? null,
	units: record.units,
	wireDiameter: record.wireDiameter,
	outerDiameter: record.outerDiameter,
	activeCoils: record.activeCoils,
	averageDiameter: record.averageDiameter,
	springRate: record.springRate,
	syncVersion: sql`${calculations.syncVersion} + 1`,
});

const activeCalculationWhere = (id: string) =>
	and(eq(calculations.id, id), isNull(calculations.deletedAt));

const findActiveCalculation = async (
	db: AppDb,
	id: string,
): Promise<Calculation | undefined> => {
	const rows = await db
		.select()
		.from(calculations)
		.where(activeCalculationWhere(id))
		.limit(1)
		.all();

	return rows[0];
};

const buildListFilters = (query: ListCalculationsQuery): SQL[] => {
	const filters: SQL[] = [isNull(calculations.deletedAt)];

	if (query.manufacturer) {
		filters.push(
			sql`lower(${calculations.manufacturer}) like ${`%${query.manufacturer.toLowerCase()}%`}`,
		);
	}

	if (query.partNumber) {
		filters.push(
			sql`lower(${calculations.partNumber}) like ${`%${query.partNumber.toLowerCase()}%`}`,
		);
	}

	if (query.units) {
		filters.push(eq(calculations.units, query.units));
	}

	if (query.fromDate !== undefined) {
		filters.push(gte(calculations.createdAt, query.fromDate));
	}

	if (query.toDate !== undefined) {
		filters.push(lte(calculations.createdAt, query.toDate));
	}

	return filters;
};

const listOrderBy = (query: ListCalculationsQuery) => {
	if (query.orderBy === "springRate") {
		return query.orderDirection === "asc"
			? asc(calculations.springRate)
			: desc(calculations.springRate);
	}

	return query.orderDirection === "asc"
		? asc(calculations.createdAt)
		: desc(calculations.createdAt);
};

const countActiveCalculations = async (
	db: AppDb,
	where: SQL | undefined,
): Promise<number> => {
	const rows = await db
		.select({ total: sql<number>`count(*)` })
		.from(calculations)
		.where(where)
		.all();

	return rows[0]?.total ?? 0;
};

/**
 * POST /api/v1/calculations
 * Create a new calculation.
 */
app.post("/", async (context) => {
	const body = await parseJsonRequest(context);

	if (body instanceof Response) {
		return body;
	}

	const validated = validateRequest(CreateCalculationSchema, body, context);

	if (validated instanceof Response) {
		return validated;
	}

	const db = getDb(context);
	const now = Date.now();
	const fullRecord = buildCalculationRecord(validated, now);

	await db.insert(calculations).values(toNewCalculation(fullRecord, now)).run();

	const response: ApiSuccessResponse<CalculationResponse> = {
		success: true,
		data: fullRecord,
	};

	return context.json(response, 201);
});

/**
 * GET /api/v1/calculations
 * List calculations with optional filters.
 */
app.get("/", async (context) => {
	const validated = validateRequest(
		ListCalculationsQuerySchema,
		context.req.query(),
		context,
	);

	if (validated instanceof Response) {
		return validated;
	}

	const db = getDb(context);
	const where = and(...buildListFilters(validated));
	const total = await countActiveCalculations(db, where);
	const rows = await db
		.select()
		.from(calculations)
		.where(where)
		.orderBy(listOrderBy(validated))
		.limit(validated.limit)
		.offset(validated.offset)
		.all();

	const response: ApiSuccessResponse<{
		items: CalculationResponse[];
		pagination: {
			total: number;
			limit: number;
			offset: number;
			hasMore: boolean;
		};
	}> = {
		success: true,
		data: {
			items: rows.map(toCalculationResponse),
			pagination: {
				total,
				limit: validated.limit,
				offset: validated.offset,
				hasMore: validated.offset + validated.limit < total,
			},
		},
	};

	return context.json(response);
});

/**
 * GET /api/v1/calculations/:id
 * Get a single calculation by ID.
 */
app.get("/:id", async (context) => {
	const validated = validateRequest(
		UuidParamSchema,
		context.req.param(),
		context,
	);

	if (validated instanceof Response) {
		return validated;
	}

	const record = await findActiveCalculation(getDb(context), validated.id);

	if (!record) {
		throw new HttpError(404, "Calculation not found", "NOT_FOUND");
	}

	const response: ApiSuccessResponse<CalculationResponse> = {
		success: true,
		data: toCalculationResponse(record),
	};

	return context.json(response);
});

/**
 * PUT /api/v1/calculations/:id
 * Update an existing calculation.
 */
app.put("/:id", async (context) => {
	const paramValidated = validateRequest(
		UuidParamSchema,
		context.req.param(),
		context,
	);

	if (paramValidated instanceof Response) {
		return paramValidated;
	}

	const body = await parseJsonRequest(context);

	if (body instanceof Response) {
		return body;
	}

	const bodyValidated = validateRequest(UpdateCalculationSchema, body, context);

	if (bodyValidated instanceof Response) {
		return bodyValidated;
	}

	const db = getDb(context);
	const existing = await findActiveCalculation(db, paramValidated.id);

	if (!existing) {
		throw new HttpError(404, "Calculation not found", "NOT_FOUND");
	}

	const updated: CalculationResponse = {
		...toCalculationResponse(existing),
		...bodyValidated,
	};
	const validationError = validateUpdatedCalculation(updated, context);

	if (validationError) {
		return validationError;
	}

	const updatedWithDerivedFields = recalculateDerivedFields(updated);

	await db
		.update(calculations)
		.set(toCalculationUpdate(updatedWithDerivedFields, Date.now()))
		.where(eq(calculations.id, paramValidated.id))
		.run();

	const response: ApiSuccessResponse<CalculationResponse> = {
		success: true,
		data: updatedWithDerivedFields,
	};

	return context.json(response);
});

/**
 * DELETE /api/v1/calculations/:id
 * Soft-delete a single calculation.
 */
app.delete("/:id", async (context) => {
	const validated = validateRequest(
		UuidParamSchema,
		context.req.param(),
		context,
	);

	if (validated instanceof Response) {
		return validated;
	}

	const db = getDb(context);
	const existing = await findActiveCalculation(db, validated.id);

	if (!existing) {
		throw new HttpError(404, "Calculation not found", "NOT_FOUND");
	}

	const now = Date.now();
	await db
		.update(calculations)
		.set({
			deletedAt: now,
			updatedAt: now,
			syncVersion: sql`${calculations.syncVersion} + 1`,
		})
		.where(eq(calculations.id, validated.id))
		.run();

	return context.body(null, 204);
});

/**
 * POST /api/v1/calculations/bulk-delete
 * Soft-delete multiple calculations.
 */
app.post("/bulk-delete", async (context) => {
	const body = await parseJsonRequest(context);

	if (body instanceof Response) {
		return body;
	}

	const validated = validateRequest(BulkDeleteSchema, body, context);

	if (validated instanceof Response) {
		return validated;
	}

	const db = getDb(context);
	const activeRows = await db
		.select({ id: calculations.id })
		.from(calculations)
		.where(
			and(
				inArray(calculations.id, validated.ids),
				isNull(calculations.deletedAt),
			),
		)
		.all();
	const activeIds = activeRows.map((row) => row.id);
	const activeIdSet = new Set(activeIds);

	if (activeIds.length > 0) {
		const now = Date.now();
		await db
			.update(calculations)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${calculations.syncVersion} + 1`,
			})
			.where(inArray(calculations.id, activeIds))
			.run();
	}

	const response: ApiSuccessResponse<{
		deleted: number;
		failed: string[];
	}> = {
		success: true,
		data: {
			deleted: activeIds.length,
			failed: validated.ids.filter((id) => !activeIdSet.has(id)),
		},
	};

	return context.json(response);
});

/**
 * DELETE /api/v1/calculations
 * Soft-delete all active calculations.
 */
app.delete("/", async (context) => {
	const db = getDb(context);
	const where = isNull(calculations.deletedAt);
	const deleted = await countActiveCalculations(db, where);

	if (deleted > 0) {
		const now = Date.now();
		await db
			.update(calculations)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${calculations.syncVersion} + 1`,
			})
			.where(where)
			.run();
	}

	const response: ApiSuccessResponse<{ deleted: number }> = {
		success: true,
		data: { deleted },
	};

	return context.json(response);
});

export default app;
