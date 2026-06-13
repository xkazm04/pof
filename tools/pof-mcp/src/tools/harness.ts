import { type ToolDef, reqStr, optNum, obj, STR } from './shared.js';

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
        targetPassRate: { type: 'number', description: '0–1; stop when this feature pass-rate is reached.' },
        budgetUsd: { type: 'number', description: 'Spend cap; the loop auto-pauses on overflow.' },
        checkpoint: { type: 'boolean', description: 'Git-checkpoint each completed area.' },
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
        ...(optNum(args, 'budgetUsd') != null ? { budgetUsd: optNum(args, 'budgetUsd') } : {}),
        ...(args.checkpoint === true ? { checkpoint: true } : {}),
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
];
