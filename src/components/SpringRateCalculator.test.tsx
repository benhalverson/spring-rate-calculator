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
		await user.type(screen.getByLabelText("Manufacturer"), "Team Associated");
		await user.type(screen.getByLabelText("Part number"), "ASC91322");

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeEnabled();

		await user.click(saveButton);

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		expect(screen.getByText(/Calculation saved/i)).toBeInTheDocument();
		expect(
			screen.getByRole("cell", { name: "Team Associated" }),
		).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "ASC91322" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "1.2" })).toBeInTheDocument();
	});

	it("shows validation error when D is not greater than d", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "2.5");
		await user.type(screen.getByLabelText("Coil OD D"), "2.5");
		await user.type(screen.getByLabelText("Active coils n"), "6");
		await user.type(screen.getByLabelText("Manufacturer"), "Team Associated");
		await user.type(screen.getByLabelText("Part number"), "ASC91322");

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeDisabled();
		expect(screen.getByText(/Davg = D − d = 0 mm/i)).toBeInTheDocument();
		await expect(listCalculations()).resolves.toHaveLength(0);
	});

	it("sorts saved rows by k ascending and descending", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "1.2");
		await user.type(screen.getByLabelText("Coil OD D"), "10.5");
		await user.type(screen.getByLabelText("Active coils n"), "6");
		await user.type(screen.getByLabelText("Manufacturer"), "MFG-A");
		await user.type(screen.getByLabelText("Part number"), "PN-A");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.clear(screen.getByLabelText("Coil OD D"));
		await user.clear(screen.getByLabelText("Active coils n"));
		await user.clear(screen.getByLabelText("Manufacturer"));
		await user.clear(screen.getByLabelText("Part number"));

		await user.type(screen.getByLabelText("Wire diameter d"), "1.8");
		await user.type(screen.getByLabelText("Coil OD D"), "10.5");
		await user.type(screen.getByLabelText("Active coils n"), "6");
		await user.type(screen.getByLabelText("Manufacturer"), "MFG-B");
		await user.type(screen.getByLabelText("Part number"), "PN-B");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		const sortButton = screen.getByRole("button", {
			name: /Toggle k sorting/i,
		});
		await user.click(sortButton);

		let rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-A");
		expect(rows[2]).toHaveTextContent("MFG-B");

		await user.click(
			screen.getByRole("button", {
				name: /Toggle k sorting/i,
			}),
		);

		rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-B");
		expect(rows[2]).toHaveTextContent("MFG-A");
	});
});
