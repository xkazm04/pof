/**
 * The brief a delegated task is sent with, and the report shape it must come back in.
 *
 * Codex does not read this repo's CLAUDE.md, fleet memory or the Obsidian vault, so every law
 * that matters to a change has to travel IN the brief. The report is schema-enforced
 * (`--output-schema`) so the overseer reads fields, not prose — and `deviations` /
 * `openQuestions` are required, because the most useful thing a delegate can return is where
 * it had to guess.
 */
import type { CodexTier, RouteHints } from './routing';
import type { CodexAccess } from './args';

export interface CodexTask {
  id: string;
  tier: CodexTier;
  hints?: RouteHints;
  access: CodexAccess;
  title: string;
  goal: string;
  /** Files/dirs to read before acting. */
  context: string[];
  /** Files the task may change. Anything else touched must be reported as a deviation. */
  scope: string[];
  /** Commands that must pass before the task reports `done`. */
  acceptance: string[];
  constraints?: string[];
  outOfScope?: string[];
  images?: string[];
}

export const REPO_LAWS = [
  'Do NOT commit, push, create branches, or rewrite git history. Leave changes in the working tree; the overseer reviews and commits.',
  'Import paths use the `@/` alias (maps to `src/`), never relative `../../`.',
  'No raw console.* in src/ — use `logger` from `@/lib/logger` (console.error is allowed).',
  'No hardcoded hex colors in src/ — use `@/lib/chart-colors` or CSS variables.',
  'Tests are vitest in `src/__tests__/` mirroring the source path; assert plain DOM, no jest-dom matchers.',
  'Reference-game DATA VALUES (rows from the devilutionX tables) never enter the repo — column names and mappings only.',
  'Keep changes minimal and in the style of the surrounding code; do not reformat unrelated lines.',
];

export const CODEX_REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'summary', 'filesChanged', 'testsRun', 'deviations', 'openQuestions', 'confidence'],
  properties: {
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    testsRun: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['command', 'passed', 'detail'],
        properties: { command: { type: 'string' }, passed: { type: 'boolean' }, detail: { type: 'string' } },
      },
    },
    deviations: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
} as const;

export interface CodexReport {
  status: 'done' | 'partial' | 'blocked';
  summary: string;
  filesChanged: string[];
  testsRun: { command: string; passed: boolean; detail: string }[];
  deviations: string[];
  openQuestions: string[];
  confidence: 'low' | 'medium' | 'high';
}

const list = (xs: string[] | undefined) => (xs?.length ? xs.map((x) => `- ${x}`).join('\n') : '- (none)');

export function renderBrief(t: CodexTask): string {
  const verify = t.access === 'write-verified'
    ? `Run every acceptance command yourself before reporting. If a command fails for an environment reason (sandbox, EPERM), say so in \`deviations\` — never report a test as passed that you did not see pass.`
    : 'This is a READ-ONLY task: do not modify any file.';
  return `# Task ${t.id}: ${t.title}

## Goal
${t.goal}

## Read first
${list(t.context)}

## You may change
${list(t.scope)}
Touching anything outside this list is allowed only if unavoidable — then list it in \`deviations\` with the reason.

## Acceptance (all must pass)
${list(t.acceptance)}

## Constraints
${list([...(t.constraints ?? []), ...REPO_LAWS])}

## Out of scope
${list(t.outOfScope)}

## How to finish
${verify}
Report with the required JSON schema. Put every place you had to GUESS (an unclear requirement, an assumption about intent) in \`openQuestions\` — a precise question is more useful than a confident guess.`;
}
