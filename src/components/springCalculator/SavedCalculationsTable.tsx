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
	onCompare: () => void;
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
	onCompare,
}: SavedCalculationsTableProps) {
	const selectedCount = selectedIds.size;
	const allSelected = records.length > 0 && selectedCount === records.length;
	const someSelected = selectedCount > 0 && selectedCount < records.length;
	const canCompare = selectedCount >= 2 && selectedCount <= 4;

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

			{records.length === 0 ? (
				<CardContent className="px-4 py-4">
					<p className="text-sm text-slate-600 dark:text-slate-300">
						No saved calculations yet. Save your results here.
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
												ref={(element) => {
													if (element) {
														element.indeterminate = someSelected;
													}
												}}
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
