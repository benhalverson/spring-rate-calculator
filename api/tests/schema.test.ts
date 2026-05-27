import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { calculations } from "../src/db/schema";

describe("calculations Drizzle schema", () => {
	const config = getTableConfig(calculations);
	const columns = new Map(
		config.columns.map((column) => [column.name, column]),
	);

	it("defines the expected calculations table columns", () => {
		expect(config.name).toBe("calculations");
		expect([...columns.keys()]).toEqual([
			"id",
			"created_at",
			"updated_at",
			"deleted_at",
			"user_id",
			"session_id",
			"manufacturer",
			"part_number",
			"purchase_url",
			"notes",
			"units",
			"wire_diameter",
			"outer_diameter",
			"active_coils",
			"average_diameter",
			"spring_rate",
			"sync_version",
			"device_id",
		]);
	});

	it("keeps core identity and spring fields required", () => {
		for (const columnName of [
			"id",
			"created_at",
			"updated_at",
			"manufacturer",
			"part_number",
			"units",
			"wire_diameter",
			"outer_diameter",
			"active_coils",
			"average_diameter",
			"spring_rate",
			"sync_version",
		]) {
			expect(columns.get(columnName)?.notNull).toBe(true);
		}

		expect(columns.get("id")?.primary).toBe(true);
		expect(columns.get("sync_version")?.default).toBe(1);
	});

	it("defines the required lookup and sync indexes", () => {
		const indexNames = config.indexes.map((index) => index.config.name).sort();

		expect(indexNames).toEqual([
			"idx_calculations_created_at",
			"idx_calculations_deleted_at",
			"idx_calculations_manufacturer_part",
			"idx_calculations_updated_at",
			"idx_calculations_user_session",
		]);
	});

	it("constrains units to supported measurement systems", () => {
		expect(calculations.units.enumValues).toEqual(["mm", "in"]);
		expect(config.checks.map((constraint) => constraint.name)).toContain(
			"calculations_units_check",
		);
	});
});
