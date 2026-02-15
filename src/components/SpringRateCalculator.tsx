import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
	addCalculation,
	clearCalculations,
	deleteCalculation,
	listCalculations,
} from "../lib/db";
import {
	computeDavg,
	computePhysicalK,
	getSpringSteelShearModulus,
	validateInputs,
} from "../lib/springRate";
import type {
	SpringCalcRecord,
	Units,
	ValidationResult,
} from "../types/spring";
import { SpringViz } from "./SpringViz";

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const parseNumber = (value: string): number | undefined => {
	if (!value.trim()) {
		return undefined;
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return parsed;
};

const formatK = (value: number | undefined): string => {
	if (value === undefined || !Number.isFinite(value)) {
		return "—";
	}
	return value.toLocaleString(undefined, {
		maximumSignificantDigits: 6,
	});
};

const formatValue = (value: number): string => {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: 4,
	});
};

const getRateUnitsLabel = (units: Units): string => {
	return units === "mm" ? "N/mm" : "lbf/in";
};

const formatShearModulus = (value: number): string => {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: 0,
	});
};

const emptyValidation: ValidationResult = {
	ok: false,
	errors: {},
	warnings: {},
};

type KSortDirection = "none" | "asc" | "desc";

/**
 * Primary calculator page that includes inputs, spring animation, and saved history.
 */
