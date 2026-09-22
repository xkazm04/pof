/* eslint-disable no-console -- CLI harness; stdout is its interface. */
/**
 * Delegate a task to codex-cli under Claude's oversight.
 *
 *   npx tsx scripts/codex/dispatch.ts run <task.json> [--timeout-min 30]
 *   npx tsx scripts/codex/dispatch.ts diff <id>
 *   npx tsx scripts/codex/dispatch.ts resume <id> "<follow-up instructions>"
 *   npx tsx scripts/codex/dispatch.ts land <id>          # apply to the main tree — does NOT commit
 *   npx tsx scripts/codex/dispatch.ts discard <id>
 *   npx tsx scripts/codex/dispatch.ts record <id> --verdict accepted|accepted-after-revision|rejected --class <taskClass> [--notes "…"]
 *   npx tsx scripts/codex/dispatch.ts stats | list
 *
 * A write task runs in its OWN git worktree (`<POF_CODEX_HOME>/wt/<id>`, branch `codex/<id>`) so
 * it can never touch the shared tree other sessions use; `node_modules` is a junction to the main
 * repo's so it can run tests. The overseer reads the diff, resumes with instructions or lands it,
 * and commits with a pathspec itself. Codex never commits (it is told so in every brief).
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { routeTask } from '../../src/lib/codex-exec/routing';
import { buildCodexExecArgs, buildCodexResumeArgs, PROMPT_FROM_STDIN } from '../../src/lib/codex-exec/args';
import { parseCodexEvents } from '../../src/lib/codex-exec/events';
import { CODEX_REPORT_SCHEMA, renderBrief, type CodexTask } from '../../src/lib/codex-exec/brief';
import { parseLedger, summarizeLedger, type CodexVerdict, type LedgerEntry } from '../../src/lib/codex-exec/ledger';

const REPO = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const HOME = process.env.POF_CODEX_HOME ?? resolve(REPO, '..', 'pof-codex');
const LEDGER = process.env.POF_CODEX_LEDGER ?? 'C:/Users/kazda/Documents/Obsidian/pof/Diablo/Codex/ledger.jsonl';
const CODEX_JS = process.env.POF_CODEX_JS ?? 'C:/nvm4w/nodejs/node_modules/@openai/codex/bin/codex.js';

const runDir = (id: string) => join(HOME, 'runs', id);
const wtDir = (id: string) => join(HOME, 'wt', id);
const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });

interface RunState {
  task: CodexTask; model: string; effort: string; cwd: string; threadId: string | null;
  rounds: number; secs: number; outputTokens: number; status: string;
  /** PID of the current round's child — lets `list` notice a run whose host died mid-flight. */
  pid?: number;
}
const loadState = (id: string): RunState => JSON.parse(readFileSync(join(runDir(id), 'state.json'), 'utf8')) as RunState;
const saveState = (id: string, s: RunState) => writeFileSync(join(runDir(id), 'state.json'), JSON.stringify(s, null, 2));

/** How a run ended — never collapsed into "succeeded" (registry: subprocess-lifecycle). */
interface RunEnd { code: number; ended: 'exited' | 'timeout' | 'stalled'; rung?: 'polite' | 'forced' }

/**
 * Minutes of event SILENCE before a run counts as stalled. The `--json` stream carries no
 * reasoning events (verified on cx-001's stream: only messages, commands and file changes), so a
 * long high-effort composition is silent until its final message — a flat 10 min would kill a
 * working xhigh run. Tolerance therefore scales with the reasoning effort.
 */
function stallMinutes(effort: string): number {
  const env = process.env.POF_CODEX_STALL_MIN;
  if (env) return Number(env);
  return effort === 'low' || effort === 'medium' ? 10 : effort === 'high' ? 25 : 40;
}

/**
 * Kill THIS child's process TREE — `child.kill()` on Windows ends only the node wrapper and
 * orphans codex's native binary and the shells it spawned. Scoped to our own PID (`/T`), never
 * a broad kill by image name. Ladder: polite (`taskkill /T`) → forced (`/T /F`) after 15 s.
 */
function reapTree(pid: number, onRung: (r: 'polite' | 'forced') => void) {
  onRung('polite');
  spawnSync('taskkill', ['/PID', String(pid), '/T'], { encoding: 'utf8' });
  setTimeout(() => {
    const alive = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' }).stdout.includes(String(pid));
    if (alive) { onRung('forced'); spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { encoding: 'utf8' }); }
  }, 15_000).unref();
}

