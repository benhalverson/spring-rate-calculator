import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	real,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const calculations = sqliteTable(
	"calculations",
	{
		id: text("id").primaryKey(),
		createdAt: integer("created_at", { mode: "number" }).notNull(),
		updatedAt: integer("updated_at", { mode: "number" }).notNull(),
		deletedAt: integer("deleted_at", { mode: "number" }),
		userId: text("user_id"),
		sessionId: text("session_id"),
		manufacturer: text("manufacturer").notNull(),
		partNumber: text("part_number").notNull(),
		purchaseUrl: text("purchase_url"),
		notes: text("notes"),
		units: text("units", { enum: ["mm", "in"] }).notNull(),
		wireDiameter: real("wire_diameter").notNull(),
		outerDiameter: real("outer_diameter").notNull(),
		activeCoils: real("active_coils").notNull(),
		averageDiameter: real("average_diameter").notNull(),
		springRate: real("spring_rate").notNull(),
		syncVersion: integer("sync_version", { mode: "number" })
			.notNull()
			.default(1),
		deviceId: text("device_id"),
	},
	(table) => [
		index("idx_calculations_created_at").on(table.createdAt),
		index("idx_calculations_user_session").on(table.userId, table.sessionId),
		index("idx_calculations_manufacturer_part").on(
			table.manufacturer,
			table.partNumber,
		),
		index("idx_calculations_updated_at").on(table.updatedAt),
		index("idx_calculations_deleted_at")
			.on(table.deletedAt)
			.where(sql`${table.deletedAt} is not null`),
		check("calculations_units_check", sql`${table.units} in ('mm', 'in')`),
	],
);

export type Calculation = typeof calculations.$inferSelect;
export type NewCalculation = typeof calculations.$inferInsert;
