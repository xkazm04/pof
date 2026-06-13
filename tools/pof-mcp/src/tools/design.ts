import { type ToolDef, reqStr, optStr, optNum, qs, obj, STR, NUM, OBJ } from './shared.js';

/** Design truth & quality signals: feature matrix, GDD compliance, project health, canon, crash/regression. */
export const DESIGN_TOOLS: ToolDef[] = [
  {
    name: 'pof_feature_matrix',
    description: "One module's tracked features (status + quality score) plus an implemented/missing/unknown summary.",
    inputSchema: obj({ moduleId: STR }, ['moduleId']),
    example: { args: { moduleId: 'arpg-combat' } },
    handler: (args, pof) => pof.get(`/api/feature-matrix${qs({ moduleId: reqStr(args, 'moduleId') })}`),
  },
  {
    name: 'pof_feature_matrix_all',
    description: 'Feature-count summary for every module — the project-wide implemented/missing/unknown rollup.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/feature-matrix/all-statuses'),
  },
  {
    name: 'pof_feature_matrix_aggregate',
    description: 'Aggregated per-module summaries with quality scores — a cross-module quality signal.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/feature-matrix/aggregate'),
  },
  {
    name: 'pof_gdd_compliance',
    description: 'Audit the GDD against the code: an overall compliance score (0–100) + gaps ranked by severity and direction (design-ahead vs code-ahead). A top-level quality signal.',
    inputSchema: obj({ checklistProgress: OBJ }, []),
    example: { args: {} },
    handler: (args, pof) =>
      pof.post('/api/gdd-compliance', { action: 'audit', ...(args.checklistProgress && typeof args.checklistProgress === 'object' ? { checklistProgress: args.checklistProgress } : {}) }),
  },
  {
    name: 'pof_gdd',
    description: 'The synthesized Game Design Document (title + sections) assembled from all project data.',
    inputSchema: obj({ projectName: STR }),
    example: { args: {} },
    handler: (args, pof) => pof.get(`/api/game-design-doc${qs({ ...(optStr(args, 'projectName') ? { projectName: optStr(args, 'projectName') } : {}) })}`),
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
