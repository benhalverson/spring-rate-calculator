import { describe, expect, it } from "vitest";
import api from "../src/index";

type ApiErrorResponse = {
	success: boolean;
	error: {
		message: string;
		code: string;
		details?: unknown;
	};
};

type ApiSuccessResponse<T> = {
	success: true;
	data: T;
};

type CalculationResponse = {
	id: string;
	createdAt: number;
	manufacturer: string;
	partNumber: string;
	purchaseUrl?: string;
	notes?: string;
	units: "mm" | "in";
	wireDiameter: number;
	outerDiameter: number;
	activeCoils: number;
	averageDiameter: number;
	springRate: number;
};

const createEmptyD1Database = () => {
	const statement = {
		bind: () => statement,
		raw: async () => [],
		run: async () => ({ success: true }),
	};
	const database = {
		prepare: () => statement,
	};

	return database as unknown as D1Database;
};

const expectValidationError = async (response: Response) => {
	expect(response.status).toBe(400);
	const data = (await response.json()) as ApiErrorResponse;
	expect(data.success).toBe(false);
	expect(data.error.code).toBe("VALIDATION_ERROR");
	expect(data.error.message).toBe("Validation failed");
	return data;
};

describe("API Validation - Invalid Inputs", () => {
	describe("POST /api/v1/calculations - Create Calculation", () => {
		it("should generate server-owned fields for valid create requests", async () => {
			const response = await api.request(
				"/api/v1/calculations",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						manufacturer: "Test Manufacturer",
						partNumber: "TEST-123",
						units: "mm",
						wireDiameter: 12.7,
						outerDiameter: 63.5,
						activeCoils: 7,
					}),
				},
				{ DB: createEmptyD1Database() },
			);

			expect(response.status).toBe(201);
			const data =
				(await response.json()) as ApiSuccessResponse<CalculationResponse>;
			expect(data.success).toBe(true);
			expect(data.data.id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
			expect(data.data.createdAt).toEqual(expect.any(Number));
			expect(data.data.averageDiameter).toBeCloseTo(50.8);
			expect(data.data.springRate).toBeCloseTo(
				(79_000 * 12.7 ** 4) / (8 * 7 * 50.8 ** 3),
			);
		});

		it("should return 400 for a missing request body", async () => {
			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			const data = await expectValidationError(response);
			expect(data.error.details).toEqual([
				{
					path: "body",
					message: "Request body must be valid JSON.",
				},
			]);
		});

		it("should return 400 for malformed JSON", async () => {
			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{",
			});

			await expectValidationError(response);
		});

		it("should return 400 for invalid units", async () => {
			const invalidRecord = {
				manufacturer: "Test Manufacturer",
				partNumber: "TEST-123",
				units: "cm", // Invalid unit
				wireDiameter: 12.7,
				outerDiameter: 63.5,
				activeCoils: 7,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
			expect(data.error.message).toBe("Validation failed");
		});

		it("should return 400 for negative numbers", async () => {
			const invalidRecord = {
				manufacturer: "Test Manufacturer",
				partNumber: "TEST-123",
				units: "mm",
				wireDiameter: -12.7, // Negative number
				outerDiameter: 63.5,
				activeCoils: 7,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for invalid URL", async () => {
			const invalidRecord = {
				manufacturer: "Test Manufacturer",
				partNumber: "TEST-123",
				purchaseUrl: "not-a-valid-url", // Invalid URL
				units: "mm",
				wireDiameter: 12.7,
				outerDiameter: 63.5,
				activeCoils: 7,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for client-provided server-owned fields", async () => {
			const invalidRecord = {
				id: "123e4567-e89b-12d3-a456-426614174000",
				manufacturer: "Test Manufacturer",
				partNumber: "TEST-123",
				units: "mm",
				wireDiameter: 12.7,
				outerDiameter: 63.5,
				activeCoils: 7,
				averageDiameter: 50.8,
				springRate: 18.5,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for missing required fields", async () => {
			const invalidRecord = {
				// Missing manufacturer
				partNumber: "TEST-123",
				units: "mm",
				wireDiameter: 12.7,
				outerDiameter: 63.5,
				activeCoils: 7,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return consistent error response shape", async () => {
			const invalidRecord = {
				manufacturer: "",
				partNumber: "",
				units: "invalid",
				wireDiameter: -1,
				outerDiameter: -1,
				activeCoils: -1,
			};

			const response = await api.request("/api/v1/calculations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidRecord),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;

			// Verify consistent error shape
			expect(data).toHaveProperty("success");
			expect(data).toHaveProperty("error");
			expect(data.error).toHaveProperty("message");
			expect(data.error).toHaveProperty("code");
			expect(data.error).toHaveProperty("details");

			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
			expect(Array.isArray(data.error.details)).toBe(true);
		});
	});

	describe("GET /api/v1/calculations/:id - Get Single Calculation", () => {
		it("should return 400 for invalid UUID in path", async () => {
			const response = await api.request("/api/v1/calculations/not-a-uuid");

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 404 for non-existent calculation", async () => {
			const response = await api.request(
				"/api/v1/calculations/123e4567-e89b-12d3-a456-426614174999",
				undefined,
				{ DB: createEmptyD1Database() },
			);

			expect(response.status).toBe(404);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("NOT_FOUND");
		});
	});

	describe("PUT /api/v1/calculations/:id - Update Calculation", () => {
		it("should return 400 for a missing request body", async () => {
			const response = await api.request(
				"/api/v1/calculations/123e4567-e89b-12d3-a456-426614174000",
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
				},
			);

			await expectValidationError(response);
		});

		it("should return 400 for invalid update data", async () => {
			const invalidUpdate = {
				wireDiameter: -5, // Negative number
			};

			const response = await api.request(
				"/api/v1/calculations/123e4567-e89b-12d3-a456-426614174000",
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(invalidUpdate),
				},
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("POST /api/v1/calculations/bulk-delete - Bulk Delete", () => {
		it("should return 400 for a missing request body", async () => {
			const response = await api.request("/api/v1/calculations/bulk-delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});

			await expectValidationError(response);
		});

		it("should return 400 for empty ids array", async () => {
			const response = await api.request("/api/v1/calculations/bulk-delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: [] }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for invalid UUIDs in array", async () => {
			const response = await api.request("/api/v1/calculations/bulk-delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: ["not-a-uuid", "also-invalid"] }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for too many ids (>100)", async () => {
			const tooManyIds = Array.from(
				{ length: 101 },
				(_unusedValue, index) =>
					`123e4567-e89b-12d3-a456-${String(index).padStart(12, "0")}`,
			);

			const response = await api.request("/api/v1/calculations/bulk-delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: tooManyIds }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("GET /api/v1/calculations - List Calculations with Query Params", () => {
		it("should return 400 for invalid units query param", async () => {
			const response = await api.request("/api/v1/calculations?units=invalid");

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for negative offset", async () => {
			const response = await api.request("/api/v1/calculations?offset=-1");

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for limit exceeding 100", async () => {
			const response = await api.request("/api/v1/calculations?limit=101");

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});

		it("should return 400 for invalid orderBy value", async () => {
			const response = await api.request(
				"/api/v1/calculations?orderBy=invalid",
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("Error Response Consistency", () => {
		it("should have consistent error shape across all validation errors", async () => {
			const endpoints = [
				{
					path: "/api/v1/calculations",
					method: "POST",
					body: { id: "invalid" },
				},
				{
					path: "/api/v1/calculations/invalid-id",
					method: "GET",
				},
				{
					path: "/api/v1/calculations/bulk-delete",
					method: "POST",
					body: { ids: [] },
				},
			];

			for (const endpoint of endpoints) {
				const options: RequestInit = {
					method: endpoint.method,
					headers: { "Content-Type": "application/json" },
				};

				if (endpoint.body) {
					options.body = JSON.stringify(endpoint.body);
				}

				const response = await api.request(endpoint.path, options);
				const data = (await response.json()) as ApiErrorResponse;

				// All validation errors should have the same shape
				expect(data).toHaveProperty("success");
				expect(data).toHaveProperty("error");
				expect(data.error).toHaveProperty("message");
				expect(data.error).toHaveProperty("code");
				expect(data.success).toBe(false);
				expect(data.error.code).toBe("VALIDATION_ERROR");
			}
		});
	});
});
