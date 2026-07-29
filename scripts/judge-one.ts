/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Judge ONE arbitrary candidate against the strict rubric (Quality Program WS1 hardening loop).
 * Unlike judge-run.ts (which judges STORED artifacts), this scores a fresh candidate an agent
 * just produced — so the improve→produce→judge→reflect loop can run. Prints a one-line JSON
 * verdict {score, verdict, findings, fix} to stdout (nothing else) for easy parsing.
 *
 *   npx tsx scripts/judge-one.ts --class 2d-art --image path/to/cand.png --subject "a fire spell icon"
 *   npx tsx scripts/judge-one.ts --class text-config --text path/to/cand.json --subject "sword economy"
 *
 * Canon-aware (matches judge-run): pass --catalog <id> to inject that catalog's binding design
 * rules, and --siblings <file> (a { step: config } JSON, e.g. from get-config without --step) to
 * give the judge the entity's other steps as cross-reference context. --step names the config
 * under judgment so it is excluded from its own sibling context. --include-nested widens that
 * sibling projection to bounded nested objects (default off, matches judge-run).
 *
 * SPEND: like judge-run, this spawn is gated by the shared pre-flight guardrail and recorded
 * through `recordSpend` (module `judge`), so a judging loop is visible to the Spend tab and
 * refusable by a configured budget. `--force-budget` overrides a refusal.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION } from '../src/lib/judge/rubrics';
import type { DeliverableClass } from '../src/lib/judge/dimensions';
import { getModelPolicy } from '../src/lib/model-policy';
import { recordSpend, getBudgetStatus, getTaskTypeEstimate } from '../src/lib/cli-spend-db';
import {
  judgeBudgetGate,
  judgeSpendRecord,
  judgeTaskType,
  parseCliJsonRun,
  type CliRunMetrics,
} from '../src/lib/judge/spendMeter';
import { canonContextFor } from '../src/lib/catalog/canon/canonContext';
import { CANON_SEED } from '../src/lib/catalog/canon/canon-seed';
import { buildSiblingContext } from '../src/lib/judge/siblingContext';
import { stripNonContent } from '../src/lib/judge/payload';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };

/**
 * `--output-format json` carries the cost/usage envelope alongside the same final text, which is
 * what makes this spawn meterable. `--dangerously-skip-permissions` is required because an image
 * judgment instructs the model to `Read` the candidate file while stdin is the prompt pipe —
 * there is no interactive channel to approve that tool call on.
 */
function runClaude(prompt: string, model: string, effort: string): Promise<CliRunMetrics> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', model, '--effort', effort, '--output-format', 'json', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(parseCliJsonRun(out)) : reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`))));
    child.stdin.write(prompt); child.stdin.end();
  });
}

async function main() {
  const cls = arg('class') as DeliverableClass;
  const subject = arg('subject') ?? 'the asset';
  const image = arg('image');
  const textFile = arg('text');
  if (!cls) { console.error('need --class'); process.exit(2); }

  const payload = image
    ? `Use the Read tool to view the image at:\n${image}\nThen judge it.`
    : textFile
      ? (() => {
          const raw = readFileSync(textFile, 'utf8').slice(0, 60000);
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return '```json\n' + JSON.stringify(stripNonContent(parsed), null, 2) + '\n```';
          } catch {
            return '```\n' + raw + '\n```'; // not JSON — judge it verbatim
          }
        })()
      : (() => { console.error('need --image or --text'); process.exit(2); })() as string;

  // Canon-aware context (opt-in, mirrors judge-run): catalog canon + entity sibling projection.
  const catalog = arg('catalog');
  const canonContext = catalog ? canonContextFor(CANON_SEED, catalog) || undefined : undefined;
  const siblingsFile = arg('siblings');
  // Opt-in: include bounded nested objects in the sibling projection (default off — Task 4 A/Bs this).
  const includeNested = process.argv.includes('--include-nested');
  let siblingContext: string | undefined;
  if (siblingsFile) {
    const raw = JSON.parse(readFileSync(siblingsFile, 'utf8')) as Record<string, unknown>;
    // get-config (no --step) emits { step: config }; project every step except the one under judgment.
    const steps = Object.entries(raw).map(([step, data]) => ({ step, data: (data ?? {}) as Record<string, unknown> }));
    siblingContext = buildSiblingContext(steps, arg('step') ?? '', { includeNested }) || undefined;
  }

  const pol = getModelPolicy('judge-content');
  const taskType = judgeTaskType(cls);

  // Same guardrail as every other CLI invocation — a configured budget can refuse this spawn.
  const b = getBudgetStatus();
  const gate = judgeBudgetGate({
    taskType,
    estimate: getTaskTypeEstimate(taskType),
    budget: {
      dailyExceeded: b.dailyExceeded,
      monthlyExceeded: b.monthlyExceeded,
      dailyRemainingUsd: b.dailyRemainingUsd,
      monthlyRemainingUsd: b.monthlyRemainingUsd,
    },
  });
  if (gate.refuse && !process.argv.includes('--force-budget')) {
    console.error(`REFUSED — ${taskType}: ${gate.reasons.join(' ')} (override with --force-budget)`);
    process.exit(3);
  }

  const prompt = buildRubricPrompt(cls, { subject, payload, canonContext, siblingContext });
  const m = await runClaude(prompt, pol.model, pol.effort);
  try {
    recordSpend(judgeSpendRecord(taskType, `judge-one ${cls}: ${subject}`, m));
  } catch (e) {
    console.error('spend not recorded:', e instanceof Error ? e.message : e);
  }
  const raw = m.text;
  const res = parseJudgeResult(raw);
  if (!res) { console.log(JSON.stringify({ score: 0, verdict: 'fail', findings: 'unparseable judge output', fix: 'retry', raw: raw.slice(0, 200), rubricVersion: RUBRIC_VERSION })); return; }
  console.log(JSON.stringify({ ...res, rubricVersion: RUBRIC_VERSION }));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
