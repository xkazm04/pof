/**
 * v4 re-judge sweep driver — Stage B of the readiness loop.
 *
 * Runs the official median-of-3 verdict for each (catalog, step) pair on the worklist,
 * SEQUENTIALLY, one child process at a time. This is deliberately the DRIVER's job and not
 * an authoring agent's: an agent that holds a 3-draw run open dies on a session limit with
 * its content applied and its verdicts unrecorded, leaving a stale verdict grading content
 * the cell no longer holds. (That failure cost the 2026-07-29 wave 7 agents' verdicts.)
 *
 * `--rejudge` is MANDATORY here: judgeSkipDecision binds a standing verdict on
 * stepContentHash + RUBRIC_VERSION, and stripping produceDirection moves NEITHER — without
 * it every contaminated cell is skipped and the whole sweep reads as inert.
 *
 * Resumable: each finished pair is appended to sweep-progress.json and skipped on restart,
 * so a rate-limit reset costs one pair rather than the run.
 *
 *   node scripts/readiness/sweep-v4.mjs <sweep-list.json> <progress.json> [--limit N]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [listPath, progressPath] = process.argv.slice(2);
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

if (!listPath || !progressPath) {
  console.error('usage: sweep-v4.mjs <sweep-list.json> <progress.json> [--limit N]');
  process.exit(2);
}

const list = JSON.parse(readFileSync(listPath, 'utf8'));
const done = existsSync(progressPath) ? JSON.parse(readFileSync(progressPath, 'utf8')) : { pairs: [] };
// Only a SUCCESSFUL pair counts as done. A failed one (dead dev server, rate limit, crash)
// must be retried on resume — recording it as done would silently drop it from the sweep
// and leave its cell carrying a stale verdict while the run reported full coverage.
const doneKeys = new Set(done.pairs.filter((p) => p.ok).map((p) => `${p.catalogId}||${p.step}`));

const pending = list.filter((p) => !doneKeys.has(`${p.catalogId}||${p.step}`));
console.log(`sweep: ${list.length} pairs total, ${doneKeys.size} already done, ${pending.length} pending`);

let ran = 0;
for (const p of pending) {
  if (ran >= LIMIT) {
    console.log(`\n--limit ${LIMIT} reached; ${pending.length - ran} pairs still pending. Re-run to continue.`);
    break;
  }
  const t0 = Date.now();
  // shell:true CONCATENATES an args array without quoting, so a step label containing a
  // space ("Concept Brief") silently became `--step Concept` + a stray `Brief` — judge-run
  // then matched no step, judged nothing, and exited 0 in 2s. The driver read that as
  // success. Build one properly quoted command string instead.
  const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
  const cmd = `npx tsx scripts/judge-run.ts --catalog ${q(p.catalogId)} --step ${q(p.step)} --median 3 --rejudge`;
  const r = spawnSync(cmd, { encoding: 'utf8', shell: true, timeout: 20 * 60 * 1000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // A run that judged nothing is NOT a success — treat it as a failure so it is retried
  // rather than silently dropped from the sweep.
  const judgedSomething = /\d+ judged/.test(out) && !/— 0 judged/.test(out);
  // judge-run prints one result line per entity; keep only those for the log.
  const verdicts = out.split('\n').filter((l) => /median-of-\d|\bPASS\b|\bFAIL\b|judged/i.test(l)).slice(0, 8);
  const secs = Math.round((Date.now() - t0) / 1000);
  const ok = r.status === 0 && judgedSomething;
  console.log(`[${ran + 1}/${pending.length}] ${p.catalogId} :: ${p.step} (${p.why}) ${ok ? 'ok' : 'EXIT ' + r.status} ${secs}s`);
  for (const v of verdicts) console.log(`      ${v.trim()}`);

  done.pairs.push({ ...p, ok, secs, at: new Date().toISOString(), tail: verdicts.join(' | ').slice(0, 400) });
  writeFileSync(progressPath, JSON.stringify(done, null, 1));
  ran += 1;

  // A non-zero exit that looks like a rate/session limit should stop the sweep cleanly
  // rather than burn the remaining pairs against a wall.
  if (!ok && /limit|rate|quota|429/i.test(out)) {
    console.log('\nSTOPPED: the judge CLI reported a rate/session limit. Progress saved; re-run to resume.');
    break;
  }
}
console.log(`\ndone this run: ${ran}; total recorded: ${done.pairs.length}/${list.length}`);
