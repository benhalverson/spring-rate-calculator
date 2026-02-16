import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { clearCalculations } from "../lib/db";
import { SpringRateCalculator } from "./SpringRateCalculator";

const fillValidForm = async (
	user: ReturnType<typeof userEvent.setup>,
	partNum: string,
) => {
	await user.type(screen.getByLabelText("Wire diameter d"), "1.2");
	await user.type(screen.getByLabelText("Coil OD D"), "10.5");
	await user.type(screen.getByLabelText("Active coils n"), "6");
	await user.type(screen.getByLabelText("Manufacturer"), "Test Mfg");
	await user.type(screen.getByLabelText("Part number"), partNum);
};

describe("SpringRateCalculator - Combined Interactions", () => {
	beforeEach(async () => {
		await clearCalculations();
	});

	it("maintains state consistency when sorting, selecting, and deleting records", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save three records with different k values
		await fillValidForm(user, "PART-001");
		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.type(screen.getByLabelText("Wire diameter d"), "1.5"); // Higher k
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(
				screen.getByRole("cell", { name: "PART-001" }),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Reset" }));
		await fillValidForm(user, "PART-002");
		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.type(screen.getByLabelText("Wire diameter d"), "1.0"); // Lower k
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(
				screen.getByRole("cell", { name: "PART-002" }),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Reset" }));
		await fillValidForm(user, "PART-003");
		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.type(screen.getByLabelText("Wire diameter d"), "1.2"); // Medium k
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(
				screen.getByRole("cell", { name: "PART-003" }),
			).toBeInTheDocument();
		});

		// Verify all three records are present
		expect(screen.getByRole("cell", { name: "PART-001" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "PART-002" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "PART-003" })).toBeInTheDocument();

		// Sort by k ascending
		const sortButton = screen.getByRole("button", {
			name: /Toggle k sorting/i,
		});
		await user.click(sortButton);
		await waitFor(() => {
			expect(sortButton).toHaveTextContent("k ↑");
		});

		// Get all rows and verify sort order
		const rows = screen.getAllByRole("row");
		const dataRows = rows.slice(1); // Skip header row
		expect(dataRows[0]).toHaveTextContent("PART-002"); // Lowest k
		expect(dataRows[1]).toHaveTextContent("PART-003"); // Medium k
		expect(dataRows[2]).toHaveTextContent("PART-001"); // Highest k

		// Select middle record (PART-003)
		const checkboxes = screen.getAllByRole("checkbox");
		const part003Checkbox = checkboxes.find((cb) =>
			cb.getAttribute("aria-label")?.includes("PART-003"),
		);
		expect(part003Checkbox).toBeDefined();
		await user.click(part003Checkbox as HTMLElement);

		// Verify selection banner appears
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Sort descending
		await user.click(sortButton);
		await waitFor(() => {
			expect(sortButton).toHaveTextContent("k ↓");
		});

		// Verify selection is maintained after sort change
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Verify new sort order
		const newDataRows = screen.getAllByRole("row").slice(1);
		expect(newDataRows[0]).toHaveTextContent("PART-001"); // Highest k
		expect(newDataRows[1]).toHaveTextContent("PART-003"); // Medium k
		expect(newDataRows[2]).toHaveTextContent("PART-002"); // Lowest k

		// Select another record (PART-001)
		const part001Checkbox = checkboxes.find((cb) =>
			cb.getAttribute("aria-label")?.includes("PART-001"),
		);
		await user.click(part001Checkbox as HTMLElement);

		// Verify 2 rows selected
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Delete selected rows
		const deleteButton = screen.getByRole("button", {
			name: /Delete selected/i,
		});
		await user.click(deleteButton);

		// Confirm delete
		await user.click(screen.getByRole("button", { name: /Confirm delete/i }));

		// Verify toast message
		await waitFor(() => {
			expect(screen.getByText("2 calculations deleted.")).toBeInTheDocument();
		});

		// Verify only PART-002 remains
		await waitFor(() => {
			expect(
				screen.queryByRole("cell", { name: "PART-001" }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("cell", { name: "PART-003" }),
			).not.toBeInTheDocument();
		});
		expect(screen.getByRole("cell", { name: "PART-002" })).toBeInTheDocument();

		// Verify selection is cleared after delete
		expect(screen.queryByText(/rows selected/)).not.toBeInTheDocument();

		// Toggle sort back to none
		await user.click(sortButton);
		expect(sortButton).toHaveTextContent("k");

		// Verify remaining record is still visible
		expect(screen.getByRole("cell", { name: "PART-002" })).toBeInTheDocument();
	}, 10000); // Increased timeout for this complex test

	it("maintains stable behavior when toggling select all across sort changes", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save two records
		await fillValidForm(user, "PART-A");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("cell", { name: "PART-A" })).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Reset" }));
		await fillValidForm(user, "PART-B");
		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.type(screen.getByLabelText("Wire diameter d"), "2.0");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("cell", { name: "PART-B" })).toBeInTheDocument();
		});

		// Select all
		const selectAllCheckbox = screen.getByRole("checkbox", {
			name: /Select all/i,
		});
		await user.click(selectAllCheckbox);
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Sort ascending
		const sortButton = screen.getByRole("button", {
			name: /Toggle k sorting/i,
		});
		await user.click(sortButton);

		// Verify selection count remains consistent
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Deselect all
		await user.click(selectAllCheckbox);
		expect(screen.queryByText(/rows selected/)).not.toBeInTheDocument();

		// Sort descending
		await user.click(sortButton);

		// Select all again
		await user.click(selectAllCheckbox);
		expect(screen.getByText("2 rows selected")).toBeInTheDocument();

		// Clear selection via button
		await user.click(screen.getByRole("button", { name: /Clear selection/i }));
		expect(screen.queryByText(/rows selected/)).not.toBeInTheDocument();
	});

	it("handles load action while selection is active without state corruption", async () => {
		const user = userEvent.setup();
		render(<SpringRateCalculator />);

		// Save two records
		await fillValidForm(user, "PART-X");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("cell", { name: "PART-X" })).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Reset" }));
		await fillValidForm(user, "PART-Y");
		await user.clear(screen.getByLabelText("Wire diameter d"));
		await user.type(screen.getByLabelText("Wire diameter d"), "2.5");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("cell", { name: "PART-Y" })).toBeInTheDocument();
		});

		// Select one record
		const checkboxes = screen.getAllByRole("checkbox");
		const partXCheckbox = checkboxes.find((cb) =>
			cb.getAttribute("aria-label")?.includes("PART-X"),
		);
		await user.click(partXCheckbox as HTMLElement);
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Load the other record (PART-Y)
		// Get all rows excluding header
		const allRows = screen.getAllByRole("row");
		const dataRows = allRows.slice(1); // Skip header row

		// Find the row containing PART-Y and click its Load button
		const partYRow = dataRows.find((row) =>
			row.textContent?.includes("PART-Y"),
		);
		expect(partYRow).toBeDefined();

		const loadButton = partYRow
			?.querySelector('button[type="button"]')
			?.textContent?.includes("Load")
			? partYRow.querySelectorAll('button[type="button"]')[0]
			: null;

		expect(loadButton).not.toBeNull();
		await user.click(loadButton as HTMLElement);

		// Verify form is populated with PART-Y data
		await waitFor(() => {
			expect(screen.getByLabelText("Part number")).toHaveValue("PART-Y");
		});

		// Verify selection state remains intact
		expect(screen.getByText("1 row selected")).toBeInTheDocument();

		// Verify both records still visible in table
		expect(screen.getByRole("cell", { name: "PART-X" })).toBeInTheDocument();
		expect(screen.getByRole("cell", { name: "PART-Y" })).toBeInTheDocument();
	});
});
