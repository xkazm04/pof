#!/usr/bin/env node
/* eslint-disable no-console -- a terminal CLI outside src/: stdout is its interface (repo law allows console here). */
// night.mjs - an unattended build lane for one quest in the GTAI game repo (kiro/gtai), modelled on spike.mjs.
//
//   node games/gtai/quest/night.mjs run --lane <dir> --repo <gtai repo> --worktree <dir> --branch <name>
//        [--until 08:00] [--gate-path project/features/quest] [--gate-until 03:00]
//        [--model claude-opus-5-5] [--effort high] [--iter-min 90] [--billing api-first|api|subscription]
//   node games/gtai/quest/night.mjs status --lane <dir>
//
// The lane is a loop of fresh headless Claude sessions, cwd = the lane's own worktree. Its memory is
// <lane>/JOURNAL.md plus the branch's git log; its instructions are <lane>/BRIEF.md. It stops at --until, or
// when the lane writes <lane>/DONE.md. Gate: it waits until --gate-path exists on the repo's main (a sibling
// lane's port must land first), then branches the worktree from main; past --gate-until it stops as BLOCKED.
// Billing (owner rule): the .env Anthropic key first, then the subscription when the key is drained or refused.
// Process rule: only PIDs this script spawned are ever killed (taskkill /T /F /PID <own child>).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POF = path.resolve(HERE, '..', '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const die = (m) => { console.error(`night: ${m}`); process.exit(2); };
const now = () => new Date();
const stamp = () => now().toISOString();

function at(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = now(); d.setHours(h, m, 0, 0);
  if (d <= now()) d.setDate(d.getDate() + 1);
  return d;
}

function apiKey() {
  const f = path.join(POF, '.env');
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(/^\s*(?:ANTHROPIC_API_KEY|ANTRHOPIC_API_KEY)\s*=\s*"?([^"\r\n]+)"?/m);
  return m ? m[1].trim() : null;
}
const API_FAIL = /credit balance is too low|reached your specified API usage limits|invalid x-api-key|authentication_error|insufficient.*credit/i;

function sh(cmd, args, cwd) { return spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true }); }

function writeStatus(lane, s) { fs.writeFileSync(path.join(lane, 'status.json'), `${JSON.stringify({ ...s, updated: stamp() }, null, 2)}\n`); }
function log(lane, line) { const l = `[${stamp()}] ${line}`; console.log(l); fs.appendFileSync(path.join(lane, 'runner.log'), `${l}\n`); }

function runIteration({ lane, worktree, model, effort, iterMs, mode, key, n }) {
  return new Promise((resolve) => {
    const prompt = `You are the GTAI night build lane, iteration ${n}. Your instructions are ${path.join(lane, 'BRIEF.md')}; ` +
      `your memory is ${path.join(lane, 'JOURNAL.md')} and the git log of this branch. Read both first, then continue the work. ` +
      `Before you stop, append to JOURNAL.md: what you did, the evidence (paths), and the next step. ` +
      `When every done-criterion in the brief is met WITH evidence, write ${path.join(lane, 'DONE.md')} (first line DONE, then the evidence list).`;
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', model, '--effort', effort,
      '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local', '--strict-mcp-config'];
    const env = { ...process.env, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' };
    delete env.ANTHROPIC_API_KEY;
    if (mode === 'api' && key) env.ANTHROPIC_API_KEY = key;
    const out = fs.createWriteStream(path.join(lane, 'logs', `iter-${String(n).padStart(3, '0')}.jsonl`));
    const p = spawn('claude', args, { cwd: worktree, windowsHide: true, env, shell: process.platform === 'win32' });
    let tail = '';
    p.stdout.on('data', (d) => { out.write(d); tail = (tail + d.toString()).slice(-200_000); });
    p.stderr.on('data', (d) => { out.write(d); tail = (tail + d.toString()).slice(-200_000); });
    p.stdin.end(prompt);
    const timer = setTimeout(() => { if (process.platform === 'win32') sh('taskkill', ['/T', '/F', '/PID', String(p.pid)]); else p.kill('SIGKILL'); }, iterMs);
    p.on('close', (code) => {
      clearTimeout(timer); out.end();
      let result = null;
      for (const line of tail.split('\n').reverse()) { try { const j = JSON.parse(line); if (j.type === 'result') { result = j; break; } } catch { /* not json */ } }
      resolve({ code, result, apiFail: API_FAIL.test(tail) });
    });
  });
}

