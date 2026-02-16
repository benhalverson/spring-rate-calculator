import { Moon, Sun } from "lucide-react";

import type { SyncStatus } from "../../lib/storageAdapter";
import type { Units } from "../../types/spring";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

/**
 * Props for the calculator top app bar.
 */
interface CalculatorHeaderProps {
	isOffline: boolean;
	units: Units;
	isDarkMode: boolean;
	showIosInstallHint: boolean;
	onUnitsChange: (units: Units) => void;
	onThemeToggle: () => void;
	hasInstallPrompt: boolean;
	onInstall: () => Promise<void>;
	showSyncStatus?: boolean;
	syncStatus?: SyncStatus;
}

const getSyncLabel = (status: SyncStatus | undefined): string => {
	if (!status) {
		return "Sync unavailable";
	}
	if (status.state === "syncing") {
		return `Syncing (${status.pending})`;
	}
	if (status.state === "queued") {
		return `Pending sync (${status.pending})`;
	}
	if (status.state === "error") {
		return `Sync error (${status.pending})`;
	}
	if (status.state === "idle") {
		return "Synced";
	}
	return "Sync disabled";
};

const getSyncVariant = (
	status: SyncStatus | undefined,
): "success" | "warning" | "secondary" => {
	if (!status) {
		return "secondary";
	}
	if (status.state === "idle") {
		return "success";
	}
	if (status.state === "syncing" || status.state === "queued") {
		return "warning";
	}
	return "secondary";
};

/**
 * Renders the sticky app header with status, units toggle, and install action.
 */
export function CalculatorHeader({
	isOffline,
	units,
	isDarkMode,
	showIosInstallHint,
	onUnitsChange,
	onThemeToggle,
	hasInstallPrompt,
	onInstall,
	showSyncStatus,
	syncStatus,
}: CalculatorHeaderProps) {
	return (
		<header className="sticky top-2 z-20 rounded-xl border border-[#d6dbe7] bg-[#f8faff]/95 px-4 py-2.5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2.5">
					<div
						className="text-lg font-semibold text-slate-700 dark:text-slate-200"
						aria-hidden="true"
					>
						≋
					</div>
					<h1 className="text-[1.125rem] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
						Spring Rate
					</h1>
				</div>

				<div className="flex flex-wrap items-center justify-end gap-2.5">
					<Badge
						variant={isOffline ? "warning" : "success"}
						className="gap-1.5 border-slate-200 bg-white px-2.5 py-1 text-[0.86rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
					>
						<span
							className="size-2 rounded-full bg-blue-500"
							aria-hidden="true"
						/>
						{isOffline ? "Offline (working locally)" : "Online"}
					</Badge>

					{showSyncStatus ? (
						<Badge
							variant={getSyncVariant(syncStatus)}
							className="border-slate-200 bg-white px-2.5 py-1 text-[0.8rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
						>
							{getSyncLabel(syncStatus)}
						</Badge>
					) : null}

					<fieldset className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
						<legend className="sr-only">Units</legend>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={`h-7 rounded px-2 text-xs ${units === "mm" ? "text-blue-700 underline decoration-2 underline-offset-[5px] dark:text-blue-300" : "text-slate-500 dark:text-slate-300"}`}
							onClick={() => onUnitsChange("mm")}
						>
							mm
						</Button>
						<span className="text-slate-400">|</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={`h-7 rounded px-2 text-xs ${units === "in" ? "text-blue-700 underline decoration-2 underline-offset-[5px] dark:text-blue-300" : "text-slate-500 dark:text-slate-300"}`}
							onClick={() => onUnitsChange("in")}
						>
							in
						</Button>
					</fieldset>

					<Button
						type="button"
						variant="outline"
						size="icon"
						className="size-8 rounded-md border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
						onClick={onThemeToggle}
						aria-label={
							isDarkMode ? "Switch to light mode" : "Switch to dark mode"
						}
					>
						{isDarkMode ? (
							<Sun className="size-4" />
						) : (
							<Moon className="size-4" />
						)}
					</Button>

					{hasInstallPrompt ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 border-slate-300 bg-slate-50 px-4 text-blue-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
							onClick={() => void onInstall()}
						>
							Install
						</Button>
					) : null}
				</div>
			</div>
			{showIosInstallHint ? (
				<p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
					On iPhone: tap Share, then Add to Home Screen.
				</p>
			) : null}
		</header>
	);
}
