import type { SpringCalcRecord } from "../../types/spring";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
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
	getKSortLabel,
	getRateUnitsLabel,
	type KSortDirection,
} from "./utils";

/**
 * Props for the saved calculations table section.
 */
interface SavedCalculationsTableProps {
	records: SpringCalcRecord[];
	isConfirmingClearAll: boolean;
	kSortDirection: KSortDirection;
	selectedIds: Set<string>;
	isConfirmingBulkDelete: boolean;
	onToggleSort: () => void;
	onClearAll: () => Promise<void>;
	onCancelClearAll: () => void;
	onLoad: (record: SpringCalcRecord) => void;
	onDelete: (id: string) => Promise<void>;
	onToggleSelection: (id: string) => void;
	onToggleSelectAll: () => void;
	onBulkDelete: () => Promise<void>;
	onCancelBulkDelete: () => void;
	onClearSelection: () => void;
}

/**
 * Renders persisted calculations in a sortable data table with row actions.
 */
export function SavedCalculationsTable({
	records,
	isConfirmingClearAll,
	kSortDirection,
	selectedIds,
	isConfirmingBulkDelete,
	onToggleSort,
	onClearAll,
	onCancelClearAll,
	onLoad,
	onDelete,
	onToggleSelection,
	onToggleSelectAll,
	onBulkDelete,
	onCancelBulkDelete,
	onClearSelection,
}: SavedCalculationsTableProps) {
	const selectedCount = selectedIds.size;
	const allSelected = records.length > 0 && selectedCount === records.length;
	const someSelected = selectedCount > 0 && selectedCount < records.length;

	return (
		<Card className="md:col-span-2">
			<CardHeader className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<CardTitle
					className="text-[1.05rem] text-slate-700 dark:text-slate-100"
					id="saved-calculations-heading"
				>
					Saved
				</CardTitle>
				<div className="inline-flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 bg-slate-50 text-blue-600 dark:bg-slate-800 dark:text-blue-300"
						onClick={() => void onClearAll()}
						aria-label={
							isConfirmingClearAll
								? `Confirm clearing all ${records.length} saved calculations`
								: `Clear all ${records.length} saved calculations`
						}
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
							aria-label="Cancel clearing all calculations"
						>
							Cancel
						</Button>
					) : null}
				</div>
			</CardHeader>

			{records.length === 0 ? (
				<CardContent className="px-4 py-4">
					<p className="text-sm text-slate-600 dark:text-slate-300">
						No saved calculations yet. Save your results here.
					</p>
				</CardContent>
			) : (
				<>
					{selectedCount > 0 ? (
						// biome-ignore lint/a11y/useSemanticElements: div with role="status" is appropriate for dynamic selection status
						<div
							className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-4 py-3 dark:border-slate-800 dark:bg-blue-950/30"
							role="status"
							aria-live="polite"
							aria-atomic="true"
						>
							<span
								className="text-sm font-medium text-slate-700 dark:text-slate-200"
								id="selection-status"
							>
								{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
							</span>
							{/* biome-ignore lint/a11y/useSemanticElements: div with role="group" is appropriate for grouping action buttons */}
							<div
								className="inline-flex items-center gap-2"
								role="group"
								aria-labelledby="selection-status"
							>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									className="h-8"
									onClick={() => void onBulkDelete()}
									aria-label={
										isConfirmingBulkDelete
											? `Confirm deletion of ${selectedCount} selected calculation${selectedCount !== 1 ? "s" : ""}`
											: `Delete ${selectedCount} selected calculation${selectedCount !== 1 ? "s" : ""}`
									}
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
										aria-label="Cancel bulk deletion"
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
										aria-label={`Clear selection of ${selectedCount} row${selectedCount !== 1 ? "s" : ""}`}
									>
										Clear selection
									</Button>
								)}
							</div>
						</div>
					) : null}

					<CardContent className="px-4 py-4">
						<div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
							<Table aria-labelledby="saved-calculations-heading">
								<TableHeader>
									<TableRow className="bg-slate-50 dark:bg-slate-900">
										<TableHead scope="col" className="w-12">
											<Checkbox
												checked={allSelected}
												ref={(el) => {
													if (el) {
														el.indeterminate = someSelected;
													}
												}}
												onChange={onToggleSelectAll}
												aria-label={`Select all ${records.length} rows`}
												aria-checked={
													allSelected
														? "true"
														: someSelected
															? "mixed"
															: "false"
												}
											/>
										</TableHead>
										<TableHead scope="col">Manufacturer</TableHead>
										<TableHead scope="col">Part #</TableHead>
										<TableHead scope="col">d</TableHead>
										<TableHead scope="col">D</TableHead>
										<TableHead scope="col">n</TableHead>
										<TableHead scope="col">Davg</TableHead>
										<TableHead scope="col" className="min-w-28">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-7"
												onClick={onToggleSort}
												aria-label={`Toggle k sorting, current: ${kSortDirection}`}
											>
												{getKSortLabel(kSortDirection)}
											</Button>
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
													aria-checked={
														selectedIds.has(record.id) ? "true" : "false"
													}
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
														rel="noopener noreferrer"
														aria-label={`Purchase link for ${record.manufacturer || "Unknown"} ${record.partNumber || "Unknown"}`}
													>
														Link
													</a>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell>{record.notes || "—"}</TableCell>
											<TableCell>
												{/* biome-ignore lint/a11y/useSemanticElements: div with role="group" is appropriate for grouping related action buttons */}
												<div
													className="inline-flex flex-wrap gap-2"
													role="group"
													aria-label={`Actions for ${record.manufacturer || "Unknown"} ${record.partNumber || "Unknown"}`}
												>
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7"
														onClick={() => onLoad(record)}
														aria-label={`Load calculation for ${record.manufacturer || "Unknown"} ${record.partNumber || "Unknown"}`}
													>
														Load
													</Button>
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7"
														onClick={() => void onDelete(record.id)}
														aria-label={`Delete calculation for ${record.manufacturer || "Unknown"} ${record.partNumber || "Unknown"}`}
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