async function run() {
  const lane = path.resolve(opt('lane') ?? die('--lane is required'));
  const repo = path.resolve(opt('repo') ?? die('--repo is required'));
  const worktree = path.resolve(opt('worktree') ?? die('--worktree is required'));
  const branch = opt('branch') ?? die('--branch is required');
  const until = at(opt('until', '08:00'));
  const gatePath = opt('gate-path');
  const gateUntil = at(opt('gate-until', '03:00'));
  const model = opt('model', 'claude-opus-5-5');
  const effort = opt('effort', 'high');
  const iterMs = Number(opt('iter-min', '90')) * 60_000;
  let mode = opt('billing', 'api-first') === 'subscription' ? 'subscription' : 'api';
  const key = apiKey();
  if (mode === 'api' && !key) mode = 'subscription';
  if (!fs.existsSync(path.join(lane, 'BRIEF.md'))) die(`${lane} has no BRIEF.md`);
  fs.mkdirSync(path.join(lane, 'logs'), { recursive: true });
  if (!fs.existsSync(path.join(lane, 'JOURNAL.md'))) fs.writeFileSync(path.join(lane, 'JOURNAL.md'), '# Night lane journal\n');
  const st = { state: 'starting', pid: process.pid, until: until.toISOString(), mode, iterations: 0, costUsd: 0, last: null };
  writeStatus(lane, st);
  log(lane, `start: lane ${lane}, until ${until.toLocaleTimeString()}, billing ${mode}, model ${model}@${effort}`);

  // Gate: a sibling lane's port must be on main first.
  if (gatePath) {
    st.state = 'waiting-gate'; writeStatus(lane, st);
    for (;;) {
      sh('git', ['-C', repo, 'fetch', '-q'], repo);
      const hit = sh('git', ['-C', repo, 'ls-tree', '-d', 'main', gatePath], repo).stdout.trim();
      if (hit) { log(lane, `gate open: ${gatePath} is on main`); break; }
      if (now() >= gateUntil) { st.state = 'BLOCKED'; st.last = `gate ${gatePath} not on main by ${gateUntil.toLocaleTimeString()}`; writeStatus(lane, st); log(lane, st.last); return; }
      await new Promise((r) => setTimeout(r, 5 * 60_000));
    }
  }
  if (!fs.existsSync(worktree)) {
    const r = sh('git', ['-C', repo, 'worktree', 'add', worktree, '-b', branch, 'main'], repo);
    if (r.status !== 0) { st.state = 'BLOCKED'; st.last = `worktree add failed: ${r.stderr.trim()}`; writeStatus(lane, st); log(lane, st.last); return; }
    log(lane, `worktree ${worktree} on new branch ${branch} from main`);
  }

  st.state = 'running';
  while (now() < until && !fs.existsSync(path.join(lane, 'DONE.md'))) {
    st.iterations += 1; writeStatus(lane, st);
    const t0 = Date.now();
    const remaining = until - now();
    const r = await runIteration({ lane, worktree, model, effort, iterMs: Math.min(iterMs, remaining), mode, key, n: st.iterations });
    const wall = Math.round((Date.now() - t0) / 1000);
    const cost = r.result?.total_cost_usd ?? 0;
    st.costUsd = Math.round((st.costUsd + cost) * 100) / 100;
    st.last = `iter ${st.iterations}: exit ${r.code}, ${wall}s, $${cost.toFixed(2)}, ${r.result?.is_error ? 'ERROR ' : ''}${String(r.result?.result ?? '').slice(0, 300)}`;
    log(lane, st.last);
    if (mode === 'api' && (r.apiFail || r.result?.is_error && API_FAIL.test(String(r.result?.result)))) {
      mode = 'subscription'; st.mode = mode;
      log(lane, 'billing: API key drained or refused, switching to the subscription');
    }
    writeStatus(lane, st);
    // A lane that ends almost at once is idle or failing: back off instead of burning sessions.
    if (wall < 120) await new Promise((res) => setTimeout(res, 5 * 60_000));
  }
  st.state = fs.existsSync(path.join(lane, 'DONE.md')) ? 'DONE' : 'deadline';
  writeStatus(lane, st);
  log(lane, `end: ${st.state}, ${st.iterations} iterations, $${st.costUsd}`);
}

function status() {
  const lane = path.resolve(opt('lane') ?? die('--lane is required'));
  const f = path.join(lane, 'status.json');
  if (!fs.existsSync(f)) die(`no status at ${f}`);
  console.log(fs.readFileSync(f, 'utf8'));
  const j = path.join(lane, 'JOURNAL.md');
  if (fs.existsSync(j)) console.log(fs.readFileSync(j, 'utf8').split('\n').slice(-25).join('\n'));
}

const cmd = argv[0];
if (cmd === 'run') run();
else if (cmd === 'status') status();
else die('usage: night.mjs run|status --lane <dir> ...');
