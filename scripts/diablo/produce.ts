/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Produce pipeline steps for ingested entities with codex as the PRODUCER and the server as the
 * GRADER (/diablo W02c-2).
 *
 *   npx tsx scripts/diablo/produce.ts --catalog bestiary --ids d1-MT_NZOMBIE,d1-MT_BZOMBIE \
 *     --steps "Concept & Role,Stat Block" [--concurrency 3] [--tier bulk] [--timeout-min 15]
 *
 * Each (entity, step) gets the REAL headless recipe (`buildStepRecipe` — canon for its profile,
 * reference values, acceptance contract) plus the app's callback output contract; codex answers
 * read-only; the artifact inside `@@CALLBACK…@@END_CALLBACK` is parsed with the app's own parser and
 * submitted through `submitStepArtifact`, so the SERVER decides the verdict — the producer never
 * grades itself. A run report is written to the vault.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import '../../src/lib/catalog/pipelines/registry.generated';
import { listRules } from '../../src/lib/project-rules-db';
import { buildStepRecipe, submitStepArtifact } from '../../src/lib/catalog/headless';
import { stepCallbackId } from '../../src/lib/catalog/stepPrompt';
import { parseCallbackMarker } from '../../src/lib/cli-task';
import { routeTask, type CodexTier } from '../../src/lib/codex-exec/routing';
import { buildCodexExecArgs, PROMPT_FROM_STDIN } from '../../src/lib/codex-exec/args';
import { parseCodexEvents } from '../../src/lib/codex-exec/events';
import { runCodex, stallMinutes } from '../codex/runner';

const REPO = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const HOME = process.env.POF_CODEX_HOME ?? resolve(REPO, '..', 'pof-codex');
const REPORTS = process.env.POF_DIABLO_PRODUCE_REPORTS ?? 'C:/Users/kazda/Documents/Obsidian/pof/Diablo/Codex/produce';

const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const catalogId = opt('catalog');
const ids = opt('ids')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
const steps = opt('steps')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
if (!catalogId || !ids.length || !steps.length) {
  console.error('usage: produce.ts --catalog <id> --ids a,b --steps "Step A,Step B" [--concurrency 3] [--tier bulk] [--timeout-min 15]');
  process.exit(2);
}
const concurrency = Number(opt('concurrency') ?? 3);
const timeoutMin = Number(opt('timeout-min') ?? 15);
const route = routeTask((opt('tier') ?? 'bulk') as CodexTier);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

interface Outcome { entityId: string; step: string; status: string; reason?: string; secs: number; tokensOut: number; note?: string }

function outputContract(id: string): string {
  return [
    '## OUTPUT (required)',
    'Reply with exactly ONE callback block containing this step’s artifact data as a single JSON object.',
    'Nothing outside the block is persisted. Do not modify any file.',
    `@@CALLBACK:${id}`,
    '{ "<field>": "<value>" }',
    '@@END_CALLBACK',
  ].join('\n');
}

async function produceOne(entityId: string, step: string): Promise<Outcome> {
  const dir = join(HOME, 'produce', stamp, `${entityId}__${step.replace(/[^A-Za-z0-9]+/g, '-')}`);
  mkdirSync(dir, { recursive: true });
  const cbId = stepCallbackId(catalogId!, entityId, step);
  const prompt = `${buildStepRecipe(catalogId!, entityId, step, undefined, listRules()).prompt}\n\n${outputContract(cbId)}`;
  writeFileSync(join(dir, 'prompt.md'), prompt);
  const last = join(dir, 'last.txt');
  const events = join(dir, 'events.jsonl');
  const args = buildCodexExecArgs({ route, access: 'read-only', prompt: PROMPT_FROM_STDIN, cwd: REPO, lastMessagePath: last, ephemeral: false });
  const t0 = Date.now();
  const end = await runCodex(args, REPO, prompt, events, timeoutMin, stallMinutes(route.effort), () => {});
  const secs = Math.round((Date.now() - t0) / 1000);
  const usage = parseCodexEvents(existsSync(events) ? readFileSync(events, 'utf8') : '').usage;
  const base = { entityId, step, secs, tokensOut: usage?.outputTokens ?? 0 };
  if (end.ended !== 'exited') return { ...base, status: 'no-artifact', note: `codex ${end.ended}` };
  const marker = parseCallbackMarker(existsSync(last) ? readFileSync(last, 'utf8') : '');
  if (!marker || !marker.data || typeof marker.data !== 'object' || Array.isArray(marker.data)) {
    return { ...base, status: 'no-artifact', note: marker ? 'callback body is not a JSON object' : 'no callback block in the answer' };
  }
  const r = submitStepArtifact(catalogId!, entityId, step, marker.data as Record<string, unknown>, []);
  return { ...base, status: r.acceptance.status, ...(r.acceptance.reason ? { reason: r.acceptance.reason } : {}) };
}

async function main() {
  const jobs = ids.flatMap((e) => steps.map((s) => [e, s] as const));
  console.log(`producing ${jobs.length} step artifact(s) with ${route.model}/${route.effort}, ${concurrency} at a time`);
  const outcomes: Outcome[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (next < jobs.length) {
      const [e, s] = jobs[next++];
      const o: Outcome = await produceOne(e, s).catch((err: unknown): Outcome => ({ entityId: e, step: s, status: 'error', secs: 0, tokensOut: 0, note: err instanceof Error ? err.message : String(err) }));
      outcomes.push(o);
      console.log(`${o.entityId} · ${o.step}: ${o.status}${o.reason ? ` — ${o.reason.slice(0, 140)}` : ''}${o.note ? ` (${o.note})` : ''} · ${o.secs}s`);
    }
  }));
  const tally = outcomes.reduce<Record<string, number>>((t, o) => ({ ...t, [o.status]: (t[o.status] ?? 0) + 1 }), {});
  console.log(`\ntally: ${JSON.stringify(tally)}`);
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(join(REPORTS, `${stamp}.json`), JSON.stringify({ catalogId, model: route.model, effort: route.effort, tally, outcomes }, null, 2));
}

main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
