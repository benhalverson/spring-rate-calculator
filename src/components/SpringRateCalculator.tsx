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
import { CalculatorForm } from "./springCalculator/CalculatorForm";
import { CalculatorHeader } from "./springCalculator/CalculatorHeader";
import { SavedCalculationsTable } from "./springCalculator/SavedCalculationsTable";
import {
	type BeforeInstallPromptEvent,
	type CalculatorInputs,
	EMPTY_VALIDATION,
	type KSortDirection,
	parseNumber,
	toggleKSortDirection,
} from "./springCalculator/utils";

const EMPTY_INPUTS: CalculatorInputs = {
	dInput: "",
	DInput: "",
	nInput: "",
	manufacturerInput: "",
	partNumberInput: "",
	purchaseUrlInput: "",
	notesInput: "",
};

/**
 * Primary calculator page that includes inputs, spring animation, and saved history.
 */
export function SpringRateCalculator() {
	const [inputs, setInputs] = useState<CalculatorInputs>(EMPTY_INPUTS);
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

	const parsedD = parseNumber(inputs.dInput);
	const parsedDOuter = parseNumber(inputs.DInput);
	const parsedN = parseNumber(inputs.nInput);
	const normalizedManufacturer = inputs.manufacturerInput.trim();
	const normalizedPartNumber = inputs.partNumberInput.trim();
	const normalizedPurchaseUrl = inputs.purchaseUrlInput.trim();
	const normalizedNotes = inputs.notesInput.trim();
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
			return EMPTY_VALIDATION;
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

	const setInputValue = (
		field: keyof CalculatorInputs,
		value: string,
	): void => {
		setInputs((previous) => ({
			...previous,
			[field]: value,
		}));
	};

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
		setInputs(EMPTY_INPUTS);
		setErrors({});
		setWarnings({});
		setToast("Inputs reset.");
	};

	const handleLoad = (record: SpringCalcRecord): void => {
		setInputs({
			dInput: String(record.d),
			DInput: String(record.D),
			nInput: String(record.n),
			manufacturerInput: record.manufacturer ?? "",
			partNumberInput: record.partNumber ?? "",
			purchaseUrlInput: record.purchaseUrl ?? "",
			notesInput: record.notes ?? "",
		});
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
		setKSortDirection((current) => toggleKSortDirection(current));
	};

	return (
		<div className="app-shell">
			<CalculatorHeader
				isOffline={isOffline}
				units={units}
				onUnitsChange={setUnits}
				hasInstallPrompt={deferredInstallPrompt !== null}
				onInstall={handleInstall}
			/>

			<main className="layout-grid">
				<CalculatorForm
					values={inputs}
					units={units}
					errors={errors}
					warnings={warnings}
					derivedDavg={derivedDavg}
					computedK={computedK}
					springSteelG={springSteelG}
					invalidSaveAttempted={invalidSaveAttempted}
					canSave={canSave}
					onValueChange={setInputValue}
					onSave={handleSave}
					onReset={handleReset}
				/>

				<SpringViz
					k={computedK}
					d={parsedD}
					D={parsedDOuter}
					n={parsedN}
					units={units}
				/>

				<SavedCalculationsTable
					records={displayedHistory}
					isConfirmingClearAll={isConfirmingClearAll}
					kSortDirection={kSortDirection}
					onToggleSort={toggleKSort}
					onClearAll={handleClearAll}
					onCancelClearAll={cancelClearAll}
					onLoad={handleLoad}
					onDelete={handleDelete}
				/>
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