/**
 * Spawn codex (node + codex.js, no shell) with the prompt on stdin; stream events to a file.
 * Liveness is THIS run's event activity: no output for STALL_MIN minutes is `stalled`, distinct
 * from the wall-clock `timeout`.
 */
function runCodex(args: string[], cwd: string, prompt: string, eventsPath: string, timeoutMin: number, stallMin: number, onPid: (pid: number) => void): Promise<RunEnd> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [CODEX_JS, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    if (child.pid) onPid(child.pid);
    let ended: RunEnd['ended'] = 'exited';
    let rung: RunEnd['rung'];
    let last = Date.now();
    const stop = (why: RunEnd['ended']) => {
      if (ended !== 'exited' || !child.pid) return;
      ended = why;
      console.error(`${why} — reaping codex process tree ${child.pid}`);
      reapTree(child.pid, (r) => { rung = r; });
    };
    const wall = setTimeout(() => stop('timeout'), timeoutMin * 60_000);
    const watch = setInterval(() => { if (Date.now() - last > stallMin * 60_000) stop('stalled'); }, 30_000);
    child.stdout.on('data', (d) => { last = Date.now(); appendFileSync(eventsPath, d); });
    child.stderr.on('data', (d) => appendFileSync(`${eventsPath}.stderr`, d));
    child.stdin.end(prompt); // closes stdin: exec never waits for EOF (trap 1)
    child.on('close', (code) => { clearTimeout(wall); clearInterval(watch); done({ code: code ?? -1, ended, rung }); });
  });
}

function changes(cwd: string): string[] {
  return git(cwd, 'status', '--porcelain').stdout.split('\n').filter(Boolean);
}

function report(id: string, eventsPath: string, lastPath: string, secs: number, end: RunEnd) {
  const s = parseCodexEvents(existsSync(eventsPath) ? readFileSync(eventsPath, 'utf8') : '');
  const st = loadState(id);
  const last = existsSync(lastPath) ? readFileSync(lastPath, 'utf8') : '';
  st.threadId = s.threadId ?? st.threadId;
  st.secs += secs;
  st.outputTokens += s.usage?.outputTokens ?? 0;
  st.status = s.completed ? 'awaiting-review' : end.ended === 'exited' ? 'incomplete' : `${end.ended}${end.rung ? ` (${end.rung} kill)` : ''}`;
  st.pid = undefined;
  saveState(id, st);
  console.log(`\n=== ${id} · ${st.model}/${st.effort} · round ${st.rounds} · ${secs}s · ${s.completed ? 'completed' : 'NOT COMPLETED'} ===`);
  console.log(`commands: ${s.commands.length} (${s.failedCommands.length} failed) · tokens out ${s.usage?.outputTokens ?? '?'}`);
  for (const c of s.failedCommands) console.log(`  failed: exit ${c.exitCode} · ${c.command.slice(-100)}`);
  for (const e of s.errors) console.log(`  ERROR: ${e}`);
  if (st.task.access === 'write-verified') console.log(`worktree changes:\n  ${changes(st.cwd).join('\n  ') || '(none)'}`);
  console.log(`report:\n${last || '(no final message)'}`);
}

