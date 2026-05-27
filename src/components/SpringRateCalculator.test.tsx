import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearCalculations, listCalculations } from "../lib/db";
import { SpringRateCalculator } from "./SpringRateCalculator";

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.type(screen.getByLabelText("Wire diameter d"), "1.2");
	await user.type(screen.getByLabelText("Coil OD D"), "10.5");
	await user.type(screen.getByLabelText("Active coils n"), "6");
	await user.type(screen.getByLabelText("Manufacturer"), "Team Associated");
	await user.type(screen.getByLabelText("Part number"), "ASC91322");
};

const createCalculation = async (
	user: ReturnType<typeof userEvent.setup>,
	options: {
		wireDiameter: string;
		coilOD: string;
		activeCoils: string;
		manufacturer: string;
		partNumber: string;
	},
) => {
	const wireDiameterInput = screen.getByLabelText("Wire diameter d");
	const coilODInput = screen.getByLabelText("Coil OD D");
	const activeCoilsInput = screen.getByLabelText("Active coils n");
	const manufacturerInput = screen.getByLabelText("Manufacturer");
	const partNumberInput = screen.getByLabelText("Part number");

	await user.clear(wireDiameterInput);
	await user.clear(coilODInput);
	await user.clear(activeCoilsInput);
	await user.clear(manufacturerInput);
	await user.clear(partNumberInput);

	await user.type(wireDiameterInput, options.wireDiameter);
	await user.type(coilODInput, options.coilOD);
	await user.type(activeCoilsInput, options.activeCoils);
	await user.type(manufacturerInput, options.manufacturer);
	await user.type(partNumberInput, options.partNumber);
	await user.click(screen.getByRole("button", { name: "Save" }));
};

