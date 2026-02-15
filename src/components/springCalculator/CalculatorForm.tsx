import { motion } from "framer-motion";

import type { Units } from "../../types/spring";
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
	return (
		<section className="card calculator-card">
			<header className="card-header">
				<h2>Calculator</h2>
			</header>

			<div className="field-grid">
				<label>
					<span>Wire diameter d</span>
					<input
						type="number"
						inputMode="decimal"
						value={values.dInput}
						onChange={(event) =>
							onValueChange("dInput", event.currentTarget.value)
						}
						placeholder={`e.g. 1.2 ${units}`}
						aria-invalid={Boolean(errors.d)}
					/>
					{errors.d ? <small className="error-msg">{errors.d}</small> : null}
				</label>

				<label>
					<span>Coil OD D</span>
					<input
						type="number"
						inputMode="decimal"
						value={values.DInput}
						onChange={(event) =>
							onValueChange("DInput", event.currentTarget.value)
						}
						placeholder={`e.g. 10.5 ${units}`}
						aria-invalid={Boolean(errors.D)}
					/>
					{errors.D ? <small className="error-msg">{errors.D}</small> : null}
				</label>

				<label>
					<span>Active coils n</span>
					<input
						type="number"
						inputMode="decimal"
						value={values.nInput}
						onChange={(event) =>
							onValueChange("nInput", event.currentTarget.value)
						}
						placeholder="e.g. 6"
						aria-invalid={Boolean(errors.n)}
					/>
					{errors.n ? <small className="error-msg">{errors.n}</small> : null}
					{warnings.n ? <small className="warn-msg">{warnings.n}</small> : null}
				</label>

				<label>
					<span>Manufacturer</span>
					<input
						type="text"
						value={values.manufacturerInput}
						onChange={(event) =>
							onValueChange("manufacturerInput", event.currentTarget.value)
						}
						placeholder="e.g. Team Associated"
						aria-invalid={Boolean(errors.manufacturer)}
					/>
					{errors.manufacturer ? (
						<small className="error-msg">{errors.manufacturer}</small>
					) : null}
				</label>

				<label>
					<span>Part number</span>
					<input
						type="text"
						value={values.partNumberInput}
						onChange={(event) =>
							onValueChange("partNumberInput", event.currentTarget.value)
						}
						placeholder="e.g. ASC91322"
						aria-invalid={Boolean(errors.partNumber)}
					/>
					{errors.partNumber ? (
						<small className="error-msg">{errors.partNumber}</small>
					) : null}
				</label>

				<label>
					<span>Purchase URL (optional)</span>
					<input
						type="url"
						value={values.purchaseUrlInput}
						onChange={(event) =>
							onValueChange("purchaseUrlInput", event.currentTarget.value)
						}
						placeholder="https://..."
						aria-invalid={Boolean(errors.purchaseUrl)}
					/>
					{errors.purchaseUrl ? (
						<small className="error-msg">{errors.purchaseUrl}</small>
					) : null}
				</label>

				<label>
					<span>Notes (optional)</span>
					<textarea
						rows={2}
						value={values.notesInput}
						onChange={(event) =>
							onValueChange("notesInput", event.currentTarget.value)
						}
						placeholder="Track/setup notes"
					/>
				</label>
			</div>

			<div className="derived-row">
				Davg = D − d ={" "}
				{derivedDavg === undefined
					? "—"
					: `${formatValue(derivedDavg)} ${units}`}
			</div>
			{errors.Davg ? <small className="error-msg">{errors.Davg}</small> : null}

			<motion.div
				className="result-panel"
				initial={{ opacity: 0.7, scale: 0.985 }}
				animate={
					computedK === undefined
						? { opacity: 0.7, scale: 0.985 }
						: { opacity: 1, scale: 1 }
				}
			>
				<p className="result-title">
					Spring rate: <strong>{formatK(computedK)}</strong>
					{computedK !== undefined ? ` ${getRateUnitsLabel(units)}` : ""}
				</p>
				<p className="formula">k = (G · d⁴) / (8 · n · Davg³)</p>
				<p className="formula">
					Assuming spring steel: G = {formatShearModulus(springSteelG)}{" "}
					{units === "mm" ? "N/mm²" : "psi"}
				</p>
			</motion.div>

			<p className="units-note">Use consistent units for d and D.</p>

			<div className={`actions ${invalidSaveAttempted ? "shake" : ""}`}>
				<button
					type="button"
					className="btn primary"
					disabled={!canSave}
					onClick={() => void onSave()}
				>
					Save
				</button>
				<button type="button" className="btn" onClick={onReset}>
					Reset
				</button>
			</div>
		</section>
	);
}
