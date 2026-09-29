import type { SubModuleId } from './modules';

/** Shared contract for the batch feature-review polling loop. Imported by both the
 *  server route (`/api/feature-matrix/batch-review`) and its one client writer/reader
 *  (`useBatchReview`, behind `BatchReviewPanel` and the Quality tab) so the request,
 *  the response shape and the consumers cannot drift. */

/** POST body that STARTS a batch. `moduleIds` scopes it to a subset (the Quality
 *  tab's stale set, or one module); omitted = every module with feature definitions.
 *  An id with no definitions refuses the whole request (400 naming it). */
export interface BatchReviewStartRequest {
  projectPath: string;
  projectName?: string;
  ueVersion?: string;
  appOrigin?: string;
  moduleIds?: SubModuleId[];
}

/** POST body that aborts the running batch. */
export interface BatchReviewAbortRequest {
  action: 'abort';
}

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