export function SpringRateCalculator() {
	const [dInput, setWireInput] = useState("");
	const [DInput, setOuterInput] = useState("");
	const [nInput, setNInput] = useState("");
	const [manufacturerInput, setManufacturerInput] = useState("");
	const [partNumberInput, setPartNumberInput] = useState("");
	const [purchaseUrlInput, setPurchaseUrlInput] = useState("");
	const [notesInput, setNotesInput] = useState("");
	const [units, setUnits] = useState<Units>("mm");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [warnings, setWarnings] = useState<Record<string, string>>({});
	const [history, setHistory] = useState<SpringCalcRecord[]>([]);
	const [isOffline, setIsOffline] = useState(!navigator.onLine);
	const [toast, setToast] = useState<string | null>(null);
	const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
	const [invalidSaveAttempted, setInvalidSaveAttempted] = useState(false);
	const [kSortDirection, setKSortDirection] = useState<KSortDirection>("none");
	const [deferredInstallPrompt, setDeferredInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);

	const parsedD = parseNumber(dInput);
	const parsedDOuter = parseNumber(DInput);
	const parsedN = parseNumber(nInput);
	const normalizedManufacturer = manufacturerInput.trim();
	const normalizedPartNumber = partNumberInput.trim();
	const normalizedPurchaseUrl = purchaseUrlInput.trim();
	const normalizedNotes = notesInput.trim();
	const springSteelG = getSpringSteelShearModulus(units);

	const derivedDavg = useMemo(() => {
		if (parsedD === undefined || parsedDOuter === undefined) {
			return undefined;
		}
		return computeDavg(parsedDOuter, parsedD);
	}, [parsedD, parsedDOuter]);

	const computedValidation = useMemo((): ValidationResult => {
		if (
			parsedD === undefined ||
			parsedDOuter === undefined ||
			parsedN === undefined
		) {
			return emptyValidation;
		}
		return validateInputs(parsedD, parsedDOuter, parsedN);
	}, [parsedD, parsedDOuter, parsedN]);

	const computedK = useMemo(() => {
		if (
			!computedValidation.ok ||
			derivedDavg === undefined ||
			parsedD === undefined ||
			parsedN === undefined
		) {
			return undefined;
		}
		return computePhysicalK(springSteelG, parsedD, parsedN, derivedDavg);
	}, [computedValidation.ok, derivedDavg, parsedD, parsedN, springSteelG]);

	const hasRequiredSourceDetails =
		normalizedManufacturer.length > 0 && normalizedPartNumber.length > 0;
	const canSave =
		computedValidation.ok &&
		computedK !== undefined &&
		hasRequiredSourceDetails;

	const displayedHistory = useMemo(() => {
		if (kSortDirection === "none") {
			return history;
		}

		const sorted = [...history].sort((a, b) => {
			return kSortDirection === "asc" ? a.k - b.k : b.k - a.k;
		});

		return sorted;
	}, [history, kSortDirection]);

	useEffect(() => {
		void (async () => {
			const records = await listCalculations();
			setHistory(records);
		})();
	}, []);

	useEffect(() => {
		const online = () => setIsOffline(false);
		const offline = () => setIsOffline(true);
		window.addEventListener("online", online);
		window.addEventListener("offline", offline);

		return () => {
			window.removeEventListener("online", online);
			window.removeEventListener("offline", offline);
		};
	}, []);

	useEffect(() => {
		if (!toast) {
			return;
		}
		const timer = window.setTimeout(() => setToast(null), 1800);
		return () => window.clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
		};

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
		};
	}, []);

	const runSaveValidation = (): ValidationResult => {
		const nextErrors: Record<string, string> = {};
		if (parsedD === undefined) {
			nextErrors.d = "Wire diameter d is required.";
		}
		if (parsedDOuter === undefined) {
			nextErrors.D = "Coil OD D is required.";
		}
		if (parsedN === undefined) {
			nextErrors.n = "Active coils n is required.";
		}
		if (!normalizedManufacturer) {
			nextErrors.manufacturer = "Manufacturer is required.";
		}
		if (!normalizedPartNumber) {
			nextErrors.partNumber = "Part number is required.";
		}
		if (normalizedPurchaseUrl) {
			try {
				new URL(normalizedPurchaseUrl);
			} catch {
				nextErrors.purchaseUrl = "Purchase URL must be a valid URL.";
			}
		}

		if (Object.keys(nextErrors).length > 0) {
			return { ok: false, errors: nextErrors, warnings: {} };
		}

		if (
			parsedD === undefined ||
			parsedDOuter === undefined ||
			parsedN === undefined
		) {
			return { ok: false, errors: nextErrors, warnings: {} };
		}

		return validateInputs(parsedD, parsedDOuter, parsedN);
	};

	const handleSave = async (): Promise<void> => {
		const validation = runSaveValidation();
		setErrors(validation.errors);
		setWarnings(validation.warnings);

		if (
			!validation.ok ||
			computedK === undefined ||
			derivedDavg === undefined ||
			parsedD === undefined ||
			parsedDOuter === undefined ||
			parsedN === undefined
		) {
			setInvalidSaveAttempted(true);
			setToast("Fix validation errors before saving.");
			window.setTimeout(() => setInvalidSaveAttempted(false), 420);
			return;
		}

		const record: SpringCalcRecord = {
			id: crypto.randomUUID(),
			createdAt: Date.now(),
			manufacturer: normalizedManufacturer,
			partNumber: normalizedPartNumber,
			purchaseUrl: normalizedPurchaseUrl || undefined,
			notes: normalizedNotes || undefined,
			units,
			d: parsedD,
			D: parsedDOuter,
			n: parsedN,
			Davg: derivedDavg,
			k: computedK,
		};

		await addCalculation(record);
		setHistory((previous) => [record, ...previous]);
		setToast("Calculation saved.");
	};

	const handleReset = (): void => {
		setWireInput("");
		setOuterInput("");
		setNInput("");
		setManufacturerInput("");
		setPartNumberInput("");
		setPurchaseUrlInput("");
		setNotesInput("");
		setErrors({});
		setWarnings({});
		setToast("Inputs reset.");
	};

	const handleLoad = (record: SpringCalcRecord): void => {
		setWireInput(String(record.d));
		setOuterInput(String(record.D));
		setNInput(String(record.n));
		setManufacturerInput(record.manufacturer ?? "");
		setPartNumberInput(record.partNumber ?? "");
		setPurchaseUrlInput(record.purchaseUrl ?? "");
		setNotesInput(record.notes ?? "");
		setUnits(record.units);
		setErrors({});
		setWarnings({});
		setToast("Saved calculation loaded.");
	};

	const handleDelete = async (id: string): Promise<void> => {
		await deleteCalculation(id);
		setHistory((previous) => previous.filter((record) => record.id !== id));
		setToast("Saved calculation deleted.");
	};

	const handleClearAll = async (): Promise<void> => {
		if (!isConfirmingClearAll) {
			setIsConfirmingClearAll(true);
			return;
		}

		await clearCalculations();
		setHistory([]);
		setIsConfirmingClearAll(false);
		setToast("All saved calculations cleared.");
	};

	const cancelClearAll = (): void => setIsConfirmingClearAll(false);

	const handleInstall = async (): Promise<void> => {
		if (!deferredInstallPrompt) {
			return;
		}
		await deferredInstallPrompt.prompt();
		await deferredInstallPrompt.userChoice;
		setDeferredInstallPrompt(null);
	};

	const toggleKSort = (): void => {
		setKSortDirection((current) => {
			if (current === "none") {
				return "asc";
			}
			if (current === "asc") {
				return "desc";
			}
			return "none";
		});
	};

	const kSortLabel =
		kSortDirection === "none"
			? "Sort k"
			: kSortDirection === "asc"
				? "Sort k ↑"
				: "Sort k ↓";

	return (
		<div className="app-shell">
			<header className="app-bar">
				<div className="app-title-wrap">
					<div className="app-logo" aria-hidden="true">
						≋
					</div>
					<h1>Spring Rate</h1>
				</div>

				<div className="top-controls">
					<span className={`status-pill ${isOffline ? "offline" : "online"}`}>
						<span className="dot" aria-hidden="true" />
						{isOffline ? "Offline (working locally)" : "Online"}
					</span>

					<fieldset className="units-toggle" aria-label="Units">
						<legend className="sr-only">Units</legend>
						<button
							type="button"
							className={units === "mm" ? "active" : ""}
							onClick={() => setUnits("mm")}
						>
							mm
						</button>
						<button
							type="button"
							className={units === "in" ? "active" : ""}
							onClick={() => setUnits("in")}
						>
							in
						</button>
					</fieldset>

					{deferredInstallPrompt ? (
						<button
							type="button"
							className="btn tertiary"
							onClick={handleInstall}
						>
							Install
						</button>
					) : null}
				</div>
			</header>

			<main className="layout-grid">
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
								value={dInput}
								onChange={(event) => setWireInput(event.currentTarget.value)}
								placeholder={`e.g. 1.2 ${units}`}
								aria-invalid={Boolean(errors.d)}
							/>
							{errors.d ? (
								<small className="error-msg">{errors.d}</small>
							) : null}
						</label>

						<label>
							<span>Coil OD D</span>
							<input
								type="number"
								inputMode="decimal"
								value={DInput}
								onChange={(event) => setOuterInput(event.currentTarget.value)}
								placeholder={`e.g. 10.5 ${units}`}
								aria-invalid={Boolean(errors.D)}
							/>
							{errors.D ? (
								<small className="error-msg">{errors.D}</small>
							) : null}
						</label>

						<label>
							<span>Active coils n</span>
							<input
								type="number"
								inputMode="decimal"
								value={nInput}
								onChange={(event) => setNInput(event.currentTarget.value)}
								placeholder="e.g. 6"
								aria-invalid={Boolean(errors.n)}
							/>
							{errors.n ? (
								<small className="error-msg">{errors.n}</small>
							) : null}
							{warnings.n ? (
								<small className="warn-msg">{warnings.n}</small>
							) : null}
						</label>

						<label>
							<span>Manufacturer</span>
							<input
								type="text"
								value={manufacturerInput}
								onChange={(event) =>
									setManufacturerInput(event.currentTarget.value)
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
								value={partNumberInput}
								onChange={(event) =>
									setPartNumberInput(event.currentTarget.value)
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
								value={purchaseUrlInput}
								onChange={(event) =>
									setPurchaseUrlInput(event.currentTarget.value)
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
								value={notesInput}
								onChange={(event) => setNotesInput(event.currentTarget.value)}
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
					{errors.Davg ? (
						<small className="error-msg">{errors.Davg}</small>
					) : null}

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
							onClick={handleSave}
						>
							Save
						</button>
						<button type="button" className="btn" onClick={handleReset}>
							Reset
						</button>
					</div>
				</section>

				<SpringViz
					k={computedK}
					d={parsedD}
					D={parsedDOuter}
					n={parsedN}
					units={units}
				/>

				<section className="card saved-card">
					<header className="card-header">
						<h2>Saved</h2>
						<div className="saved-actions">
							<button
								type="button"
								className="btn tertiary"
								onClick={handleClearAll}
							>
								{isConfirmingClearAll ? "Confirm clear" : "Clear all"}
							</button>
							{isConfirmingClearAll ? (
								<button type="button" className="btn" onClick={cancelClearAll}>
									Cancel
								</button>
							) : null}
						</div>
					</header>

					{displayedHistory.length === 0 ? (
						<p className="empty-state">
							No saved calculations yet. Save your results here.
						</p>
					) : (
						<div className="saved-table-wrap">
							<table className="saved-table">
								<thead>
									<tr>
										<th scope="col">Manufacturer</th>
										<th scope="col">Part #</th>
										<th scope="col">d</th>
										<th scope="col">D</th>
										<th scope="col">n</th>
										<th scope="col">Davg</th>
										<th scope="col" className="k-sort-col">
											<button
												type="button"
												className="k-sort-btn"
												onClick={toggleKSort}
												aria-label={`Toggle k sorting, current: ${kSortDirection}`}
											>
												{kSortLabel}
											</button>
										</th>
										<th scope="col">Units</th>
										<th scope="col">Purchase</th>
										<th scope="col">Notes</th>
										<th scope="col">Actions</th>
									</tr>
								</thead>
								<tbody>
									{displayedHistory.map((record) => (
										<tr key={record.id}>
											<td>{record.manufacturer}</td>
											<td>{record.partNumber}</td>
											<td>{formatValue(record.d)}</td>
											<td>{formatValue(record.D)}</td>
											<td>{formatValue(record.n)}</td>
											<td>{formatValue(record.Davg)}</td>
											<td>{formatK(record.k)}</td>
											<td>{getRateUnitsLabel(record.units)}</td>
											<td>
												{record.purchaseUrl ? (
													<a
														href={record.purchaseUrl}
														target="_blank"
														rel="noopener"
													>
														Link
													</a>
												) : (
													"—"
												)}
											</td>
											<td>{record.notes || "—"}</td>
											<td>
												<div className="saved-item-actions">
													<button
														type="button"
														className="btn"
														onClick={() => handleLoad(record)}
													>
														Load
													</button>
													<button
														type="button"
														className="btn"
														onClick={() => handleDelete(record.id)}
													>
														Delete
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</main>

			<AnimatePresence>
				{toast ? (
					<motion.div
						className="toast"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 8 }}
					>
						{toast}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
