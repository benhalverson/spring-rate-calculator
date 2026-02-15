import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { clearCalculations, listCalculations } from "../lib/db";
import { SpringRateCalculator } from "./SpringRateCalculator";

describe("SpringRateCalculator", () => {
	beforeEach(async () => {
		await clearCalculations();
	});

	it("saves a valid calculation and shows it in history", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "1.2");
		await user.type(screen.getByLabelText("Coil OD D"), "10.5");
		await user.type(screen.getByLabelText("Active coils n"), "6");

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeEnabled();

		await user.click(saveButton);

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		expect(screen.getByText(/Calculation saved/i)).toBeInTheDocument();
		expect(screen.getByText(/d=1.2/i)).toBeInTheDocument();
	});

	it("shows validation error when D is not greater than d", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "2.5");
		await user.type(screen.getByLabelText("Coil OD D"), "2.5");
		await user.type(screen.getByLabelText("Active coils n"), "6");

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeDisabled();
		expect(screen.getByText(/Davg = D − d = 0 mm/i)).toBeInTheDocument();
		await expect(listCalculations()).resolves.toHaveLength(0);
	});
});
