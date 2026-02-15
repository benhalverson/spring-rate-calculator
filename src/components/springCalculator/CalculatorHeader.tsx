import type { Units } from "../../types/spring";

/**
 * Props for the calculator top app bar.
 */
interface CalculatorHeaderProps {
	isOffline: boolean;
	units: Units;
	onUnitsChange: (units: Units) => void;
	hasInstallPrompt: boolean;
	onInstall: () => Promise<void>;
}

/**
 * Renders the sticky app header with status, units toggle, and install action.
 */
export function CalculatorHeader({
	isOffline,
	units,
	onUnitsChange,
	hasInstallPrompt,
	onInstall,
}: CalculatorHeaderProps) {
	return (
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
						onClick={() => onUnitsChange("mm")}
					>
						mm
					</button>
					<button
						type="button"
						className={units === "in" ? "active" : ""}
						onClick={() => onUnitsChange("in")}
					>
						in
					</button>
				</fieldset>

				{hasInstallPrompt ? (
					<button
						type="button"
						className="btn tertiary"
						onClick={() => void onInstall()}
					>
						Install
					</button>
				) : null}
			</div>
		</header>
	);
}
