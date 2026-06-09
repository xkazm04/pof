import type { SubModuleId } from './modules';

/** Shared contract for the batch feature-review polling loop. Imported by both the
 *  server route (`/api/feature-matrix/batch-review`) and the client reader
 *  (`BatchReviewPanel`) so the response shape and the consumer cannot drift. */

export type ModuleReviewStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export interface ModuleProgress {
  moduleId: SubModuleId;
  label: string;
  featureCount: number;
  status: ModuleReviewStatus;
  executionId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface BatchReviewState {
  batchId: string;
  status: 'running' | 'completed' | 'error' | 'aborted';
  startedAt: string;
  completedAt: string | null;
  modules: ModuleProgress[];
  currentIndex: number;
}
