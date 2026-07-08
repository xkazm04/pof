/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Model & effort benchmark harness (Quality Program WS3). For each sample task it runs the
 * PRODUCE step at every (model, effort) combo in the matrix, strict-judges each output with the
 * WS2 Opus judge (blind — the judge never sees which model produced it), and records the score +
 * cost. `--write-winners` writes the highest-median (model, effort) per task class into
 * model_policy so defaults become data-driven. Results surface on the /status Models panel.
 *
 *   npx tsx scripts/model-benchmark.ts --dry                 # show the matrix
 *   npx tsx scripts/model-benchmark.ts --combos sonnet:low,opus:high   # run a subset
 *   npx tsx scripts/model-benchmark.ts --write-winners       # persist winners after a run
 */
import { spawn } from 'node:child_process';
import { qualityPack } from '../src/lib/prompts/quality';
import { buildRubricPrompt, parseJudgeResult } from '../src/lib/judge/rubrics';
import { getModelPolicy, setModelPolicy, type ClaudeModel, type Effort } from '../src/lib/model-policy';
import { recordSample, listBenchmarks } from '../src/lib/benchmark-db';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k: string) => process.argv.includes(`--${k}`);
const DRY = has('dry');

// Representative sample tasks (kept small; expand as needed). Each is a produce-text task.
const SAMPLE_TASKS = [
  { taskId: 'produce-text:items', catalog: 'items', step: 'Economy', subject: 'a mid-tier one-handed sword' },
  { taskId: 'produce-text:quests', catalog: 'quests', step: 'Objective Graph', subject: 'a three-stage retrieval quest' },
];

// Pruned matrix — sensible pairs (cheap models at low effort, strong models at high effort).
const DEFAULT_COMBOS: { model: ClaudeModel; effort: Effort }[] = [
  { model: 'haiku', effort: 'low' },
  { model: 'sonnet', effort: 'low' },
  { model: 'sonnet', effort: 'medium' },
  { model: 'opus', effort: 'medium' },
  { model: 'fable', effort: 'medium' },
];

function runClaude(prompt: string, model: string, effort: string): Promise<{ text: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const args = ['-p', '-', '--model', model, '--effort', effort, '--output-format', 'text', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve({ text: out, ms: Date.now() - started }) : reject(new Error(`claude exit ${code}: ${err.slice(0, 200)}`))));
    child.stdin.write(prompt); child.stdin.end();
  });
}

async function main() {
  const combos = arg('combos')
    ? arg('combos')!.split(',').map((c) => { const [model, effort] = c.split(':'); return { model: model as ClaudeModel, effort: effort as Effort }; })
    : DEFAULT_COMBOS;

  console.log(`benchmark: ${SAMPLE_TASKS.length} tasks × ${combos.length} combos = ${SAMPLE_TASKS.length * combos.length} runs, dry=${DRY}`);
  if (DRY) {
    for (const t of SAMPLE_TASKS) for (const c of combos) console.log(`  ${t.taskId}  ${c.model}/${c.effort}`);
    return;
  }

  const judge = getModelPolicy('judge-content'); // blind judge: strongest, fixed across combos

  for (const t of SAMPLE_TASKS) {
    const producePrompt = [
      qualityPack('text-config', t.catalog),
      `Produce the "${t.step}" config for ${t.subject}. Respond with ONLY a JSON object of the fields a real implementation needs.`,
    ].join('\n\n');

    for (const c of combos) {
      try {
        const { text, ms } = await runClaude(producePrompt, c.model, c.effort);
        // Blind judge — the rubric prompt names only the subject, never the producing model.
        const jp = buildRubricPrompt('text-config', { subject: `${t.catalog} :: ${t.step} (${t.subject})`, payload: '```json\n' + text.trim() + '\n```' });
        const { text: jraw } = await runClaude(jp, judge.model, judge.effort);
        const res = parseJudgeResult(jraw);
        if (!res) { console.log(`  ${t.taskId} ${c.model}/${c.effort} → UNPARSEABLE`); continue; }
        recordSample({ taskClass: 'produce-text', model: c.model, effort: c.effort, taskId: t.taskId, score: res.score, wallMs: ms });
        console.log(`  ${t.taskId} ${c.model}/${c.effort} → ${res.score} (${(ms / 1000).toFixed(0)}s)`);
      } catch (e) {
        console.log(`  ${t.taskId} ${c.model}/${c.effort} → ERROR ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // Aggregate + optionally persist winners.
  const aggs = listBenchmarks().filter((a) => a.taskClass === 'produce-text');
  const best = aggs[0]; // listBenchmarks sorts by taskClass then medianScore desc
  console.log(`\nwinner (produce-text): ${best ? `${best.model}/${best.effort} median ${best.medianScore}` : 'none'}`);
  if (has('write-winners') && best) {
    setModelPolicy('produce-text', { model: best.model as ClaudeModel, effort: best.effort as Effort }, 'benchmark', best.medianScore);
    console.log(`  wrote produce-text → ${best.model}/${best.effort} into model_policy`);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