async function run(taskPath: string, timeoutMin: number) {
  const task = JSON.parse(readFileSync(taskPath, 'utf8')) as CodexTask;
  const dir = runDir(task.id);
  if (existsSync(dir)) throw new Error(`run ${task.id} already exists — discard it or pick a new id`);
  mkdirSync(dir, { recursive: true });
  const route = routeTask(task.tier, task.hints);
  let cwd = REPO;
  if (task.access === 'write-verified') {
    cwd = wtDir(task.id);
    const add = git(REPO, 'worktree', 'add', '-b', `codex/${task.id}`, cwd, 'HEAD');
    if (add.status !== 0) throw new Error(`worktree add failed: ${add.stderr}`);
    const j = spawnSync('cmd', ['/c', 'mklink', '/J', join(cwd, 'node_modules'), join(REPO, 'node_modules')], { encoding: 'utf8' });
    if (j.status !== 0) throw new Error(`node_modules junction failed: ${j.stderr || j.stdout}`);
    // Gitignored GENERATED files are absent from a fresh worktree, and typecheck needs them
    // (cx-001 had to discover this and run the generator itself).
    const gen = spawnSync(process.execPath, ['scripts/gen-pipeline-registry.mjs'], { cwd, encoding: 'utf8' });
    if (gen.status !== 0) throw new Error(`gen:pipelines failed in the worktree: ${gen.stderr || gen.stdout}`);
  }
  const brief = renderBrief(task);
  writeFileSync(join(dir, 'brief.md'), brief);
  writeFileSync(join(dir, 'schema.json'), JSON.stringify(task.outputSchema ?? CODEX_REPORT_SCHEMA));
  saveState(task.id, { task, model: route.model, effort: route.effort, cwd, threadId: null, rounds: 1, secs: 0, outputTokens: 0, status: 'running' });
  const last = join(dir, 'report-1.json');
  const args = buildCodexExecArgs({
    route, access: task.access, prompt: PROMPT_FROM_STDIN, cwd, lastMessagePath: last,
    outputSchemaPath: join(dir, 'schema.json'), images: task.images?.map((p) => resolve(REPO, p)),
    // Never ephemeral: a run the watchdog had to stop must stay resumable, read-only or not.
    ephemeral: false,
  });
  console.log(`dispatching ${task.id} → ${route.model} (${route.effort}, ${route.why}) in ${cwd}`);
  const t0 = Date.now();
  const end = await runCodex(args, cwd, brief, join(dir, 'events-1.jsonl'), timeoutMin, stallMinutes(route.effort), (pid) => { const st = loadState(task.id); st.pid = pid; saveState(task.id, st); });
  if (end.code !== 0) console.error(`codex exited ${end.code} (${end.ended})`);
  report(task.id, join(dir, 'events-1.jsonl'), last, Math.round((Date.now() - t0) / 1000), end);
}

async function resume(id: string, instructions: string, timeoutMin: number) {
  const st = loadState(id);
  if (!st.threadId) throw new Error(`${id} has no session id (read-only runs are ephemeral and cannot be resumed)`);
  st.rounds += 1; saveState(id, st);
  const n = st.rounds;
  const last = join(runDir(id), `report-${n}.json`);
  // `exec resume` accepts no `--approve-for-me` (its only escalation flag is the sandbox bypass,
  // never used), so a follow-up round cannot start vitest on Windows (`spawn EPERM`). cx-003's
  // round 2 spent 4 attempts learning that; say it up front — the overseer runs the tests.
  const prompt = `Reviewer follow-up (round ${n}). Apply it and report again with the same JSON schema.\n`
    + 'NOTE: in a follow-up round the sandbox cannot start test runners (spawn EPERM; no escalation is available). '
    + 'Do not retry them: report each test command as not run; the reviewer runs them. Typecheck and eslint still work.\n\n'
    + instructions;
  const t0 = Date.now();
  const end = await runCodex(buildCodexResumeArgs({ threadId: st.threadId, prompt: PROMPT_FROM_STDIN, lastMessagePath: last, outputSchemaPath: join(runDir(id), 'schema.json') }), st.cwd, prompt, join(runDir(id), `events-${n}.jsonl`), timeoutMin, stallMinutes(st.effort), (pid) => { const s2 = loadState(id); s2.pid = pid; saveState(id, s2); });
  report(id, join(runDir(id), `events-${n}.jsonl`), last, Math.round((Date.now() - t0) / 1000), end);
}

function diff(id: string) {
  const { cwd } = loadState(id);
  git(cwd, 'add', '-A', '--', '.', ':!node_modules');
  process.stdout.write(git(cwd, 'diff', '--cached', '--stat').stdout + '\n' + git(cwd, 'diff', '--cached').stdout);
}

