import type { SpringCalcRecord } from "../../types/spring";
import {
	formatK,
	formatValue,
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
	onToggleSort: () => void;
	onClearAll: () => Promise<void>;
	onCancelClearAll: () => void;
	onLoad: (record: SpringCalcRecord) => void;
	onDelete: (id: string) => Promise<void>;
}

/**
 * Returns the display label for the `k` column sort toggle.
 */
const getSortLabel = (direction: KSortDirection): string => {
	if (direction === "none") {
		return "Sort k";
	}
	if (direction === "asc") {
		return "Sort k ↑";
	}
	return "Sort k ↓";
};

/**
 * Renders persisted calculations in a sortable data table with row actions.
 */
export function SavedCalculationsTable({
	records,
	isConfirmingClearAll,
	kSortDirection,
	onToggleSort,
	onClearAll,
	onCancelClearAll,
	onLoad,
	onDelete,
}: SavedCalculationsTableProps) {
	return (
		<section className="card saved-card">
			<header className="card-header">
				<h2>Saved</h2>
				<div className="saved-actions">
					<button
						type="button"
						className="btn tertiary"
						onClick={() => void onClearAll()}
					>
						{isConfirmingClearAll ? "Confirm clear" : "Clear all"}
					</button>
					{isConfirmingClearAll ? (
						<button type="button" className="btn" onClick={onCancelClearAll}>
							Cancel
						</button>
					) : null}
				</div>
			</header>

			{records.length === 0 ? (
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
										onClick={onToggleSort}
										aria-label={`Toggle k sorting, current: ${kSortDirection}`}
									>
										{getSortLabel(kSortDirection)}
									</button>
								</th>
								<th scope="col">Units</th>
								<th scope="col">Purchase</th>
								<th scope="col">Notes</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{records.map((record) => (
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
												onClick={() => onLoad(record)}
											>
												Load
											</button>
											<button
												type="button"
												className="btn"
												onClick={() => void onDelete(record.id)}
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
	);
}
