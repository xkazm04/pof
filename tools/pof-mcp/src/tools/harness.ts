import { type ToolDef, reqStr, optStr, optNum, obj, qs, STR } from './shared.js';

/** Harness loop: autonomous plan → execute → verify → checkpoint. */
export const HARNESS_TOOLS: ToolDef[] = [
  {
    name: 'pof_harness_start',
    description:
      'Start the autonomous harness loop (plan → execute → verify → checkpoint) for a UE project. Returns immediately; poll pof_harness_status. Use this to push a whole game forward, not a single step.',
    inputSchema: obj(
      {
        projectPath: { type: 'string', description: 'Absolute path to the UE project root.' },
        projectName: STR,
        ueVersion: { type: 'string', description: 'e.g. "5.7".' },
        maxIterations: { type: 'number' },
        targetPassRate: {
          type: 'number',
          description:
            'Feature pass-rate to stop at. Accepts BOTH forms: a 0–1 fraction (0.9) or a 0–100 percent (90) — normalized server-side. Default 90%.',
        },
        passRateBasis: {
          type: 'string',
          enum: ['verified', 'self-reported'],
          description:
            'Which numerator the stop condition uses. "verified" (default) counts only passes backed by a passing required gate (ground truth); "self-reported" restores legacy counting of the executor\'s own verdicts.',
        },
        sessionTimeoutMs: {
          type: 'number',
          description: 'Max wall-clock per executor session in ms (default 30 min).',
        },
        areaPassThreshold: {
          type: 'number',
          description:
            'Min feature pass-rate to accept an AREA as completed. Accepts a 0–1 fraction or a 0–100 percent. Defaults to targetPassRate.',
        },
        themeDirective: {
          type: 'string',
          description:
            'Creative direction applied to every executor prompt (e.g. "Star Wars ARPG: lightsabers, Force abilities"). Max 2000 chars.',
        },
        budgetUsd: {
          type: 'number',
          description:
            'Spend cap in USD; the loop auto-pauses on overflow. Omitted → a default $25 cap applies (set unlimited:true to run uncapped).',
        },
        unlimited: {
          type: 'boolean',
          description: 'Opt out of any spend cap. Required to run with NO budget ceiling; without it a default cap applies.',
        },
        maxConcurrent: {
          type: 'number',
          description: 'Max concurrent executor sessions (default 1). Ignored when checkpoint:true (forces sequential).',
        },
        scenario: {
          type: 'string',
          description: 'Named curated area set instead of the auto-generated plan: "ui-overhaul" | "content-overhaul".',
        },
        checkpoint: { type: 'boolean', description: 'Git-checkpoint each completed area (forces maxConcurrent=1).' },
        ueTests: {
          type: 'boolean',
          description: 'Opt-in the UE5 automation-test gate (advisory, behind the required compile gate). Requires POF_UE_EDITOR_CMD/POF_UE_UPROJECT.',
        },
        ueTestFilter: {
          type: 'string',
          description: 'Automation test filter for the ue-test gate (default "Project"), e.g. "PoF.Combat".',
        },
      },
      ['projectPath', 'projectName', 'ueVersion'],
    ),
    handler: (args, pof) =>
      pof.post('/api/harness', {
        action: 'start',
        projectPath: reqStr(args, 'projectPath'),
        projectName: reqStr(args, 'projectName'),
        ueVersion: reqStr(args, 'ueVersion'),
        ...(optNum(args, 'maxIterations') != null ? { maxIterations: optNum(args, 'maxIterations') } : {}),
        ...(optNum(args, 'targetPassRate') != null ? { targetPassRate: optNum(args, 'targetPassRate') } : {}),
        ...(optStr(args, 'passRateBasis') != null ? { passRateBasis: optStr(args, 'passRateBasis') } : {}),
        ...(optNum(args, 'sessionTimeoutMs') != null ? { sessionTimeoutMs: optNum(args, 'sessionTimeoutMs') } : {}),
        ...(optNum(args, 'areaPassThreshold') != null ? { areaPassThreshold: optNum(args, 'areaPassThreshold') } : {}),
        ...(optStr(args, 'themeDirective') != null ? { themeDirective: optStr(args, 'themeDirective') } : {}),
        ...(optNum(args, 'budgetUsd') != null ? { budgetUsd: optNum(args, 'budgetUsd') } : {}),
        ...(args.unlimited === true ? { unlimited: true } : {}),
        ...(optNum(args, 'maxConcurrent') != null ? { maxConcurrent: optNum(args, 'maxConcurrent') } : {}),
        ...(optStr(args, 'scenario') != null ? { scenario: optStr(args, 'scenario') } : {}),
        ...(args.checkpoint === true ? { checkpoint: true } : {}),
        ...(args.ueTests === true ? { ueTests: true } : {}),
        ...(optStr(args, 'ueTestFilter') != null ? { ueTestFilter: optStr(args, 'ueTestFilter') } : {}),
      }),
  },
  {
    name: 'pof_harness_status',
    description:
      'Current harness status: run state, plan progress (areas/features/pass-rate), cost tally, checkpoints, and recent events. Poll after pof_harness_start.',
    inputSchema: obj({}),
    example: { args: {} },
    handler: (_args, pof) => pof.get('/api/harness'),
  },
  {
    name: 'pof_harness_plan',
    description: 'The full current harness game plan — every module area, its features, and dependency order.',
    inputSchema: obj({}),
    handler: (_args, pof) => pof.get('/api/harness?action=plan'),
  },
  {
    name: 'pof_harness_control',
    description: 'Steer the running harness: pause (after the current iteration) or resume.',
    inputSchema: obj({ action: { type: 'string', enum: ['pause', 'resume'] } }, ['action']),
    handler: (args, pof) => {
      const action = reqStr(args, 'action');
      if (action !== 'pause' && action !== 'resume') throw new Error('action must be "pause" or "resume"');
      return pof.post('/api/harness', { action });
    },
  },
  {
    name: 'pof_harness_guide',
    description: 'The generated build guide + learnings (steps, decisions, gotchas) accumulated by the harness, as markdown.',
    inputSchema: obj({}),
    handler: (_args, pof) => pof.get('/api/harness?action=guide'),
  },
  {
    name: 'pof_harness_runs',
    description:
      'Recent harness runs (history) — each row: runId, project, status, pass-rate, cost, timing. Newest first. Use to pick runs to inspect or diff.',
    inputSchema: obj({
      limit: { type: 'number', description: 'Max rows to return (default 50).' },
      project: { type: 'string', description: 'Filter to runs of this project path.' },
    }),
    example: { args: {} },
    handler: (args, pof) =>
      pof.get(`/api/harness/runs${qs({ limit: optNum(args, 'limit'), project: optStr(args, 'project') })}`),
  },
  {
    name: 'pof_harness_run',
    description:
      'Full snapshot of a single harness run by id: plan, progress log, guide, and cost. Get the id from pof_harness_runs.',
    inputSchema: obj({ runId: { type: 'string', description: 'The run id (from pof_harness_runs).' } }, ['runId']),
    handler: (args, pof) => pof.get(`/api/harness/runs/${encodeURIComponent(reqStr(args, 'runId'))}`),
  },
  {
    name: 'pof_harness_run_diff',
    description:
      'Compare two harness runs (base `a` vs head `b`): aggregate pass-rate/cost/duration/session deltas + per-area improvements & regressions.',
    inputSchema: obj(
      {
        a: { type: 'string', description: 'Base run id.' },
        b: { type: 'string', description: 'Head run id (the one you want to evaluate).' },
      },
      ['a', 'b'],
    ),
    handler: (args, pof) =>
      pof.get(`/api/harness/runs/diff${qs({ a: reqStr(args, 'a'), b: reqStr(args, 'b') })}`),
  },
];