function land(id: string) {
  const { cwd, task } = loadState(id);
  git(cwd, 'add', '-A', '--', '.', ':!node_modules');
  const files = git(cwd, 'diff', '--cached', '--name-only').stdout.split('\n').filter(Boolean);
  if (!files.length) { console.log('nothing to land'); return; }
  // Refuse to land onto another session's live WIP in the shared tree.
  const busy = git(REPO, 'status', '--porcelain', '--', ...files).stdout.split('\n').filter(Boolean);
  if (busy.length) throw new Error(`main tree has uncommitted changes in files this patch touches — resolve first:\n  ${busy.join('\n  ')}`);
  const patch = git(cwd, 'diff', '--cached', '--binary').stdout;
  const patchPath = join(runDir(id), 'land.patch');
  writeFileSync(patchPath, patch);
  // Working tree ONLY: `--3way` would stage into the SHARED index, where another session's bare
  // `git commit` sweeps it up (repo law since 906783b6). The overseer stages with a pathspec.
  const ap = git(REPO, 'apply', patchPath);
  if (ap.status !== 0) throw new Error(`git apply failed:\n${ap.stderr}`);
  console.log(`landed ${files.length} file(s) from ${id} into the main tree (NOT committed):\n  ${files.join('\n  ')}`);
  console.log(`commit with a pathspec, e.g.: git commit -m "…" -- ${files.join(' ')}`);
  if (task.scope.length) {
    const outside = files.filter((f) => !task.scope.some((s) => f === s || f.startsWith(s.replace(/\/?$/, '/'))));
    if (outside.length) console.log(`WARNING: outside the brief's scope: ${outside.join(', ')}`);
  }
}

function discard(id: string) {
  const st = loadState(id);
  if (st.task.access === 'write-verified' && existsSync(st.cwd)) {
    // rmdir removes the JUNCTION only; a recursive delete would follow it into the real node_modules.
    const nm = join(st.cwd, 'node_modules');
    if (existsSync(nm)) spawnSync('cmd', ['/c', 'rmdir', nm]);
    git(REPO, 'worktree', 'remove', '--force', st.cwd);
    git(REPO, 'branch', '-D', `codex/${id}`);
  }
  st.status = 'discarded'; saveState(id, st);
  console.log(`discarded ${id} (run records kept in ${runDir(id)})`);
}

function record(id: string, verdict: CodexVerdict, taskClass: string, notes: string) {
  const st = loadState(id);
  const entry: LedgerEntry = {
    id, at: new Date().toISOString(), tier: st.task.tier, taskClass, model: st.model, effort: st.effort,
    verdict, rounds: st.rounds, secs: st.secs, outputTokens: st.outputTokens, notes,
  };
  mkdirSync(dirname(LEDGER), { recursive: true });
  appendFileSync(LEDGER, JSON.stringify(entry) + '\n');
  console.log(`ledger ← ${id}: ${verdict} after ${st.rounds} round(s)`);
}

function stats() {
  const entries = existsSync(LEDGER) ? parseLedger(readFileSync(LEDGER, 'utf8')) : [];
  console.log(`${entries.length} delegated task(s)\n`);
  for (const s of summarizeLedger(entries)) {
    console.log(`${s.key.padEnd(52)} n=${s.n}  first-pass ${(s.firstPass * 100).toFixed(0)}%  accepted ${(s.accepted * 100).toFixed(0)}%  rounds ${s.meanRounds.toFixed(1)}`);
  }
}

function list() {
  const root = join(HOME, 'runs');
  for (const id of existsSync(root) ? readdirSync(root) : []) {
    const s = loadState(id);
    // A run still marked running whose child PID is gone: the dispatcher itself died mid-flight.
    const orphaned = s.status === 'running' && s.pid
      && !spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8' }).stdout.includes(String(s.pid));
    console.log(`${id.padEnd(28)} ${(orphaned ? 'HOST DIED?' : s.status).padEnd(16)} ${s.model}/${s.effort} rounds=${s.rounds} ${s.task.title}`);
  }
}

const [cmd, a1, a2] = process.argv.slice(2);
const opt = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const timeoutMin = Number(opt('timeout-min') ?? 30);
(async () => {
  switch (cmd) {
    case 'run': return run(a1, timeoutMin);
    case 'resume': return resume(a1, a2, timeoutMin);
    case 'diff': return diff(a1);
    case 'land': return land(a1);
    case 'discard': return discard(a1);
    case 'record': return record(a1, opt('verdict') as CodexVerdict, opt('class') ?? 'unclassified', opt('notes') ?? '');
    case 'stats': return stats();
    case 'list': return list();
    default: console.error('usage: dispatch.ts run|resume|diff|land|discard|record|stats|list …'); process.exit(2);
  }
})().catch((e: unknown) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
