import { motion } from "framer-motion";

import type { Units } from "../../types/spring";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
	formatK,
	formatShearModulus,
	formatValue,
	getRateUnitsLabel,
} from "./utils";

/**
 * Props for the calculator form section.
 */
interface CalculatorFormProps {
	values: {
		dInput: string;
		DInput: string;
		nInput: string;
		manufacturerInput: string;
		partNumberInput: string;
		purchaseUrlInput: string;
		notesInput: string;
	};
	units: Units;
	errors: Record<string, string>;
	warnings: Record<string, string>;
	derivedDavg?: number;
	computedK?: number;
	springSteelG: number;
	invalidSaveAttempted: boolean;
	canSave: boolean;
	onValueChange: (
		field: keyof CalculatorFormProps["values"],
		value: string,
	) => void;
	onSave: () => Promise<void>;
	onReset: () => void;
}

/**
 * Renders calculator inputs, derived values, and action buttons.
 */
export function CalculatorForm({
	values,
	units,
	errors,
	warnings,
	derivedDavg,
	computedK,
	springSteelG,
	invalidSaveAttempted,
	canSave,
	onValueChange,
	onSave,
	onReset,
}: CalculatorFormProps) {
	const dInputId = "d-input";
	const DInputId = "D-input";
	const nInputId = "n-input";
	const manufacturerInputId = "manufacturer-input";
	const partNumberInputId = "part-number-input";
	const purchaseUrlInputId = "purchase-url-input";
	const notesInputId = "notes-input";

	return (
		<Card>
			<CardHeader className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
				<CardTitle className="text-[1.05rem] text-slate-700 dark:text-slate-100">
					Calculator
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 px-4 pt-4">
				<div className="grid gap-4">
					<div className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm font-medium">
						<label htmlFor={dInputId}>Wire diameter d</label>
						<Input
							id={dInputId}
							type="number"
							inputMode="decimal"
							value={values.dInput}
							onChange={(event) =>
								onValueChange("dInput", event.currentTarget.value)
							}
							placeholder={`e.g. 1.2 ${units}`}
							aria-invalid={Boolean(errors.d)}
							className={
								errors.d
									? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
									: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
							}
						/>
						{errors.d ? (
							<small className="col-span-2 text-xs font-medium text-red-500">
								{errors.d}
							</small>
						) : null}
					</div>

					<div className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm font-medium">
						<label htmlFor={DInputId}>Coil OD D</label>
						<Input
							id={DInputId}
							type="number"
							inputMode="decimal"
							value={values.DInput}
							onChange={(event) =>
								onValueChange("DInput", event.currentTarget.value)
							}
							placeholder={`e.g. 10.5 ${units}`}
							aria-invalid={Boolean(errors.D)}
							className={
								errors.D
									? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
									: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
							}
						/>
						{errors.D ? (
							<small className="col-span-2 text-xs font-medium text-red-500">
								{errors.D}
							</small>
						) : null}
					</div>

					<div className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm font-medium">
						<label htmlFor={nInputId}>Active coils n</label>
						<Input
							id={nInputId}
							type="number"
							inputMode="decimal"
							value={values.nInput}
							onChange={(event) =>
								onValueChange("nInput", event.currentTarget.value)
							}
							placeholder="e.g. 6"
							aria-invalid={Boolean(errors.n)}
							className={
								errors.n
									? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
									: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
							}
						/>
						{errors.n ? (
							<small className="col-span-2 text-xs font-medium text-red-500">
								{errors.n}
							</small>
						) : null}
						{warnings.n ? (
							<small className="col-span-2 text-xs font-medium text-amber-500">
								{warnings.n}
							</small>
						) : null}
					</div>

					<div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
							Source details
						</p>

						<div className="grid gap-1.5 text-sm font-medium">
							<label htmlFor={manufacturerInputId}>Manufacturer</label>
							<Input
								id={manufacturerInputId}
								type="text"
								value={values.manufacturerInput}
								onChange={(event) =>
									onValueChange("manufacturerInput", event.currentTarget.value)
								}
								placeholder="e.g. Team Associated"
								aria-invalid={Boolean(errors.manufacturer)}
								className={
									errors.manufacturer
										? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
										: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
								}
							/>
							{errors.manufacturer ? (
								<small className="text-xs font-medium text-red-500">
									{errors.manufacturer}
								</small>
							) : null}
						</div>

						<div className="grid gap-1.5 text-sm font-medium">
							<label htmlFor={partNumberInputId}>Part number</label>
							<Input
								id={partNumberInputId}
								type="text"
								value={values.partNumberInput}
								onChange={(event) =>
									onValueChange("partNumberInput", event.currentTarget.value)
								}
								placeholder="e.g. ASC91322"
								aria-invalid={Boolean(errors.partNumber)}
								className={
									errors.partNumber
										? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
										: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
								}
							/>
							{errors.partNumber ? (
								<small className="text-xs font-medium text-red-500">
									{errors.partNumber}
								</small>
							) : null}
						</div>

						<div className="grid gap-1.5 text-sm font-medium">
							<label htmlFor={purchaseUrlInputId}>
								Purchase URL (optional)
							</label>
							<Input
								id={purchaseUrlInputId}
								type="url"
								value={values.purchaseUrlInput}
								onChange={(event) =>
									onValueChange("purchaseUrlInput", event.currentTarget.value)
								}
								placeholder="https://..."
								aria-invalid={Boolean(errors.purchaseUrl)}
								className={
									errors.purchaseUrl
										? "h-8 border-red-500 bg-white text-sm focus-visible:ring-red-500 dark:bg-slate-900"
										: "h-8 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
								}
							/>
							{errors.purchaseUrl ? (
								<small className="text-xs font-medium text-red-500">
									{errors.purchaseUrl}
								</small>
							) : null}
						</div>

						<div className="grid gap-1.5 text-sm font-medium">
							<label htmlFor={notesInputId}>Notes (optional)</label>
							<Textarea
								id={notesInputId}
								rows={2}
								value={values.notesInput}
								onChange={(event) =>
									onValueChange("notesInput", event.currentTarget.value)
								}
								placeholder="Track/setup notes"
								className="min-h-[62px] border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
							/>
						</div>
					</div>
				</div>

				<div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[1.02rem] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100">
					Davg = D − d ={" "}
					{derivedDavg === undefined
						? "—"
						: `${formatValue(derivedDavg)} ${units}`}
				</div>
				{errors.Davg ? (
					<small className="text-xs font-medium text-red-500">
						{errors.Davg}
					</small>
				) : null}

				<motion.div
					className="rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50"
					initial={{ opacity: 0.7, scale: 0.985 }}
					animate={
						computedK === undefined
							? { opacity: 0.7, scale: 0.985 }
							: { opacity: 1, scale: 1 }
					}
				>
					<p className="text-[1.03rem] font-semibold text-slate-700 dark:text-slate-100">
						Spring rate:{" "}
						<strong className="text-[2rem] text-slate-800 dark:text-slate-100">
							{formatK(computedK)}
						</strong>
						{computedK !== undefined ? ` ${getRateUnitsLabel(units)}` : ""}
					</p>
					<p className="mt-1 border-t border-slate-200 pt-1 text-[0.96rem] text-slate-600 dark:border-slate-700 dark:text-slate-300">
						k = (G · d⁴) / (8 · n · Davg³)
					</p>
					<p className="mt-1 text-[0.86rem] text-slate-500 dark:text-slate-400">
						Assuming spring steel: G = {formatShearModulus(springSteelG)}{" "}
						{units === "mm" ? "N/mm²" : "psi"}
					</p>
				</motion.div>

				<p className="text-xs text-slate-500 dark:text-slate-400">
					Use consistent units for d and D.
				</p>

				<div
					className={`flex items-center gap-2 ${invalidSaveAttempted ? "shake" : ""}`}
				>
					<Button
						type="button"
						disabled={!canSave}
						className="h-8 min-w-[96px] rounded-md bg-gradient-to-b from-blue-500 to-blue-600 text-sm shadow-sm hover:from-blue-500 hover:to-blue-500"
						onClick={() => void onSave()}
					>
						Save
					</Button>
					<Button
						type="button"
						variant="outline"
						className="h-8 min-w-[96px] rounded-md bg-white text-sm dark:bg-slate-900"
						onClick={onReset}
					>
						Reset
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
