import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";
import { clearCalculations } from "./lib/db";

describe("App", () => {
	it("renders the spring calculator shell", async () => {
		await clearCalculations();
		render(<App />);

		expect(
			screen.getByRole("heading", { name: "Spring Rate" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Calculator" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Spring Visualizer" }),
		).toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Saved" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});
});
