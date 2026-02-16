import type { SpringCalcRecord } from "../../types/spring";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import { formatK, formatValue, getRateUnitsLabel } from "./utils";

interface ComparePanelProps {
	selectedRecords: SpringCalcRecord[];
	onRemoveCandidate: (id: string) => void;
	onClearCompare: () => void;
}

/**
 * Calculates the percent difference of a value relative to the minimum value in the set.
 * Returns undefined if there's no meaningful difference.
 */
const calculatePercentDelta = (
	value: number,
	values: number[],
): number | undefined => {
	const min = Math.min(...values);
	if (min === 0 || value === min) {
		return undefined;
	}
	return ((value - min) / min) * 100;
};

/**
 * Determines if values in an array have meaningful differences.
 */
const hasVariance = (values: number[]): boolean => {
	if (values.length <= 1) return false;
	const min = Math.min(...values);
	const max = Math.max(...values);
	// Handle case where all values are zero
	if (min === 0 && max === 0) return false;
	// Consider variance if difference is more than 0.1%
	return Math.abs(max - min) / Math.max(Math.abs(min), Math.abs(max)) > 0.001;
};

/**
 * Determines if string values in an array are different.
 */
const hasStringVariance = (values: string[]): boolean => {
	if (values.length <= 1) return false;
	return new Set(values).size > 1;
};

/**
 * Renders a side-by-side comparison of selected spring calculations.
 */
export function ComparePanel({
	selectedRecords,
	onRemoveCandidate,
	onClearCompare,
}: ComparePanelProps) {
	if (selectedRecords.length === 0) {
		return null;
	}

	// Extract all values for variance detection
	const kValues = selectedRecords.map((r) => r.k);
	const dValues = selectedRecords.map((r) => r.d);
	const DValues = selectedRecords.map((r) => r.D);
	const nValues = selectedRecords.map((r) => r.n);
	const DavgValues = selectedRecords.map((r) => r.Davg);
	const units = selectedRecords.map((r) => r.units);

	const hasKVariance = hasVariance(kValues);
	const hasDVariance = hasVariance(dValues);
	const hasDOuterVariance = hasVariance(DValues);
	const hasNVariance = hasVariance(nValues);
	const hasDavgVariance = hasVariance(DavgValues);
	const hasUnitsVariance = hasStringVariance(units);

	return (
		<Card className="md:col-span-2">
			<CardHeader className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<CardTitle className="text-[1.05rem] text-slate-700 dark:text-slate-100">
					Compare ({selectedRecords.length})
				</CardTitle>
				<div className="inline-flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 bg-slate-50 text-blue-600 dark:bg-slate-800 dark:text-blue-300"
						onClick={onClearCompare}
					>
						Clear compare
					</Button>
				</div>
			</CardHeader>

			<CardContent className="px-4 py-4">
				<div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
					<Table>
						<TableHeader>
							<TableRow className="bg-slate-50 dark:bg-slate-900">
								<TableHead scope="col">Property</TableHead>
								{selectedRecords.map((record) => (
									<TableHead key={record.id} scope="col" className="min-w-32">
										<div className="flex flex-col gap-1">
											<div className="font-semibold text-slate-900 dark:text-slate-100">
												{record.manufacturer}
											</div>
											<div className="text-xs text-slate-600 dark:text-slate-400">
												{record.partNumber}
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-6 text-xs"
												onClick={() => onRemoveCandidate(record.id)}
											>
												Remove
											</Button>
										</div>
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow>
								<TableCell className="font-medium">
									Spring Rate (k)
									{hasKVariance ? (
										<Badge variant="warning" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => {
									const delta = hasKVariance
										? calculatePercentDelta(record.k, kValues)
										: undefined;
									return (
										<TableCell
											key={record.id}
											className={
												hasKVariance
													? "bg-amber-50/50 dark:bg-amber-950/20"
													: undefined
											}
										>
											<div className="flex flex-col gap-0.5">
												<span>{formatK(record.k)}</span>
												{delta !== undefined ? (
													<span className="text-xs text-amber-700 dark:text-amber-400">
														+{delta.toFixed(1)}%
													</span>
												) : null}
											</div>
										</TableCell>
									);
								})}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">
									Wire Diameter (d)
									{hasDVariance ? (
										<Badge variant="secondary" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => (
									<TableCell
										key={record.id}
										className={
											hasDVariance
												? "bg-slate-100/50 dark:bg-slate-800/50"
												: undefined
										}
									>
										{formatValue(record.d)}
									</TableCell>
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">
									Outer Diameter (D)
									{hasDOuterVariance ? (
										<Badge variant="secondary" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => (
									<TableCell
										key={record.id}
										className={
											hasDOuterVariance
												? "bg-slate-100/50 dark:bg-slate-800/50"
												: undefined
										}
									>
										{formatValue(record.D)}
									</TableCell>
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">
									Active Coils (n)
									{hasNVariance ? (
										<Badge variant="secondary" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => (
									<TableCell
										key={record.id}
										className={
											hasNVariance
												? "bg-slate-100/50 dark:bg-slate-800/50"
												: undefined
										}
									>
										{formatValue(record.n)}
									</TableCell>
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">
									Avg Diameter (Davg)
									{hasDavgVariance ? (
										<Badge variant="secondary" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => (
									<TableCell
										key={record.id}
										className={
											hasDavgVariance
												? "bg-slate-100/50 dark:bg-slate-800/50"
												: undefined
										}
									>
										{formatValue(record.Davg)}
									</TableCell>
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">
									Units
									{hasUnitsVariance ? (
										<Badge variant="secondary" className="ml-2">
											varies
										</Badge>
									) : null}
								</TableCell>
								{selectedRecords.map((record) => (
									<TableCell
										key={record.id}
										className={
											hasUnitsVariance
												? "bg-slate-100/50 dark:bg-slate-800/50"
												: undefined
										}
									>
										{getRateUnitsLabel(record.units)}
									</TableCell>
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">Purchase Link</TableCell>
								{selectedRecords.map((record) => (
									<TableCell key={record.id}>
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
								))}
							</TableRow>

							<TableRow>
								<TableCell className="font-medium">Notes</TableCell>
								{selectedRecords.map((record) => (
									<TableCell key={record.id} className="max-w-xs">
										<div className="line-clamp-3 text-xs">
											{record.notes || "—"}
										</div>
									</TableCell>
								))}
							</TableRow>
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
