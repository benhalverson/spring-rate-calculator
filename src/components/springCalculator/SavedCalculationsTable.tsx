import type { SpringCalcRecord } from "../../types/spring";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import {
	formatK,
	formatValue,
	getRateUnitsLabel,
	getSortLabel,
	type SavedFilters,
	type SavedSortOption,
} from "./utils";

/**
 * Props for the saved calculations table section.
 */
interface SavedCalculationsTableProps {
	records: SpringCalcRecord[];
	totalRecords: number;
	activeFilterCount: number;
	filters: SavedFilters;
	sortOption: SavedSortOption;
	isConfirmingClearAll: boolean;
	selectedIds: Set<string>;
	isConfirmingBulkDelete: boolean;
	onSortOptionChange: (value: SavedSortOption) => void;
	onFilterChange: (key: keyof SavedFilters, value: string) => void;
	onClearFilters: () => void;
	onClearAll: () => Promise<void>;
	onCancelClearAll: () => void;
	onLoad: (record: SpringCalcRecord) => void;
	onDelete: (id: string) => Promise<void>;
	onToggleSelection: (id: string) => void;
	onToggleSelectAll: () => void;
	onBulkDelete: () => Promise<void>;
	onCancelBulkDelete: () => void;
	onClearSelection: () => void;
	onCompare: () => void;
}

/**
 * Renders persisted calculations in a sortable data table with row actions.
 */
