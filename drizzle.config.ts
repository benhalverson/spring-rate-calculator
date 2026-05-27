import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./api/src/db/schema.ts",
	out: "./api/db/migrations",
	dialect: "sqlite",
});
