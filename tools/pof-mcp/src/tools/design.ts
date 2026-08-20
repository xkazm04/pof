import {
  type ToolDef,
  reqStr, optStr, optNum, qs, obj, scopedRead, backendScope, PROJECT_PATH, STR, NUM, OBJ,
} from './shared.js';
import type { PofClient } from '../pofClient.js';

/**
 * The compliance audit's evidence base, counted by the backend itself.
 *
 * The audit response carries no scope block of its own (it is a report, not a row read),
 * so the counts come from `/api/feature-matrix/scope` — the SAME rows `runComplianceAudit`
 * scores against. A failed lookup is reported beside the result, never swallowed: an
 * agent must not read "every module scored 0" as "nothing is implemented".
 */
async function featureScopeCounts(pof: PofClient, projectPath: string | undefined): Promise<unknown> {
  try {
    return await pof.get(`/api/feature-matrix/scope${qs({ ...(projectPath ? { projectPath } : {}) })}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * The feature matrix is PROJECT-SCOPED, and an unscoped read is legacy-only.
 *
 * Wave 16 (`42a71127`) attributed every `feature_matrix` row to the project that
 * produced it — correctly, on the operator's decision, 165/165 rows preserved. But
 * `projectScopeSql('')` resolves to `project_id = ''`, i.e. LEGACY ROWS ONLY, and after
 * that backfill there are no legacy rows left. These three tools sent no project at all
 * and their schemas declared none, so every headless read answered **0 of 165** and an
 * agent could not scope them even deliberately. Measured on the live DB, 2026-08-20:
 * `feature_matrix` = 165 rows, 0 with `project_id = ''`.
 *
 * Each route already returns its own `scope` counts, so the disclosure below costs no
 * extra request and cannot disagree with the rows it describes.
 */
const FEATURES = 'features';

/** Design truth & quality signals: feature matrix, GDD compliance, project health, canon, crash/regression. */
export const DESIGN_TOOLS: ToolDef[] = [
  {
    name: 'pof_feature_matrix',
    description:
      "One module's tracked features (status + quality score) plus an implemented/missing/unknown summary. SCOPE IT with `projectPath`: feature rows carry the project that produced them, and WITHOUT a projectPath this reads ONLY the unattributed legacy rows — which on a backfilled database is NOTHING. The response always states which view you got.",
    inputSchema: obj({ moduleId: STR, projectPath: PROJECT_PATH }, ['moduleId']),
    example: { args: { moduleId: 'arpg-combat' }, note: 'No projectPath = the legacy/unattributed view; the response says so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const result = await pof.get(
        `/api/feature-matrix${qs({ moduleId: reqStr(args, 'moduleId'), ...(projectPath ? { projectPath } : {}) })}`,
      );
      return { result, scope: scopedRead(projectPath, FEATURES, { counts: backendScope(result) }) };
    },
  },
  {
    name: 'pof_feature_matrix_all',
    description:
      'Feature-count summary for every module — the project-wide implemented/missing/unknown rollup. SCOPE IT with `projectPath`: without one this reads ONLY the unattributed legacy rows, never every module of every project. The response always states which view you got.',
    inputSchema: obj({ projectPath: PROJECT_PATH }),
    example: { args: {}, note: 'No projectPath = the legacy/unattributed view; the response says so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const result = await pof.get(`/api/feature-matrix/all-statuses${qs({ ...(projectPath ? { projectPath } : {}) })}`);
      return { result, scope: scopedRead(projectPath, FEATURES, { counts: backendScope(result) }) };
    },
  },
  {
    name: 'pof_feature_matrix_aggregate',
    description:
      'Aggregated per-module summaries with quality scores — a cross-module quality signal. SCOPE IT with `projectPath`: without one this reads ONLY the unattributed legacy rows, so an empty rollup means "another project owns these rows", not "nothing is built". The response always states which view you got.',
    inputSchema: obj({ projectPath: PROJECT_PATH }),
    example: { args: {}, note: 'No projectPath = the legacy/unattributed view; the response says so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const result = await pof.get(`/api/feature-matrix/aggregate${qs({ ...(projectPath ? { projectPath } : {}) })}`);
      return { result, scope: scopedRead(projectPath, FEATURES, { counts: backendScope(result) }) };
    },
  },
  {
    name: 'pof_gdd_compliance',
    description:
      'Audit the GDD against the code: an overall compliance score (0–100) + gaps ranked by severity and direction (design-ahead vs code-ahead) — or triage those gaps (`resolve-gap` / `unresolve-gap` / `resolutions`). A top-level quality signal. SCOPE IT with `projectPath`: the audit reads the SAME project-scoped feature rows as pof_feature_matrix, so without a projectPath it scores every module against ZERO evidence — and gap resolutions are stored per project, so an unscoped remediation lands where no scoped reader will ever see it. The response always states which view you got.',
    inputSchema: obj({
      action: {
        type: 'string',
        enum: ['audit', 'resolve-gap', 'unresolve-gap', 'resolutions'],
        description: 'Default `audit`. The three others read/write the durable gap triage — under the SAME projectPath the audit used.',
      },
      checklistProgress: OBJ,
      gapId: { type: 'string', description: 'Required by resolve-gap / unresolve-gap.' },
      moduleId: { type: 'string', description: 'Optional module attribution for resolve-gap.' },
      note: { type: 'string', description: 'Optional triage note for resolve-gap.' },
      projectPath: PROJECT_PATH,
    }, []),
    example: { args: {}, note: 'No projectPath = zero evidence: every module is scored against the legacy/unattributed rows. The response says so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const action = optStr(args, 'action') ?? 'audit';
      const result = await pof.post('/api/gdd-compliance', {
        action,
        // The scope the audit READS is the scope its resolutions are WRITTEN under —
        // one value, forwarded to both halves of the route.
        ...(projectPath ? { projectPath } : {}),
        ...(args.checklistProgress && typeof args.checklistProgress === 'object' ? { checklistProgress: args.checklistProgress } : {}),
        ...(optStr(args, 'gapId') ? { gapId: optStr(args, 'gapId') } : {}),
        ...(optStr(args, 'moduleId') ? { moduleId: optStr(args, 'moduleId') } : {}),
        ...(optStr(args, 'note') ? { note: optStr(args, 'note') } : {}),
      });
      return { result, scope: scopedRead(projectPath, 'feature rows (the audit\'s only evidence) and gap resolutions', { counts: await featureScopeCounts(pof, projectPath) }) };
    },
  },
  {
    name: 'pof_gdd',
    description:
      'The synthesized Game Design Document (title + sections) assembled from all project data. SCOPE IT with `projectPath`: the synthesis reads project-scoped feature and review rows. Unlike the other feature-matrix reads, an UNSCOPED call here is deliberately GLOBAL (it spans every project, so a feature two projects both hold is counted twice) — the document declares that itself, and so does the `scope` block below.',
    inputSchema: obj({ projectName: STR, projectPath: PROJECT_PATH }),
    example: { args: {}, note: 'No projectPath = the GLOBAL cross-project synthesis; the document and the scope block both say so.' },
    handler: async (args, pof) => {
      const projectPath = optStr(args, 'projectPath');
      const result = await pof.get(
        `/api/game-design-doc${qs({
          ...(optStr(args, 'projectName') ? { projectName: optStr(args, 'projectName') } : {}),
          ...(projectPath ? { projectPath } : {}),
        })}`,
      );
      return {
        result,
        scope: scopedRead(projectPath, 'feature and review rows', {
          unscopedNote:
            'UNSCOPED — no projectPath was given. This synthesis is GLOBAL: it spans EVERY project in the database, '
            + 'so a feature two projects both hold is counted once per project. It is NOT one project\'s progress. '
            + 'Pass projectPath for a single project\'s document.',
          counts: backendScope(result),
        }),
      };
    },
  },
  {
    name: 'pof_project_health',
    description: 'Fused project health: overall completion, current quality score, performance score, quality trend, per-module health, and burn/velocity history.',
    inputSchema: obj({ checklistProgress: OBJ, perfInput: OBJ, crashInput: OBJ }),
    example: { args: {} },
    handler: (args, pof) =>
      pof.post('/api/project-health', {
        ...(args.checklistProgress && typeof args.checklistProgress === 'object' ? { checklistProgress: args.checklistProgress } : {}),
        ...(args.perfInput && typeof args.perfInput === 'object' ? { perfInput: args.perfInput } : {}),
        ...(args.crashInput && typeof args.crashInput === 'object' ? { crashInput: args.crashInput } : {}),
      }),
  },
  {
    name: 'pof_project_rules',
    description: 'The project design canon (ProjectRule[]) — the same rules that prefix Produce prompts. Read this to understand the constraints your work must follow.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/project-rules'),
  },
  {
    name: 'pof_crash_analyze',
    description: 'Full crash analysis: reports, diagnoses, recurring patterns, and stats (total, systemic issues, most-common type, per-crash severity).',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/crash-analyzer'),
  },
  {
    name: 'pof_regression',
    description: 'Regression-tracker query: stats (regression rate, active alerts, peak severity), or fingerprints/alerts/occurrences/sessions.',
    inputSchema: obj({ action: { type: 'string', enum: ['stats', 'fingerprints', 'alerts', 'active-alerts', 'occurrences', 'sessions'] }, fpId: STR }),
    example: { args: { action: 'stats' } },
    handler: (args, pof) => pof.get(`/api/regression-tracker${qs({ action: optStr(args, 'action') ?? 'stats', ...(optStr(args, 'fpId') ? { fpId: optStr(args, 'fpId') } : {}) })}`),
  },
  {
    name: 'pof_ai_testing',
    description: 'AI/behavior-tree test suites + aggregated pass-rate summary (or a single suite by id).',
    inputSchema: obj({ suiteId: NUM }),
    example: { args: {} },
    handler: (args, pof) => pof.get(`/api/ai-testing${qs({ ...(optNum(args, 'suiteId') != null ? { suiteId: optNum(args, 'suiteId') } : {}) })}`),
  },
];
