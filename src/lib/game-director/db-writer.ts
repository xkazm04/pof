/**
 * The {@link DirectorWriter} bound to this app's own database — the five
 * external-writer route actions, called in-process instead of over HTTP.
 *
 * The harness script (`scripts/game-director/ingest-run.mjs`) POSTs a run record
 * to `/api/game-director` and the route drives the ingest through THIS writer,
 * so the mapping in `external-ingest.ts` has exactly one implementation and the
 * script stays a thin file-reader rather than a second copy of the contract.
 */

import {
  createSession,
  updateSessionStatus,
  updateSessionSummary,
  addFinding,
  addEvent,
} from '@/lib/game-director-db';
import { getFeaturesByModule, upsertFeatures } from '@/lib/feature-matrix-db';
import type { DirectorWriter } from './external-ingest';
import type { MatrixRoutingDeps } from './matrix-routing';

/** Session ids match the route's `create` action so nothing downstream can tell
 *  an ingested session apart by its id shape — only by its `source`. */
function newSessionId(): string {
  return `gd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDbDirectorWriter(): DirectorWriter {
  return {
    async createSession(payload) {
      const id = newSessionId();
      // 'external' travels with the create, exactly as the route's own `create`
      // action does — provenance is never settable apart from the row.
      const session = createSession(id, payload.name, payload.buildPath, payload.config, payload.source ?? 'external');
      return { id: session.id };
    },
    async updateStatus(sessionId, status) {
      updateSessionStatus(sessionId, status);
    },
    async addFinding(finding) {
      addFinding(finding);
    },
    async addEvent(event) {
      addEvent(event);
    },
    async complete({ sessionId, summary, durationMs, systemsTestedCount, findingsCount }) {
      updateSessionSummary(sessionId, summary, durationMs, systemsTestedCount, findingsCount, 'external');
    },
  };
}

/**
 * {@link MatrixRoutingDeps} bound to the feature-matrix tables. Both calls take
 * the project explicitly and pass it straight through — this module never
 * infers a scope, because a matrix read that guessed its own scope is the
 * silent mis-attribution the scoping exists to remove.
 *
 * The write goes through `upsertFeatures` with `source: 'review'` deliberately
 * NOT claimed: a routed queue line is not a review, so the write path declares
 * itself `unknown` rather than dressing up as one.
 */
export function createDbMatrixRoutingDeps(): MatrixRoutingDeps {
  return {
    async readModule(moduleId, projectId) {
      return getFeaturesByModule(moduleId, projectId);
    },
    async writeModule(moduleId, projectId, rows) {
      upsertFeatures(moduleId, rows, { projectId, source: 'unknown' });
    },
  };
}
