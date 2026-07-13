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
 * under judgment so it is excluded from its own sibling context.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION } from '../src/lib/judge/rubrics';
import type { DeliverableClass } from '../src/lib/judge/dimensions';
import { getModelPolicy } from '../src/lib/model-policy';
import { canonContextFor } from '../src/lib/catalog/canon/canonContext';
import { CANON_SEED } from '../src/lib/catalog/canon/canon-seed';
import { buildSiblingContext } from '../src/lib/judge/siblingContext';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };

function runClaude(prompt: string, model: string, effort: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', model, '--effort', effort, '--output-format', 'text', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(out) : reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`))));
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
      ? '```\n' + readFileSync(textFile, 'utf8').slice(0, 60000) + '\n```' // generous cap; 12k silently truncated real configs mid-field
      : (() => { console.error('need --image or --text'); process.exit(2); })() as string;

  // Canon-aware context (opt-in, mirrors judge-run): catalog canon + entity sibling projection.
  const catalog = arg('catalog');
  const canonContext = catalog ? canonContextFor(CANON_SEED, catalog) || undefined : undefined;
  const siblingsFile = arg('siblings');
  let siblingContext: string | undefined;
  if (siblingsFile) {
    const raw = JSON.parse(readFileSync(siblingsFile, 'utf8')) as Record<string, unknown>;
    // get-config (no --step) emits { step: config }; project every step except the one under judgment.
    const steps = Object.entries(raw).map(([step, data]) => ({ step, data: (data ?? {}) as Record<string, unknown> }));
    siblingContext = buildSiblingContext(steps, arg('step') ?? '') || undefined;
  }

  const pol = getModelPolicy('judge-content');
  const prompt = buildRubricPrompt(cls, { subject, payload, canonContext, siblingContext });
  const raw = await runClaude(prompt, pol.model, pol.effort);
  const res = parseJudgeResult(raw);
  if (!res) { console.log(JSON.stringify({ score: 0, verdict: 'fail', findings: 'unparseable judge output', fix: 'retry', raw: raw.slice(0, 200), rubricVersion: RUBRIC_VERSION })); return; }
  console.log(JSON.stringify({ ...res, rubricVersion: RUBRIC_VERSION }));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
