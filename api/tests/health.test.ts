import { describe, expect, it, vi } from "vitest";
import app from "../src/index";

const createD1Database = (raw: () => Promise<unknown[][]> = async () => []) => {
	const statement = {
		bind: vi.fn(() => statement),
		raw: vi.fn(raw),
	};
	const database = {
		prepare: vi.fn(() => statement),
	};

	return {
		database: database as unknown as D1Database,
		prepare: database.prepare,
		raw: statement.raw,
	};
};

describe("API Health Check", () => {
	it("should return 200 OK for /api/v1/health", async () => {
		const { database, prepare, raw } = createD1Database();
		const req = new Request("http://localhost/api/v1/health", {
			method: "GET",
		});
		const res = await app.fetch(req, { DB: database });

		expect(res.status).toBe(200);
		expect(prepare).toHaveBeenCalledWith(
			expect.stringContaining('"calculations"'),
		);
		expect(raw).toHaveBeenCalled();

		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("timestamp");
		expect(data).toHaveProperty("service", "spring-rate-calculator-api");
		expect(data).toHaveProperty("version");
		expect(data).toHaveProperty("checks.database.status", "ok");
		expect(data).toHaveProperty("checks.database.table", "calculations");
	});

	it("should return 503 when the D1 health query fails", async () => {
		const { database } = createD1Database(async () => {
			throw new Error("no such table: calculations");
		});
		const req = new Request("http://localhost/api/v1/health", {
			method: "GET",
		});
		const res = await app.fetch(req, { DB: database });

		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty("checks.database.status", "error");
		expect(data).toHaveProperty(
			"checks.database.message",
			expect.stringContaining('select "id" from "calculations"'),
		);
	});

	it("should return 503 when the D1 binding is missing", async () => {
		const req = new Request("http://localhost/api/v1/health", {
			method: "GET",
		});
		const res = await app.fetch(req, {});

		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty(
			"checks.database.message",
			"D1 binding DB is not configured.",
		);
	});

	it("should return 200 OK for root endpoint", async () => {
		const req = new Request("http://localhost/", {
			method: "GET",
		});
		const res = await app.fetch(req);

		expect(res.status).toBe(200);

		const data = (await res.json()) as {
			message: string;
			endpoints: { health: string };
		};
		expect(data).toHaveProperty("message");
		expect(data).toHaveProperty("endpoints");
		expect(data.endpoints).toHaveProperty("health", "/api/v1/health");
	});
});
