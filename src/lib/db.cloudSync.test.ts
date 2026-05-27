import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SpringCalcRecord } from "../types/spring";

const baseRecord = (
	overrides: Partial<SpringCalcRecord>,
): SpringCalcRecord => ({
	id: "id-1",
	createdAt: 1_700_000_000_000,
	manufacturer: "Team Associated",
	partNumber: "ASC91322",
	purchaseUrl: "https://example.com/spring",
	notes: "Front shock spring",
	units: "mm",
	d: 1.2,
	D: 10.5,
	n: 6,
	Davg: 9.3,
	k: 0.0000537,
	...overrides,
});

const importDb = async () => {
	const module = await import("./db");
	return module;
};

describe("db (cloud sync enabled)", () => {
	beforeEach(() => {
		vi.resetModules();
		const globalAny = globalThis as unknown as {
			process?: { env?: Record<string, string> };
		};
		if (!globalAny.process) {
			globalAny.process = { env: {} };
		}
		if (!globalAny.process.env) {
			globalAny.process.env = {};
		}
		const env = globalAny.process.env;
		env.VITE_ENABLE_CLOUD_SYNC = "true";
		env.VITE_CLOUD_SYNC_URL = "https://example.com/sync";
	});

	afterEach(() => {
		const env =
			(
				globalThis as unknown as {
					process?: { env?: Record<string, string | undefined> };
				}
			).process?.env ?? {};
		delete env.VITE_ENABLE_CLOUD_SYNC;
		delete env.VITE_CLOUD_SYNC_URL;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("queues and flushes operations in hybrid mode", async () => {
		const fetchMock = vi.fn<
			(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
		>(async () => new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		const {
			addCalculation,
			clearCalculations,
			flushCloudSyncNow,
			getCloudSyncStatus,
			listCalculations,
		} = await importDb();

		await clearCalculations();
		await flushCloudSyncNow();
		fetchMock.mockClear();

		await addCalculation(baseRecord({ id: "a" }));
		await flushCloudSyncNow();

		await expect(listCalculations()).resolves.toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(getCloudSyncStatus().queuedCount).toBe(0);

		const options = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(options).toMatchObject({ method: "POST" });
	});

	it("keeps operations queued and enters backoff when cloud sync fails", async () => {
		const fetchMock = vi.fn<
			(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
		>(async () => new Response(null, { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);
		vi.spyOn(Math, "random").mockReturnValue(0);

		const {
			addCalculation,
			clearCalculations,
			flushCloudSyncNow,
			getCloudSyncStatus,
		} = await importDb();

		await clearCalculations();
		await flushCloudSyncNow();

		await addCalculation(baseRecord({ id: "b" }));
		await flushCloudSyncNow();

		const status = getCloudSyncStatus();
		expect(status.queuedCount).toBeGreaterThan(0);
		expect(status.state).toBe("backoff");
		expect(status.nextAttemptAt).toBeTypeOf("number");
	});
});
