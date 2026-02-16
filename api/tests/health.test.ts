import { describe, it, expect } from "vitest";
import app from "../src/index";

describe("API Health Check", () => {
	it("should return 200 OK for /api/v1/health", async () => {
		const req = new Request("http://localhost/api/v1/health", {
			method: "GET",
		});
		const res = await app.fetch(req);

		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("timestamp");
		expect(data).toHaveProperty("service", "spring-rate-calculator-api");
		expect(data).toHaveProperty("version");
	});

	it("should return 200 OK for root endpoint", async () => {
		const req = new Request("http://localhost/", {
			method: "GET",
		});
		const res = await app.fetch(req);

		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("message");
		expect(data).toHaveProperty("endpoints");
		expect(data.endpoints).toHaveProperty("health", "/api/v1/health");
	});
});
