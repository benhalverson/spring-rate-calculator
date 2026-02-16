import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import {
	addCalculation,
	bulkDeleteCalculations,
	clearCalculations,
	deleteCalculation,
	getSyncStatus,
	isCloudSyncEnabled,
	listCalculations,
	subscribeSyncStatus,
	triggerBackgroundSync,
} from "../lib/db";
import {
	computeDavg,
	computePhysicalK,
	getSpringSteelShearModulus,
	validateInputs,
} from "../lib/springRate";
import type { SyncStatus } from "../lib/storageAdapter";
import type {
	SpringCalcRecord,
	Units,
	ValidationResult,
} from "../types/spring";
import { SpringViz } from "./SpringViz";
import { CalculatorForm } from "./springCalculator/CalculatorForm";
import { CalculatorHeader } from "./springCalculator/CalculatorHeader";
import { ComparePanel } from "./springCalculator/ComparePanel";
import { SavedCalculationsTable } from "./springCalculator/SavedCalculationsTable";
import { useSavedCalculationsState } from "./springCalculator/useSavedCalculationsState";
import {
	type BeforeInstallPromptEvent,
	type CalculatorInputs,
	EMPTY_VALIDATION,
	parseNumber,
	type SavedFilters,
	type SavedSortOption,
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
	const [isDarkMode, setIsDarkMode] = useState(true);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [warnings, setWarnings] = useState<Record<string, string>>({});
	const [isOffline, setIsOffline] = useState(!navigator.onLine);
	const [toast, setToast] = useState<string | null>(null);
	const [invalidSaveAttempted, setInvalidSaveAttempted] = useState(false);
	const [deferredInstallPrompt, setDeferredInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [isIosSafari, setIsIosSafari] = useState(false);
	const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
		getSyncStatus(),
	);
	const {
		state: savedState,
		displayedHistory,
		selectedRecords,
		activeFilterCount,
		hydrateHistory,
		prependRecord,
		deleteRecord,
		deleteRecords,
		clearHistory,
		setConfirmingBulkDelete,
		setConfirmingClearAll,
		setSortOption,
		setFilter,
		clearFilters,
		toggleSelection,
		toggleSelectAll,
		clearSelection,
		setSelectedIds,
		setShowComparePanel,
	} = useSavedCalculationsState();

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
			hydrateHistory(records);
		})();
	}, [hydrateHistory]);

	useEffect(() => {
		const storedTheme = window.localStorage.getItem("spring-rate-theme");
		const shouldUseDark = storedTheme !== "light";
		setIsDarkMode(shouldUseDark);
		document.documentElement.classList.toggle("dark", shouldUseDark);
	}, []);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", isDarkMode);
		window.localStorage.setItem(
			"spring-rate-theme",
			isDarkMode ? "dark" : "light",
		);
	}, [isDarkMode]);

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
		if (!isCloudSyncEnabled) {
			return;
		}

		const unsubscribe = subscribeSyncStatus((status) => {
			setSyncStatus(status);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		if (!isCloudSyncEnabled || isOffline) {
			return;
		}
		void triggerBackgroundSync();
	}, [isOffline]);

	useEffect(() => {
		if (!toast) {
			return;
		}
		const timer = window.setTimeout(() => setToast(null), 1800);
		return () => window.clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		if (
			savedState.selectedIds.size === 0 &&
			savedState.isConfirmingBulkDelete
		) {
			setConfirmingBulkDelete(false);
		}
	}, [
		savedState.selectedIds.size,
		savedState.isConfirmingBulkDelete,
		setConfirmingBulkDelete,
	]);

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

	useEffect(() => {
		const userAgent = window.navigator.userAgent;
		const isIOSDevice =
			/iPad|iPhone|iPod/.test(userAgent) ||
			(window.navigator.platform === "MacIntel" &&
				window.navigator.maxTouchPoints > 1);
		const isSafariBrowser =
			/Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
		setIsIosSafari(isIOSDevice && isSafariBrowser);
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
		prependRecord(record);
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
		deleteRecord(id);
		setToast("Saved calculation deleted.");
	};

	const handleToggleSelection = (id: string): void => {
		toggleSelection(id);
	};

	const handleToggleSelectAll = (): void => {
		toggleSelectAll(displayedHistory.map((record) => record.id));
	};

	const handleSortOptionChange = (sortOption: SavedSortOption): void => {
		setSortOption(sortOption);
	};

	const handleFilterChange = (key: keyof SavedFilters, value: string): void => {
		setFilter(key, value);
	};

	const handleBulkDelete = async (): Promise<void> => {
		if (!savedState.isConfirmingBulkDelete) {
			setConfirmingBulkDelete(true);
			return;
		}

		const idsToDelete = Array.from(savedState.selectedIds);
		const idsToDeleteSet = new Set(idsToDelete);
		const deletedCount = idsToDelete.length;
		await bulkDeleteCalculations(idsToDelete);
		deleteRecords(idsToDeleteSet);
		setToast(
			`${deletedCount} calculation${deletedCount !== 1 ? "s" : ""} deleted.`,
		);
	};

	const handleCancelBulkDelete = (): void => {
		setConfirmingBulkDelete(false);
	};

	const handleClearSelection = (): void => {
		clearSelection();
	};

	const handleClearAll = async (): Promise<void> => {
		if (!savedState.isConfirmingClearAll) {
			setConfirmingClearAll(true);
			return;
		}

		await clearCalculations();
		clearHistory();
		setToast("All saved calculations cleared.");
	};

	const cancelClearAll = (): void => setConfirmingClearAll(false);

	const handleInstall = async (): Promise<void> => {
		if (!deferredInstallPrompt) {
			return;
		}
		await deferredInstallPrompt.prompt();
		await deferredInstallPrompt.userChoice;
		setDeferredInstallPrompt(null);
	};

	const handleThemeToggle = (): void => {
		setIsDarkMode((current) => !current);
	};

	const handleCompare = (): void => {
		setShowComparePanel(true);
	};

	const handleRemoveCandidate = (id: string): void => {
		const nextSelectedIds = Array.from(savedState.selectedIds).filter(
			(candidateId) => candidateId !== id,
		);
		setSelectedIds(nextSelectedIds);
	};

	const handleClearCompare = (): void => {
		clearSelection();
	};

	return (
		<div className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-6 md:py-8">
			<div className="rounded-2xl border border-[#d7ddea] bg-[#eef2f8] p-4 shadow-[0_8px_28px_rgba(23,40,79,0.12)] dark:border-slate-700/80 dark:bg-slate-900/70 dark:shadow-[0_16px_40px_rgba(2,6,23,0.5)]">
				<CalculatorHeader
					isOffline={isOffline}
					units={units}
					isDarkMode={isDarkMode}
					showIosInstallHint={isIosSafari && deferredInstallPrompt === null}
					showSyncStatus={isCloudSyncEnabled}
					syncStatus={syncStatus}
					onUnitsChange={setUnits}
					onThemeToggle={handleThemeToggle}
					hasInstallPrompt={deferredInstallPrompt !== null}
					onInstall={handleInstall}
				/>

				<main className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
						totalRecords={savedState.history.length}
						activeFilterCount={activeFilterCount}
						filters={savedState.filters}
						sortOption={savedState.sortOption}
						isConfirmingClearAll={savedState.isConfirmingClearAll}
						selectedIds={savedState.selectedIds}
						isConfirmingBulkDelete={savedState.isConfirmingBulkDelete}
						onSortOptionChange={handleSortOptionChange}
						onFilterChange={handleFilterChange}
						onClearFilters={clearFilters}
						onClearAll={handleClearAll}
						onCancelClearAll={cancelClearAll}
						onLoad={handleLoad}
						onDelete={handleDelete}
						onToggleSelection={handleToggleSelection}
						onCompare={handleCompare}
						onToggleSelectAll={handleToggleSelectAll}
						onBulkDelete={handleBulkDelete}
						onCancelBulkDelete={handleCancelBulkDelete}
						onClearSelection={handleClearSelection}
					/>

					{savedState.showComparePanel ? (
						<ComparePanel
							selectedRecords={selectedRecords}
							onRemoveCandidate={handleRemoveCandidate}
							onClearCompare={handleClearCompare}
						/>
					) : null}
				</main>
			</div>

			<AnimatePresence>
				{toast ? (
					<motion.div
						className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
