import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["api/tests/**/*.test.ts"],
	},
});
