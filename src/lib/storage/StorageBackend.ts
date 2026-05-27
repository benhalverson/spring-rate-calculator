import type { CloudSyncListener, CloudSyncStatus } from "../../types/cloudSync";
import type { SpringCalcRecord } from "../../types/spring";

export interface StorageBackend {
	addCalculation: (record: SpringCalcRecord) => Promise<void>;
	listCalculations: () => Promise<SpringCalcRecord[]>;
	deleteCalculation: (id: string) => Promise<void>;
	bulkDeleteCalculations: (ids: string[]) => Promise<void>;
	clearCalculations: () => Promise<void>;
	getCloudSyncStatus?: () => CloudSyncStatus;
	subscribeCloudSyncStatus?: (listener: CloudSyncListener) => () => void;
	flushCloudSyncNow?: () => Promise<void>;
}