describe("SpringRateCalculator", () => {
	beforeEach(async () => {
		await clearCalculations();
	});

	it("saves a valid calculation and shows it in history", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);

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

	it("shows URL validation error and blocks save for invalid purchase URL", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);
		await user.type(
			screen.getByLabelText("Purchase URL (optional)"),
			"not-a-url",
		);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toBeEnabled();

		await user.click(saveButton);

		expect(
			screen.getByText("Purchase URL must be a valid URL."),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Fix validation errors before saving/i),
		).toBeInTheDocument();
		await expect(listCalculations()).resolves.toHaveLength(0);
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

		const sortSelect = screen.getByLabelText("Saved results sort");
		await user.selectOptions(sortSelect, "k-asc");

		let rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-A");
		expect(rows[2]).toHaveTextContent("MFG-B");

		await user.selectOptions(sortSelect, "k-desc");

		rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-B");
		expect(rows[2]).toHaveTextContent("MFG-A");

		await user.selectOptions(sortSelect, "created-desc");

		rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-B");
		expect(rows[2]).toHaveTextContent("MFG-A");
	});

	it("filters saved results by search text and units", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "Alpha Springs",
			partNumber: "AL-1",
		});

		await user.click(screen.getByRole("button", { name: /^in$/i }));
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "Beta Springs",
			partNumber: "BE-2",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		await user.type(screen.getByLabelText("Search saved results"), "alpha");

		expect(
			screen.getByRole("cell", { name: "Alpha Springs" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "Beta Springs" }),
		).not.toBeInTheDocument();

		await user.clear(screen.getByLabelText("Search saved results"));
		await user.selectOptions(screen.getByLabelText("Filter by units"), "in");

		expect(
			screen.getByRole("cell", { name: "Beta Springs" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "Alpha Springs" }),
		).not.toBeInTheDocument();

		await user.selectOptions(screen.getByLabelText("Filter by units"), "mm");
		expect(
			screen.getByRole("cell", { name: "Alpha Springs" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "Beta Springs" }),
		).not.toBeInTheDocument();
	});

	it("clears all filters and restores full results", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "Gamma",
			partNumber: "GA-1",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "Delta",
			partNumber: "DE-2",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		await user.type(screen.getByLabelText("Search saved results"), "zzz");
		expect(
			screen.getByText(/No saved results match your search\/filters/i),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Clear all filters" }));

		expect(screen.getByRole("cell", { name: "Gamma" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "Delta" })).toBeInTheDocument();
	});

	it("loads and deletes a saved record", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);
		await user.type(screen.getByLabelText("Notes (optional)"), "Front shock");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		await user.clear(screen.getByLabelText("Wire diameter d"));
		expect(screen.getByLabelText("Wire diameter d")).toHaveValue(null);

		await user.click(screen.getByRole("button", { name: "Load" }));
		expect(screen.getByLabelText("Wire diameter d")).toHaveValue(1.2);
		expect(screen.getByLabelText("Notes (optional)")).toHaveValue(
			"Front shock",
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		await expect(listCalculations()).resolves.toHaveLength(0);
		await waitFor(() => {
			expect(
				screen.getByText(/No saved calculations yet/i),
			).toBeInTheDocument();
		});
	});

	it("supports clear-all confirm and cancel flow", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		await user.click(screen.getByRole("button", { name: "Clear all" }));
		await screen.findByRole("button", { name: "Confirm clear" });

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await screen.findByRole("button", { name: "Clear all" });
		await expect(listCalculations()).resolves.toHaveLength(1);

		await user.click(screen.getByRole("button", { name: "Clear all" }));
		await user.click(screen.getByRole("button", { name: "Confirm clear" }));
		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(0);
		});
	});

	it("updates units and online/offline indicator", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		expect(screen.getByText("Online")).toBeInTheDocument();
		window.dispatchEvent(new Event("offline"));
		await waitFor(() => {
			expect(
				screen.getByText(/Offline \(working locally\)/i),
			).toBeInTheDocument();
		});
		window.dispatchEvent(new Event("online"));
		await waitFor(() => {
			expect(screen.getByText("Online")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /^in$/i }));
		await fillValidForm(user);
		expect(
			screen.getByText(/Assuming spring steel: G = 11,500,000 psi/i),
		).toBeInTheDocument();
		expect(screen.getByText(/lbf\/in/i)).toBeInTheDocument();
	});

	it("shows install button when beforeinstallprompt fires", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		const promptMock = vi.fn(async () => {});
		const userChoice = Promise.resolve({ outcome: "accepted" as const });
		const event = new Event("beforeinstallprompt", {
			cancelable: true,
		}) as Event & {
			prompt: () => Promise<void>;
			userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
		};
		event.prompt = promptMock;
		event.userChoice = userChoice;

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		});
		window.dispatchEvent(event);
		const installButton = await screen.findByRole("button", {
			name: "Install",
		});
		expect(installButton).toBeInTheDocument();
		await user.click(installButton);
		expect(promptMock).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "Install" }),
			).not.toBeInTheDocument();
		});
	});

	it("resets all fields", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);
		await user.type(screen.getByLabelText("Notes (optional)"), "temp");
		await user.click(screen.getByRole("button", { name: "Reset" }));

		expect(screen.getByLabelText("Wire diameter d")).toHaveValue(null);
		expect(screen.getByLabelText("Coil OD D")).toHaveValue(null);
		expect(screen.getByLabelText("Active coils n")).toHaveValue(null);
		expect(screen.getByLabelText("Manufacturer")).toHaveValue("");
		expect(screen.getByLabelText("Part number")).toHaveValue("");
		expect(screen.getByLabelText("Notes (optional)")).toHaveValue("");
	});

	it("deletes correct records using snapshot of selection at click time", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await createCalculation(user, {
			wireDiameter: "1.0",
			coilOD: "10.0",
			activeCoils: "5",
			manufacturer: "MFG-1",
			partNumber: "PN-1",
		});

		await createCalculation(user, {
			wireDiameter: "1.5",
			coilOD: "10.0",
			activeCoils: "5",
			manufacturer: "MFG-2",
			partNumber: "PN-2",
		});

		await createCalculation(user, {
			wireDiameter: "2.0",
			coilOD: "10.0",
			activeCoils: "5",
			manufacturer: "MFG-3",
			partNumber: "PN-3",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(3);
		});

		// Select first two checkboxes (MFG-3 and MFG-2, newest first)
		const checkboxes = screen.getAllByRole("checkbox");
		await user.click(checkboxes[1]);
		await user.click(checkboxes[2]);

		await user.click(screen.getByRole("button", { name: "Delete selected" }));
		await screen.findByRole("button", { name: "Confirm delete 2" });
		await user.click(screen.getByRole("button", { name: "Confirm delete 2" }));

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		expect(screen.getByRole("cell", { name: "MFG-1" })).toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "MFG-2" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "MFG-3" }),
		).not.toBeInTheDocument();
		expect(screen.getByText("2 calculations deleted.")).toBeInTheDocument();
	});

	it("selects and deselects individual rows with checkboxes", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save two calculations
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		// Select first row
		const firstRowCheckbox = screen.getByRole("checkbox", {
			name: /Select row for MFG-A PN-A/i,
		});
		await user.click(firstRowCheckbox);

		// Selection bar should appear showing 1 selected
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Select second row
		const secondRowCheckbox = screen.getByRole("checkbox", {
			name: /Select row for MFG-B PN-B/i,
		});
		await user.click(secondRowCheckbox);

		// Selection bar should now show 2 selected
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Deselect first row
		await user.click(firstRowCheckbox);
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Deselect second row
		await user.click(secondRowCheckbox);

		// Selection bar should be gone
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();
	});

	it("shows header checkbox in indeterminate state when some rows are selected", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save two calculations
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		const headerCheckbox = screen.getByRole("checkbox", {
			name: "Select all rows",
		});

		// Initially unchecked and not indeterminate
		expect(headerCheckbox).not.toBeChecked();

		// Select one row
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		);

		// Header checkbox should be in indeterminate state (checked but partially)
		await waitFor(() => {
			const checkbox = headerCheckbox as HTMLInputElement;
			expect(checkbox.indeterminate).toBe(true);
		});

		// Select the other row (all rows selected)
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-B PN-B/i,
			}),
		);

		// Header checkbox should now be fully checked
		await waitFor(() => {
			expect(headerCheckbox).toBeChecked();
			const checkbox = headerCheckbox as HTMLInputElement;
			expect(checkbox.indeterminate).toBe(false);
		});
	});

	it("selects and deselects all rows using header checkbox", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save two calculations
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		const headerCheckbox = screen.getByRole("checkbox", {
			name: "Select all rows",
		});

		// Click header checkbox to select all
		await user.click(headerCheckbox);

		// Should show 2 rows selected
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Both row checkboxes should be checked
		expect(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		).toBeChecked();
		expect(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-B PN-B/i,
			}),
		).toBeChecked();

		// Click header checkbox again to deselect all
		await user.click(headerCheckbox);

		// Selection bar should be gone
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();

		// Row checkboxes should be unchecked
		expect(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		).not.toBeChecked();
		expect(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-B PN-B/i,
			}),
		).not.toBeChecked();
	});

	it("clears selection using the clear selection button", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save a calculation
		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		// Select the row
		const checkbox = screen.getByRole("checkbox", {
			name: /Select row for Team Associated ASC91322/i,
		});
		await user.click(checkbox);

		// Selection bar should appear
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Click clear selection button
		await user.click(screen.getByRole("button", { name: "Clear selection" }));

		// Selection bar should be gone
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();

		// Checkbox should be unchecked
		expect(checkbox).not.toBeChecked();
	});

	it("supports bulk delete confirm and cancel flow", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save three calculations
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await createCalculation(user, {
			wireDiameter: "2.0",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-C",
			partNumber: "PN-C",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(3);
		});

		// Select two rows
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		);
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-B PN-B/i,
			}),
		);

		// Initiate bulk delete
		await user.click(screen.getByRole("button", { name: "Delete selected" }));

		// Should show confirm button
		await screen.findByRole("button", { name: "Confirm delete 2" });

		// Cancel the delete
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		// Should go back to delete selected button
		await screen.findByRole("button", { name: "Delete selected" });

		// All rows should still exist
		await expect(listCalculations()).resolves.toHaveLength(3);
	});

	it("resets bulk-delete confirm mode when selection is cleared", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(2);
		});

		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		);

		await user.click(screen.getByRole("button", { name: "Delete selected" }));
		await screen.findByRole("button", { name: "Confirm delete 1" });

		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		);

		expect(
			screen.queryByRole("button", { name: "Confirm delete 1" }),
		).not.toBeInTheDocument();
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();
	});

	it("deletes only selected rows and removes them from UI and IndexedDB", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save three calculations
		await createCalculation(user, {
			wireDiameter: "1.2",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-A",
			partNumber: "PN-A",
		});

		await createCalculation(user, {
			wireDiameter: "1.8",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-B",
			partNumber: "PN-B",
		});

		await createCalculation(user, {
			wireDiameter: "2.0",
			coilOD: "10.5",
			activeCoils: "6",
			manufacturer: "MFG-C",
			partNumber: "PN-C",
		});

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(3);
		});

		// Select first and third rows
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-A PN-A/i,
			}),
		);
		await user.click(
			screen.getByRole("checkbox", {
				name: /Select row for MFG-C PN-C/i,
			}),
		);

		// Initiate and confirm bulk delete
		await user.click(screen.getByRole("button", { name: "Delete selected" }));
		await user.click(screen.getByRole("button", { name: "Confirm delete 2" }));

		// Wait for deletion to complete
		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		// MFG-B should still be visible in UI
		expect(screen.getByRole("cell", { name: "MFG-B" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "PN-B" })).toBeInTheDocument();

		// MFG-A and MFG-C should be gone from UI
		expect(
			screen.queryByRole("cell", { name: "MFG-A" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("cell", { name: "MFG-C" }),
		).not.toBeInTheDocument();

		// Verify IndexedDB only contains MFG-B
		const remaining = await listCalculations();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].manufacturer).toBe("MFG-B");
		expect(remaining[0].partNumber).toBe("PN-B");

		// Selection bar should be gone after successful delete
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();

		// Toast should show deletion message
		expect(screen.getByText("2 calculations deleted.")).toBeInTheDocument();
	});

	it("displays helper text for all input fields by default", () => {
		render(<SpringRateCalculator />);

		expect(
			screen.getByText(
				/Must be a positive number\. Typical range: 0\.5–3 mm\./i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Must be a positive number.*\. Typical range: 5–15 mm\./i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Must be a positive number, typically an integer\. Common range: 4–10\./i,
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Required\. The spring manufacturer or brand name\./i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Required\. The manufacturer's part or model number\./i),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				/Optional\. Must be a valid URL \(e\.g\., https:\/\/example\.com\)\./i,
			),
		).toBeInTheDocument();
	});

	it("shows dynamic hint when d is entered, indicating D must be greater than d", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "2.5");

		expect(
			screen.getByText(
				/Must be a positive number and greater than 2\.5 mm\. Typical range: 5–15 mm\./i,
			),
		).toBeInTheDocument();
	});

	it("shows warning icon for non-integer n values", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await user.type(screen.getByLabelText("Wire diameter d"), "1.2");
		await user.type(screen.getByLabelText("Coil OD D"), "10.5");
		await user.type(screen.getByLabelText("Active coils n"), "6.5");

		await user.type(screen.getByLabelText("Manufacturer"), "Test");
		await user.type(screen.getByLabelText("Part number"), "Test123");

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(
			screen.getByText(/⚠ Active coils is typically an integer\./i),
		).toBeInTheDocument();
	});

	it("ensures helper text is accessible via aria-describedby", () => {
		render(<SpringRateCalculator />);

		const dInput = screen.getByLabelText("Wire diameter d");
		const DInput = screen.getByLabelText("Coil OD D");
		const nInput = screen.getByLabelText("Active coils n");
		const manufacturerInput = screen.getByLabelText("Manufacturer");
		const partNumberInput = screen.getByLabelText("Part number");
		const purchaseUrlInput = screen.getByLabelText("Purchase URL (optional)");

		expect(dInput).toHaveAttribute("aria-describedby", "d-helper");
		expect(DInput).toHaveAttribute("aria-describedby", "D-helper");
		expect(nInput).toHaveAttribute("aria-describedby", "n-helper");
		expect(manufacturerInput).toHaveAttribute(
			"aria-describedby",
			"manufacturer-helper",
		);
		expect(partNumberInput).toHaveAttribute(
			"aria-describedby",
			"part-number-helper",
		);
		expect(purchaseUrlInput).toHaveAttribute(
			"aria-describedby",
			"purchase-url-helper",
		);
	});

	it("supports keyboard-only row selection via space key", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(async () => {
			await expect(listCalculations()).resolves.toHaveLength(1);
		});

		const rowCheckbox = screen.getByRole("checkbox", {
			name: /Select row for Team Associated ASC91322/i,
		});

		rowCheckbox.focus();
		await user.keyboard("[Space]");
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		await user.keyboard("[Space]");
		expect(screen.queryByText(/row selected/i)).not.toBeInTheDocument();
	});
});
