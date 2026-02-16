import { X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

/**
 * Filter state for saved calculations.
 */
export interface FilterState {
	searchQuery: string;
	unitFilter: "all" | "mm" | "in";
	dateFrom: string;
	dateTo: string;
	kMin: string;
	kMax: string;
	dMin: string;
	dMax: string;
	DMin: string;
	DMax: string;
	nMin: string;
	nMax: string;
}

interface FilterControlsProps {
	filters: FilterState;
	activeFilterCount: number;
	onFilterChange: (field: keyof FilterState, value: string) => void;
	onClearAllFilters: () => void;
}

/**
 * Filter and search controls for saved calculations table.
 */
export function FilterControls({
	filters,
	activeFilterCount,
	onFilterChange,
	onClearAllFilters,
}: FilterControlsProps) {
	return (
		<div className="space-y-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50">
			{/* Search input */}
			<div className="flex items-center gap-2">
				<Input
					type="text"
					placeholder="Search manufacturer, part number, notes..."
					value={filters.searchQuery}
					onChange={(e) => onFilterChange("searchQuery", e.target.value)}
					className="h-9 flex-1"
				/>
				{activeFilterCount > 0 ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-9"
						onClick={onClearAllFilters}
					>
						<X className="mr-1 h-4 w-4" />
						Clear all filters
					</Button>
				) : null}
			</div>

			{/* Filter controls row */}
			<div className="flex flex-wrap items-center gap-2">
				{/* Units filter */}
				<div className="flex items-center gap-1.5">
					<label
						htmlFor="unit-filter"
						className="text-xs font-medium text-slate-600 dark:text-slate-400"
					>
						Units:
					</label>
					<select
						id="unit-filter"
						value={filters.unitFilter}
						onChange={(e) => onFilterChange("unitFilter", e.target.value)}
						className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
					>
						<option value="all">All</option>
						<option value="mm">mm</option>
						<option value="in">in</option>
					</select>
				</div>

				{/* Date range */}
				<div className="flex items-center gap-1.5">
					<label
						htmlFor="date-from"
						className="text-xs font-medium text-slate-600 dark:text-slate-400"
					>
						From:
					</label>
					<Input
						id="date-from"
						type="date"
						value={filters.dateFrom}
						onChange={(e) => onFilterChange("dateFrom", e.target.value)}
						className="h-8 w-36"
					/>
				</div>

				<div className="flex items-center gap-1.5">
					<label
						htmlFor="date-to"
						className="text-xs font-medium text-slate-600 dark:text-slate-400"
					>
						To:
					</label>
					<Input
						id="date-to"
						type="date"
						value={filters.dateTo}
						onChange={(e) => onFilterChange("dateTo", e.target.value)}
						className="h-8 w-36"
					/>
				</div>
			</div>

			{/* Numeric range filters */}
			<details className="group">
				<summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
					Advanced filters (k, d, D, n ranges)
				</summary>
				<div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
					{/* k range */}
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
							k (spring rate)
						</span>
						<div className="flex gap-1">
							<Input
								type="number"
								placeholder="Min"
								value={filters.kMin}
								onChange={(e) => onFilterChange("kMin", e.target.value)}
								className="h-8 text-xs"
								aria-label="Minimum spring rate (k)"
							/>
							<Input
								type="number"
								placeholder="Max"
								value={filters.kMax}
								onChange={(e) => onFilterChange("kMax", e.target.value)}
								className="h-8 text-xs"
								aria-label="Maximum spring rate (k)"
							/>
						</div>
					</div>

					{/* d range */}
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
							d (wire diameter)
						</span>
						<div className="flex gap-1">
							<Input
								type="number"
								placeholder="Min"
								value={filters.dMin}
								onChange={(e) => onFilterChange("dMin", e.target.value)}
								className="h-8 text-xs"
								aria-label="Minimum wire diameter (d)"
							/>
							<Input
								type="number"
								placeholder="Max"
								value={filters.dMax}
								onChange={(e) => onFilterChange("dMax", e.target.value)}
								className="h-8 text-xs"
								aria-label="Maximum wire diameter (d)"
							/>
						</div>
					</div>

					{/* D range */}
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
							D (coil OD)
						</span>
						<div className="flex gap-1">
							<Input
								type="number"
								placeholder="Min"
								value={filters.DMin}
								onChange={(e) => onFilterChange("DMin", e.target.value)}
								className="h-8 text-xs"
								aria-label="Minimum coil OD (D)"
							/>
							<Input
								type="number"
								placeholder="Max"
								value={filters.DMax}
								onChange={(e) => onFilterChange("DMax", e.target.value)}
								className="h-8 text-xs"
								aria-label="Maximum coil OD (D)"
							/>
						</div>
					</div>

					{/* n range */}
					<div className="flex flex-col gap-1">
						<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
							n (active coils)
						</span>
						<div className="flex gap-1">
							<Input
								type="number"
								placeholder="Min"
								value={filters.nMin}
								onChange={(e) => onFilterChange("nMin", e.target.value)}
								className="h-8 text-xs"
								aria-label="Minimum active coils (n)"
							/>
							<Input
								type="number"
								placeholder="Max"
								value={filters.nMax}
								onChange={(e) => onFilterChange("nMax", e.target.value)}
								className="h-8 text-xs"
								aria-label="Maximum active coils (n)"
							/>
						</div>
					</div>
				</div>
			</details>

			{/* Active filter indicators */}
			{activeFilterCount > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium text-slate-600 dark:text-slate-400">
						Active filters:
					</span>
					{filters.searchQuery ? (
						<Badge variant="secondary" className="gap-1">
							Search: {filters.searchQuery}
							<button
								type="button"
								onClick={() => onFilterChange("searchQuery", "")}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear search"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.unitFilter !== "all" ? (
						<Badge variant="secondary" className="gap-1">
							Units: {filters.unitFilter}
							<button
								type="button"
								onClick={() => onFilterChange("unitFilter", "all")}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear unit filter"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.dateFrom ? (
						<Badge variant="secondary" className="gap-1">
							From: {filters.dateFrom}
							<button
								type="button"
								onClick={() => onFilterChange("dateFrom", "")}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear date from"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.dateTo ? (
						<Badge variant="secondary" className="gap-1">
							To: {filters.dateTo}
							<button
								type="button"
								onClick={() => onFilterChange("dateTo", "")}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear date to"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.kMin || filters.kMax ? (
						<Badge variant="secondary" className="gap-1">
							k: {filters.kMin || "−∞"} to {filters.kMax || "+∞"}
							<button
								type="button"
								onClick={() => {
									onFilterChange("kMin", "");
									onFilterChange("kMax", "");
								}}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear k range"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.dMin || filters.dMax ? (
						<Badge variant="secondary" className="gap-1">
							d: {filters.dMin || "−∞"} to {filters.dMax || "+∞"}
							<button
								type="button"
								onClick={() => {
									onFilterChange("dMin", "");
									onFilterChange("dMax", "");
								}}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear d range"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.DMin || filters.DMax ? (
						<Badge variant="secondary" className="gap-1">
							D: {filters.DMin || "−∞"} to {filters.DMax || "+∞"}
							<button
								type="button"
								onClick={() => {
									onFilterChange("DMin", "");
									onFilterChange("DMax", "");
								}}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear D range"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
					{filters.nMin || filters.nMax ? (
						<Badge variant="secondary" className="gap-1">
							n: {filters.nMin || "−∞"} to {filters.nMax || "+∞"}
							<button
								type="button"
								onClick={() => {
									onFilterChange("nMin", "");
									onFilterChange("nMax", "");
								}}
								className="ml-1 hover:text-slate-700 dark:hover:text-slate-300"
								aria-label="Clear n range"
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					) : null}
				</div>
			) : null}
		</div>
	);
}
