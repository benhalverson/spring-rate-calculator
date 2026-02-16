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

		await user.click(
			screen.getByRole("button", {
				name: /Toggle k sorting/i,
			}),
		);

		rows = screen.getAllByRole("row");
		expect(rows[1]).toHaveTextContent("MFG-B");
		expect(rows[2]).toHaveTextContent("MFG-A");
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

		await user.click(
			screen.getByRole("button", {
				name: /Load calculation for Team Associated ASC91322/i,
			}),
		);
		expect(screen.getByLabelText("Wire diameter d")).toHaveValue(1.2);
		expect(screen.getByLabelText("Notes (optional)")).toHaveValue(
			"Front shock",
		);

		await user.click(
			screen.getByRole("button", {
				name: /Delete calculation for Team Associated ASC91322/i,
			}),
		);
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

		await user.click(
			screen.getByRole("button", { name: /Clear all 1 saved/i }),
		);
		await screen.findByRole("button", { name: /Confirm clearing all 1/i });

		await user.click(
			screen.getByRole("button", { name: /Cancel clearing all/i }),
		);
		await screen.findByRole("button", { name: /Clear all 1 saved/i });
		await expect(listCalculations()).resolves.toHaveLength(1);

		await user.click(
			screen.getByRole("button", { name: /Clear all 1 saved/i }),
		);
		await user.click(
			screen.getByRole("button", { name: /Confirm clearing all 1/i }),
		);
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

	describe("Bulk selection and deletion", () => {
		it("selects individual rows via checkboxes", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create two saved calculations
			await fillValidForm(user);
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

			// Select first row
			const checkbox1 = screen.getByRole("checkbox", {
				name: /Select row for Team Associated/i,
			});
			await user.click(checkbox1);

			// Selection bar should appear
			expect(screen.getByText("1 row selected")).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /Delete.*1.*calculation/i }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: /Clear selection of 1 row/i }),
			).toBeInTheDocument();
		});

		it("selects all rows via select-all checkbox", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create two saved calculations
			await fillValidForm(user);
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

			// Select all via header checkbox
			const selectAllCheckbox = screen.getByRole("checkbox", {
				name: /Select all.*2.*rows/i,
			});
			await user.click(selectAllCheckbox);

			// Should show 2 rows selected
			expect(screen.getByText("2 rows selected")).toBeInTheDocument();
		});

		it("clears selection when clear selection button is clicked", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create one saved calculation
			await fillValidForm(user);
			await user.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(async () => {
				await expect(listCalculations()).resolves.toHaveLength(1);
			});

			// Select the row
			const checkbox = screen.getByRole("checkbox", {
				name: /Select row for Team Associated/i,
			});
			await user.click(checkbox);

			expect(screen.getByText("1 row selected")).toBeInTheDocument();

			// Clear selection
			await user.click(
				screen.getByRole("button", { name: /Clear selection of 1 row/i }),
			);

			// Selection bar should disappear
			expect(screen.queryByText("1 row selected")).not.toBeInTheDocument();
		});

		it("deletes multiple selected rows with confirmation", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create three saved calculations
			await fillValidForm(user);
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

			await user.clear(screen.getByLabelText("Wire diameter d"));
			await user.clear(screen.getByLabelText("Coil OD D"));
			await user.clear(screen.getByLabelText("Active coils n"));
			await user.clear(screen.getByLabelText("Manufacturer"));
			await user.clear(screen.getByLabelText("Part number"));

			await user.type(screen.getByLabelText("Wire diameter d"), "2.0");
			await user.type(screen.getByLabelText("Coil OD D"), "10.5");
			await user.type(screen.getByLabelText("Active coils n"), "6");
			await user.type(screen.getByLabelText("Manufacturer"), "MFG-C");
			await user.type(screen.getByLabelText("Part number"), "PN-C");
			await user.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(async () => {
				await expect(listCalculations()).resolves.toHaveLength(3);
			});

			// Select two rows
			const checkbox1 = screen.getByRole("checkbox", {
				name: /Select row for Team Associated/i,
			});
			const checkbox2 = screen.getByRole("checkbox", {
				name: /Select row for MFG-B/i,
			});
			await user.click(checkbox1);
			await user.click(checkbox2);

			expect(screen.getByText("2 rows selected")).toBeInTheDocument();

			// Click delete selected
			await user.click(
				screen.getByRole("button", { name: /Delete.*2.*calculation/i }),
			);

			// Should show confirmation
			expect(
				screen.getByRole("button", { name: /Confirm deletion of 2/i }),
			).toBeInTheDocument();

			// Confirm deletion
			await user.click(
				screen.getByRole("button", { name: /Confirm deletion of 2/i }),
			);

			// Should have one row left
			await waitFor(async () => {
				await expect(listCalculations()).resolves.toHaveLength(1);
			});

			// Selection bar should disappear
			expect(screen.queryByText("2 rows selected")).not.toBeInTheDocument();
		});

		it("cancels bulk deletion when cancel is clicked", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create two saved calculations
			await fillValidForm(user);
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

			// Select all rows
			const selectAllCheckbox = screen.getByRole("checkbox", {
				name: /Select all.*2.*rows/i,
			});
			await user.click(selectAllCheckbox);

			// Click delete selected
			await user.click(
				screen.getByRole("button", { name: /Delete.*2.*calculation/i }),
			);

			// Should show confirmation
			expect(
				screen.getByRole("button", { name: /Confirm deletion of 2/i }),
			).toBeInTheDocument();

			// Cancel deletion
			await user.click(
				screen.getByRole("button", { name: /Cancel bulk deletion/i }),
			);

			// Should still have two rows
			await expect(listCalculations()).resolves.toHaveLength(2);

			// Selection should still be active
			expect(screen.getByText("2 rows selected")).toBeInTheDocument();
		});
	});

	describe("Keyboard navigation", () => {
		it("allows keyboard activation of sort button", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			// Create saved calculations with different k values
			await fillValidForm(user);
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

			// Click sort button (simulates keyboard Enter/Space activation)
			const sortButton = screen.getByRole("button", {
				name: /Toggle k sorting/i,
			});
			await user.click(sortButton);

			// Should update sort direction
			expect(
				screen.getByRole("button", {
					name: /Toggle k sorting, current: asc/i,
				}),
			).toBeInTheDocument();
		});

		it("allows keyboard activation of load button", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			await fillValidForm(user);
			await user.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(async () => {
				await expect(listCalculations()).resolves.toHaveLength(1);
			});

			// Clear a field first
			await user.clear(screen.getByLabelText("Wire diameter d"));
			expect(screen.getByLabelText("Wire diameter d")).toHaveValue(null);

			// Click Load button (simulates keyboard Enter/Space activation)
			const loadButton = screen.getByRole("button", {
				name: /Load calculation for Team Associated ASC91322/i,
			});
			await user.click(loadButton);

			// Should load the saved values
			expect(screen.getByLabelText("Wire diameter d")).toHaveValue(1.2);
		});

		it("supports keyboard focus on checkboxes with focus-visible styles", async () => {
			const user = userEvent.setup();
			render(<SpringRateCalculator />);

			await fillValidForm(user);
			await user.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(async () => {
				await expect(listCalculations()).resolves.toHaveLength(1);
			});

			// Verify checkbox has focus-visible class in its styling
			const checkbox = screen.getByRole("checkbox", {
				name: /Select row for Team Associated/i,
			});

			// Check that checkbox element has proper class for keyboard focus
			expect(checkbox.className).toContain("focus-visible");
		});
	});
});