export function SavedCalculationsTable({
	records,
	totalRecords,
	activeFilterCount,
	filters,
	sortOption,
	isConfirmingClearAll,
	selectedIds,
	isConfirmingBulkDelete,
	onSortOptionChange,
	onFilterChange,
	onClearFilters,
	onClearAll,
	onCancelClearAll,
	onLoad,
	onDelete,
	onToggleSelection,
	onToggleSelectAll,
	onBulkDelete,
	onCancelBulkDelete,
	onClearSelection,
	onCompare,
}: SavedCalculationsTableProps) {
	const selectedCount = selectedIds.size;
	const allSelected = records.length > 0 && selectedCount === records.length;
	const someSelected = selectedCount > 0 && selectedCount < records.length;
	const canCompare = selectedCount >= 2 && selectedCount <= 4;
	const hasNoMatches = totalRecords > 0 && records.length === 0;

	return (
		<Card className="md:col-span-2">
			<CardHeader className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<CardTitle className="text-[1.05rem] text-slate-700 dark:text-slate-100">
					Saved
					{selectedCount > 0 ? (
						<span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
							({selectedCount} selected)
						</span>
					) : null}
				</CardTitle>
				<div className="inline-flex items-center gap-2">
					{canCompare ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
							onClick={onCompare}
						>
							Compare
						</Button>
					) : null}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 bg-slate-50 text-blue-600 dark:bg-slate-800 dark:text-blue-300"
						onClick={() => void onClearAll()}
					>
						{isConfirmingClearAll ? "Confirm clear" : "Clear all"}
					</Button>
					{isConfirmingClearAll ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8"
							onClick={onCancelClearAll}
						>
							Cancel
						</Button>
					) : null}
				</div>
			</CardHeader>

			<CardContent className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
					<div className="lg:col-span-2">
						<label
							htmlFor="saved-search"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
						>
							Search
						</label>
						<Input
							id="saved-search"
							value={filters.query}
							onChange={(event) => onFilterChange("query", event.target.value)}
							placeholder="Manufacturer, part number, notes"
							aria-label="Search saved results"
							className="h-9"
						/>
					</div>

					<div>
						<label
							htmlFor="saved-units-filter"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
						>
							Units
						</label>
						<select
							id="saved-units-filter"
							className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
							value={filters.units}
							onChange={(event) => onFilterChange("units", event.target.value)}
							aria-label="Filter by units"
						>
							<option value="all">All units</option>
							<option value="mm">mm</option>
							<option value="in">in</option>
						</select>
					</div>

					<div>
						<label
							htmlFor="saved-sort"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
						>
							Sort
						</label>
						<select
							id="saved-sort"
							className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
							value={sortOption}
							onChange={(event) =>
								onSortOptionChange(event.target.value as SavedSortOption)
							}
							aria-label="Saved results sort"
						>
							<option value="created-desc">Date: newest</option>
							<option value="created-asc">Date: oldest</option>
							<option value="k-asc">k: low → high</option>
							<option value="k-desc">k: high → low</option>
						</select>
					</div>

					<div>
						<label
							htmlFor="saved-date-from"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
						>
							Date from
						</label>
						<Input
							id="saved-date-from"
							type="date"
							className="h-9"
							value={filters.dateFrom}
							onChange={(event) =>
								onFilterChange("dateFrom", event.target.value)
							}
							aria-label="Date from"
						/>
					</div>
					<div>
						<label
							htmlFor="saved-date-to"
							className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
						>
							Date to
						</label>
						<Input
							id="saved-date-to"
							type="date"
							className="h-9"
							value={filters.dateTo}
							onChange={(event) => onFilterChange("dateTo", event.target.value)}
							aria-label="Date to"
						/>
					</div>

					<div>
						<p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
							k range
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Input
								type="number"
								className="h-9"
								value={filters.kMin}
								onChange={(event) => onFilterChange("kMin", event.target.value)}
								placeholder="min"
								aria-label="Minimum k"
							/>
							<Input
								type="number"
								className="h-9"
								value={filters.kMax}
								onChange={(event) => onFilterChange("kMax", event.target.value)}
								placeholder="max"
								aria-label="Maximum k"
							/>
						</div>
					</div>

					<div>
						<p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
							d range
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Input
								type="number"
								className="h-9"
								value={filters.dMin}
								onChange={(event) => onFilterChange("dMin", event.target.value)}
								placeholder="min"
								aria-label="Minimum d"
							/>
							<Input
								type="number"
								className="h-9"
								value={filters.dMax}
								onChange={(event) => onFilterChange("dMax", event.target.value)}
								placeholder="max"
								aria-label="Maximum d"
							/>
						</div>
					</div>

					<div>
						<p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
							D range
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Input
								type="number"
								className="h-9"
								value={filters.DMin}
								onChange={(event) => onFilterChange("DMin", event.target.value)}
								placeholder="min"
								aria-label="Minimum D"
							/>
							<Input
								type="number"
								className="h-9"
								value={filters.DMax}
								onChange={(event) => onFilterChange("DMax", event.target.value)}
								placeholder="max"
								aria-label="Maximum D"
							/>
						</div>
					</div>

					<div>
						<p className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
							n range
						</p>
						<div className="grid grid-cols-2 gap-2">
							<Input
								type="number"
								className="h-9"
								value={filters.nMin}
								onChange={(event) => onFilterChange("nMin", event.target.value)}
								placeholder="min"
								aria-label="Minimum n"
							/>
							<Input
								type="number"
								className="h-9"
								value={filters.nMax}
								onChange={(event) => onFilterChange("nMax", event.target.value)}
								placeholder="max"
								aria-label="Maximum n"
							/>
						</div>
					</div>
				</div>

				<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary">{getSortLabel(sortOption)}</Badge>
						{activeFilterCount > 0 ? (
							<Badge variant="warning">
								{activeFilterCount} filter(s) active
							</Badge>
						) : null}
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8"
						onClick={onClearFilters}
						disabled={activeFilterCount === 0}
					>
						Clear all filters
					</Button>
				</div>
			</CardContent>

			{totalRecords === 0 ? (
				<CardContent className="px-4 py-4">
					<p className="text-sm text-slate-600 dark:text-slate-300">
						No saved calculations yet. Save your results here.
					</p>
				</CardContent>
			) : hasNoMatches ? (
				<CardContent className="px-4 py-4">
					<p className="text-sm text-slate-600 dark:text-slate-300">
						No saved results match your search/filters.
					</p>
				</CardContent>
			) : (
				<>
					{selectedCount > 0 ? (
						<div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-4 py-3 dark:border-slate-800 dark:bg-blue-950/30">
							<span className="text-sm font-medium text-slate-700 dark:text-slate-200">
								{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
							</span>
							<div className="inline-flex items-center gap-2">
								<Button
									type="button"
									variant="destructive"
									size="sm"
									className="h-8"
									onClick={() => void onBulkDelete()}
								>
									{isConfirmingBulkDelete
										? `Confirm delete ${selectedCount}`
										: "Delete selected"}
								</Button>
								{isConfirmingBulkDelete ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8"
										onClick={onCancelBulkDelete}
									>
										Cancel
									</Button>
								) : (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-8"
										onClick={onClearSelection}
									>
										Clear selection
									</Button>
								)}
							</div>
						</div>
					) : null}

					<CardContent className="px-4 py-4">
						<div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
							<Table>
								<TableHeader>
									<TableRow className="bg-slate-50 dark:bg-slate-900">
										<TableHead scope="col" className="w-12">
											<Checkbox
												checked={allSelected}
												indeterminate={someSelected}
												onChange={onToggleSelectAll}
												aria-label="Select all rows"
											/>
										</TableHead>
										<TableHead scope="col">Manufacturer</TableHead>
										<TableHead scope="col">Part #</TableHead>
										<TableHead scope="col">d</TableHead>
										<TableHead scope="col">D</TableHead>
										<TableHead scope="col">n</TableHead>
										<TableHead scope="col">Davg</TableHead>
										<TableHead scope="col" className="min-w-28">
											k
										</TableHead>
										<TableHead scope="col">Units</TableHead>
										<TableHead scope="col">Purchase</TableHead>
										<TableHead scope="col">Notes</TableHead>
										<TableHead scope="col">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{records.map((record) => (
										<TableRow key={record.id} className="text-[0.9rem]">
											<TableCell>
												<Checkbox
													checked={selectedIds.has(record.id)}
													onChange={() => onToggleSelection(record.id)}
													aria-label={`Select row for ${record.manufacturer || "Unknown"} ${record.partNumber || "Unknown"}`}
												/>
											</TableCell>
											<TableCell>{record.manufacturer}</TableCell>
											<TableCell>{record.partNumber}</TableCell>
											<TableCell>{formatValue(record.d)}</TableCell>
											<TableCell>{formatValue(record.D)}</TableCell>
											<TableCell>{formatValue(record.n)}</TableCell>
											<TableCell>{formatValue(record.Davg)}</TableCell>
											<TableCell>{formatK(record.k)}</TableCell>
											<TableCell>{getRateUnitsLabel(record.units)}</TableCell>
											<TableCell>
												{record.purchaseUrl ? (
													<a
														className="text-blue-500 underline-offset-2 hover:underline"
														href={record.purchaseUrl}
														target="_blank"
														rel="noopener"
													>
														Link
													</a>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell>{record.notes || "—"}</TableCell>
											<TableCell>
												<div className="inline-flex flex-wrap gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7"
														onClick={() => onLoad(record)}
													>
														Load
													</Button>
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7"
														onClick={() => void onDelete(record.id)}
													>
														Delete
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</>
			)}
		</Card>
	);
}
