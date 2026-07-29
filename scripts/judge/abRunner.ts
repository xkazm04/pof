/**
 * A/B probe CLI runner — factors the Claude Code CLI spawn out of `scripts/judge-run.ts`'s
 * `runClaude` so the production judge harness and `scripts/judge/ab-probe.ts` share ONE spawn
 * path instead of two copies that can drift apart. Same CLI args shape, same `judge-content`
 * model policy, same spend-recording seam: an A/B probe draw costs the same as a production
 * judge draw and must show up in the Spend tab, not in a private ledger.
 *
 * Do not invent a different invocation here — this mirrors judge-run.ts's `runClaude` verbatim
 * in its args shape (`-p -`, `--model`, `--effort`, `--output-format json`,
 * `--dangerously-skip-permissions`).
 */
import { spawn } from 'node:child_process';
import { getModelPolicy } from '../../src/lib/model-policy';
import { recordSpend } from '../../src/lib/cli-spend-db';
import { judgeSpendRecord, parseCliJsonRun, type CliRunMetrics } from '../../src/lib/judge/spendMeter';

/** Running count so each probe draw gets a distinct, attributable spend label (`ab-probe draw N`). */
let drawSeq = 0;

/**
 * Spawn the Claude CLI headless at the given model alias + effort and resolve to its metered
 * result. Byte-for-byte the same args shape as `runClaude` in `scripts/judge-run.ts`:
 * `-p - --model <alias> --effort <effort> --output-format json --dangerously-skip-permissions`.
 *
 * `--output-format json` is what makes the spawn meterable (cost/usage alongside the same
 * `result` text the judge parser reads) without changing the prompt, model, or effort.
 * `--dangerously-skip-permissions` is required because stdin is the prompt pipe — there is no
 * interactive channel to approve anything on.
 */
function runClaude(prompt: string, modelId: string, effort: string): Promise<CliRunMetrics> {
  return new Promise((resolve, reject) => {
    const args = ['-p', '-', '--model', modelId, '--effort', effort, '--output-format', 'json', '--dangerously-skip-permissions'];
    const child = spawn('claude', args, { shell: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || out ? resolve(parseCliJsonRun(out)) : reject(new Error(`claude exit ${code}: ${err.slice(0, 300)}`))));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Run one judge draw for the A/B probe at the `judge-content` model policy — the same policy
 * every production content-judge draw uses (Opus/high by default) — and return the judge's raw
 * result text, exactly what `parseJudgeResult` expects to read.
 *
 * Spend is recorded through the same `recordSpend` seam `judge-run.ts` uses, labeled
 * `ab-probe draw N` so a probe run is attributable in the Spend tab rather than invisible.
 * Recording never blocks or fails the draw: a spend-write error is logged and swallowed, the
 * same failure mode `judge-run.ts` uses.
 */
export async function runClaudeJudge(prompt: string): Promise<string> {
  const policy = getModelPolicy('judge-content');
  const m = await runClaude(prompt, policy.model, policy.effort);
  drawSeq += 1;
  try {
    recordSpend(judgeSpendRecord('judge-content', `ab-probe draw ${drawSeq}`, m));
  } catch (e) {
    console.error('  ! spend not recorded:', e instanceof Error ? e.message : e);
  }
  return m.text;
}
