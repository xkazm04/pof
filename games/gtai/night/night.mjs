#!/usr/bin/env node
/**
 * GTAI generic overnight lane runner, adapted from games/gtai/spike/spike.mjs. Lanes come from <root>/night.json; each
 * lane is a loop of fresh headless Claude sessions in its own cwd (a git worktree) until a deadline. A lane's memory
 * is its JOURNAL.md and git log. Builtins only.
 *
 *   node games/gtai/night/night.mjs init    [--root R]                       (re-runnable; never overwrites)
 *   node games/gtai/night/night.mjs run     [--root R] [--until 09:00] [--freeze 07:30] [--report-at 08:15]
 *                                           [--lanes a,b] [--iter-min 90] [--model claude-opus-5-5] [--effort high]
 *                                           [--model-<lane> <id>] [--billing api-first|api|subscription] [--dotenv F]
 *   node games/gtai/night/night.mjs status  [--root R]
 *   node games/gtai/night/night.mjs report  [--root R]                       (writes <root>/SCOREBOARD.md)
 *   node games/gtai/night/night.mjs billing [--root R] [--reset api|api2|api3|subscription|all]
 *   node games/gtai/night/night.mjs stop     [--root R] [--lane a,b] [--now]   (ends the night or the named lanes; --now kills own sessions)
 *   node games/gtai/night/night.mjs schedule [--root R] [--until 09:00] [--freeze 07:30] [--report-at 08:15]   (a running night re-reads it)
 *   node games/gtai/night/night.mjs status   [--root R] [--siblings R2,R3]     (flags a loop gone silent or a launch that never started)
 *   run also takes --reserve-min 90: in the last 90 min before the freeze a BUILD session leaves the last open billing path free
 *
 * Exit codes: 0 finished, 2 config error (the supervisor does not retry it), 130 interrupted.
 * Process rule (repo law): only PIDs this script spawned are ever killed (taskkill /T /PID <own child>).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { CONTROL_FILE, holdForReserve, lanesToKill, laneHealth, lastActivity, readControl, runnerStart, scheduleWith, stopRequested, writeControl } from './control.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_TEMPLATE, API_REPROBE_MIN, apiKeyFromText, backupKeyFromText, backupKey2FromText, buildPrompt, checkPaths, classifyFailure, createBilling, isApi, parseConfig, phaseAt, planTimes, queueEmpty, requestsFor, ts } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith('--')) continue;
  opts[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
}
const ROOT = path.resolve(String(opts.root ?? 'C:/Users/kazda/kiro/gtai-night'));
const CONFIG = path.join(ROOT, 'night.json');
const die = (m, code = 2) => { process.stderr.write(`night: ${m}\n`); process.exit(code); };
const readIf = (f) => (f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const laneLogs = (id) => path.join(ROOT, 'logs', id);
const stateFile = (id) => path.join(laneLogs(id), 'state.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const log = (line) => {
  const s = `[${new Date().toISOString()}] ${line}`;
  process.stdout.write(`${s}\n`);
  fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'logs', 'runner.log'), `${s}\n`);
};

function loadConfig() {
  if (!fs.existsSync(CONFIG)) die(`no ${CONFIG}: run init first`);
  const cfg = parseConfig(fs.readFileSync(CONFIG, 'utf8'), ROOT);
  if (cfg.errors.length) die(`${CONFIG} is invalid:\n  ${cfg.errors.join('\n  ')}`);
  return cfg;
}

// The repo's .env (pof/.env): the key line may be spelled ANTHROPIC_API_KEY or ANTRHOPIC_API_KEY. Never printed.
const REPO_ENV = path.resolve(HERE, '..', '..', '..', '.env');
const billing = createBilling({ file: path.join(ROOT, 'billing.json'), log });
function loadBilling(quiet = false) {
  billing.want = String(opts.billing ?? 'api-first');
  if (!['api-first', 'api', 'subscription'].includes(billing.want)) die(`--billing must be api-first|api|subscription`);
  const dotenv = readIf(String(opts.dotenv ?? REPO_ENV));
  billing.key = apiKeyFromText(dotenv);
  billing.key2 = backupKeyFromText(dotenv);
  billing.key3 = backupKey2FromText(dotenv);
  if (!quiet && billing.want !== 'subscription' && !billing.key && !billing.key2 && !billing.key3) log('billing: no ANTHROPIC_API_KEY / ANTRHOPIC_API_KEY / ANTHROPIC_API_KEY_BACKUP / ANTHROPIC_API_KEY_BACKUP_2 in .env - using the subscription');
  billing.pick();
}

// ---------------------------------------------------------------- init
function init() {
  for (const d of ['briefs', 'logs']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  const made = [];
  const seed = (f, body) => { if (!fs.existsSync(f)) { fs.writeFileSync(f, body); made.push(path.relative(ROOT, f)); } };
  seed(CONFIG, `${JSON.stringify(CONFIG_TEMPLATE, null, 2)}\n`);
  seed(path.join(ROOT, 'briefs', 'common.md'), '# Common rules for every night lane\n\n- Work only inside your lane cwd (a git worktree) and the --add-dir folders.\n- Commit as you go; never push.\n- Every claim in JOURNAL.md or REPORT.md names an evidence path or command.\n');
  seed(path.join(ROOT, 'billing.json'), `${JSON.stringify({ blocked: { api: 0, subscription: 0 }, reasons: {} }, null, 2)}\n`);
  process.stdout.write(`init: ${ROOT} (${made.length ? `created ${made.join(', ')}` : 'already initialised, nothing overwritten'})\n`);
}

// ---------------------------------------------------------------- run
const children = new Map(); // child process -> lane id, so `stop --lane x --now` kills only x's session
function killTree(p) {
  if (!p?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { windowsHide: true });
  else p.kill('SIGKILL');
}

function runClaude(lane, text, timeoutMs, n, mode) {
  return new Promise((resolve) => {
    const tag = String(n).padStart(3, '0');
    const errFile = path.join(laneLogs(lane.id), `iter-${tag}.err`);
    const out = fs.createWriteStream(path.join(laneLogs(lane.id), `iter-${tag}.jsonl`));
    const err = fs.createWriteStream(errFile);
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', lane.model, '--effort', lane.effort,
      '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local', '--strict-mcp-config',
      ...lane.addDirs.flatMap((d) => ['--add-dir', d])];
    const started = Date.now();
    const p = spawn('claude', args, { cwd: lane.cwd, windowsHide: true, env: billing.env({ ...process.env, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' }, mode) });
    children.set(p, lane.id);
    let tail = '', head = '', timedOut = false;
    p.stdout.on('data', (b) => { out.write(b); tail = (tail + b.toString()).slice(-200_000); if (head.length < 20_000) head += b.toString(); });
    p.stderr.on('data', (b) => err.write(b));
    p.stdin.on('error', () => {});
    p.stdin.end(text);
    const timer = setTimeout(() => { timedOut = true; killTree(p); }, timeoutMs);
    p.on('error', (e) => err.write(`spawn error: ${e.message}\n`));
    p.on('close', (code) => {
      clearTimeout(timer); children.delete(p);
      out.end(); err.end();
      let result = null;
      for (const line of tail.split('\n').reverse()) {
        if (!line.includes('"type":"result"')) continue;
        try { result = JSON.parse(line); break; } catch { /* partial line */ }
      }
      const errText = readIf(errFile);
      // The stream's system/init event names the credential the CLI actually used: proof of the billing mode.
      const keySource = (head.match(/"apiKeySource"\s*:\s*"([^"]*)"/) ?? [])[1] ?? null;
      const errSurface = `${result?.is_error ? result?.result ?? '' : ''}\n${errText}\n${tail.split('\n').filter((l) => /API Error|"type":"error"|"error":\{/.test(l)).join('\n').slice(-4000)}`;
      resolve({
        n, code, timedOut, wallS: Math.round((Date.now() - started) / 1000), billing: mode, keySource,
        costUsd: result?.total_cost_usd ?? null, turns: result?.num_turns ?? null, isError: result?.is_error ?? (code !== 0 && !timedOut),
        ...classifyFailure({ mode, timedOut, errSurface }),
      });
    });
  });
}

const CONTROL_PATH = path.join(ROOT, CONTROL_FILE);
const RESERVE_MIN = Number(opts['reserve-min'] ?? 90);

/** Re-reads control.json and moves `t` in place, so every lane sees a new schedule at its next step. */
function applyControl(t) {
  const control = readControl(CONTROL_PATH);
  const { t: next, changed, error } = scheduleWith(t, control);
  if (error) { log(`control: bad schedule ignored (${error})`); return control; }
  if (changed) {
    Object.assign(t, next);
    log(`control: schedule is now freeze ${ts(t.freeze)}, report ${ts(t.report)}, until ${ts(t.until)}`);
  }
  return control;
}

async function laneLoop(lane, t, texts) {
  const state = readJson(stateFile(lane.id), { lane: lane.id, iterations: [] });
  // A lane that already reported for this deadline is finished (a supervisor restart must not report twice).
  if (state.reportedFor === t.until.toISOString()) { log(`${lane.id}: already reported for this deadline`); return; }
  let n = state.iterations.length, fails = 0, quick = 0;
  while (Date.now() < t.until.getTime() - 3 * 60_000) {
    const control = applyControl(t);
    if (stopRequested(control, lane.id)) { log(`${lane.id}: stopped by control.json`); return; }
    const now = Date.now();
    const { phase, boundary } = phaseAt(now, t);
    const capAt = new Date(Math.min(now + lane.iterMin * 60_000, boundary));
    // Too little time left before the boundary to do useful work: wait for the next phase instead.
    if (boundary - now < 4 * 60_000 && phase !== 'REPORT') { await sleep(boundary - now); continue; }
    billing.sync();
    const open = billing.order().filter((x) => billing.usable(x) && billing.blocked[x] <= now);
    if (holdForReserve({ phase, nowMs: now, freezeMs: t.freeze.getTime(), reserveMin: RESERVE_MIN, open })) {
      log(`${lane.id}: reserve - only ${open[0]} is open and the freeze is ${Math.round((t.freeze.getTime() - now) / 60_000)} min off: holding it for the freeze and report sessions`);
      await sleep(Math.min(5 * 60_000, Math.max(1000, boundary - now)));
      continue;
    }
    const mode = billing.pick();
    if (!mode) {
      const w = Math.max(60_000, Math.min(15 * 60_000, billing.nextFree() - now));
      log(`${lane.id}: every billing path is blocked - waiting ${Math.round(w / 60_000)} min`);
      await sleep(w); continue;
    }
    n += 1;
    log(`${lane.id}: iteration ${n} ${phase} until ${ts(capAt)} [${mode}]`);
    const text = buildPrompt({ laneId: lane.id, n, phase, t, capAt, now: new Date(now), common: texts.common, brief: readIf(lane.brief), evidence: lane.evidence });
    let r;
    try { r = await runClaude(lane, text, capAt.getTime() - now, n, mode); }
    catch (e) { log(`${lane.id}: iteration ${n} could not start (${String(e?.message ?? e).slice(0, 160)}) - retrying in 2 min`); await sleep(2 * 60_000); continue; }
    state.iterations.push({ ...r, phase, start: new Date(now).toISOString() });
    fs.writeFileSync(stateFile(lane.id), JSON.stringify(state, null, 2));
    log(`${lane.id}: iteration ${n} [${r.billing}${r.keySource ? `/${r.keySource}` : ''}] ${r.timedOut ? 'stopped at cap' : `exit ${r.code}`} ${r.wallS}s${r.costUsd != null ? ` $${r.costUsd.toFixed(2)}` : ''}${r.limited ? ' USAGE-LIMIT' : ''}`);
    // Drained or limited mid-iteration: block that path, go straight on with the next free one. REPORT is retried.
    if (r.drained) { billing.block(r.billing, Date.now() + API_REPROBE_MIN * 60_000, r.drainReason ?? 'api error'); continue; }
    if (r.limited) { billing.block(r.billing, isApi(r.billing) ? Math.min(r.resetAt, Date.now() + API_REPROBE_MIN * 60_000) : r.resetAt, r.limitReason ?? 'usage limit'); continue; }
    if (phase === 'REPORT' && !r.isError) {
      state.reportedFor = t.until.toISOString();
      fs.writeFileSync(stateFile(lane.id), JSON.stringify(state, null, 2));
      break;
    }
    // QUEUE EMPTY: no more sessions in this phase unless the lane's journal moves or a sibling files a REQUEST for it.
    // The next phase's own session (freeze, report) still runs.
    if (!r.isError && queueEmpty(readIf(path.join(lane.cwd, 'JOURNAL.md')))) {
      const journal = () => readIf(path.join(lane.cwd, 'JOURNAL.md'));
      const siblings = () => (texts.lanes ?? []).filter((l) => l.id !== lane.id).map((l) => readIf(path.join(l.cwd, 'JOURNAL.md'))).join('\n');
      const seenJournal = journal(), seenRequests = requestsFor(lane.id, siblings());
      log(`${lane.id}: QUEUE EMPTY - paused until ${ts(new Date(boundary))} or a new REQUEST`);
      while (Date.now() < boundary && !stopRequested(readControl(CONTROL_PATH), lane.id) && journal() === seenJournal && requestsFor(lane.id, siblings()) === seenRequests) await sleep(Math.min(5 * 60_000, Math.max(1000, boundary - Date.now())));
      continue;
    }
    fails = r.isError && r.wallS < 120 ? fails + 1 : 0;
    if (fails >= 5) { log(`${lane.id}: 5 fast failures in a row - cooling down 10 min (read logs/${lane.id}/iter-*.err)`); await sleep(10 * 60_000); fails = 0; }
    // A lane that believes it is finished ends each session in under 3 min: back off, longer each time, capped at 30.
    quick = !r.isError && r.wallS < 180 ? quick + 1 : 0;
    if (quick >= 2) { const m = Math.min(30, 5 * (quick - 1)); log(`${lane.id}: ${quick} short sessions in a row - waiting ${m} min`); await sleep(Math.min(m * 60_000, boundary - Date.now())); continue; }
    await sleep(fails ? 2 * 60_000 : 20_000);
  }
  log(`${lane.id}: done (${n} iterations)`);
}

async function runAll() {
  const cfg = loadConfig();
  const want = opts.lanes && opts.lanes !== true ? String(opts.lanes).split(',').map((s) => s.trim()).filter(Boolean) : cfg.lanes.map((l) => l.id);
  for (const id of want) if (!cfg.lanes.some((l) => l.id === id)) die(`unknown lane "${id}" (night.json has: ${cfg.lanes.map((l) => l.id).join(', ') || 'none'})`);
  const picked = cfg.lanes.filter((l) => want.includes(l.id));
  if (!picked.length) die(`no lanes to run: add lanes to ${CONFIG}`);
  const missing = checkPaths({ common: cfg.common, lanes: picked });
  if (missing.length) die(`cannot start:\n  ${missing.join('\n  ')}`);
  let t;
  try { t = planTimes({ until: String(opts.until ?? '09:00'), freeze: String(opts.freeze ?? '07:30'), reportAt: String(opts['report-at'] ?? '08:15') }); }
  catch (e) { die(e.message); }
  const iterMin = Number(opts['iter-min'] ?? 90);
  if (!(iterMin >= 5)) die('--iter-min must be a number >= 5');
  const lanes = picked.map((l) => ({ ...l, model: String(opts[`model-${l.id}`] ?? l.model ?? opts.model ?? 'claude-opus-5-5'), effort: l.effort ?? String(opts.effort ?? 'high'), iterMin: l.iterMin ?? iterMin }));
  const texts = { common: readIf(cfg.common), lanes };
  for (const l of lanes) {
    fs.mkdirSync(laneLogs(l.id), { recursive: true });
    // Opt-in only: lane cwds are worktrees of a real repo, so the brief normally travels in the prompt.
    if (l.writeClaudeMd) fs.writeFileSync(path.join(l.cwd, 'CLAUDE.md'), `${readIf(l.brief)}\n\n---\n\n${texts.common}`);
  }
  loadBilling();
  log(`run: billing ${billing.order().filter((m) => billing.usable(m)).join(' -> ')} (now ${billing.pick() ?? 'all blocked'}) | lanes ${lanes.map((l) => `${l.id}:${l.model}@${l.effort}`).join(', ')} | freeze ${t.freeze.toLocaleString()} | report ${t.report.toLocaleString()} | deadline ${t.until.toLocaleString()}`);
  const stop = () => { log('interrupted - stopping own child sessions'); for (const c of children.keys()) killTree(c); process.exit(130); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // A lane must never take the night down with it: log and keep the other lanes running.
  process.on('uncaughtException', (e) => log(`runner: uncaught ${String(e?.stack ?? e).slice(0, 300)}`));
  process.on('unhandledRejection', (e) => log(`runner: unhandled ${String(e?.stack ?? e).slice(0, 300)}`));
  // `stop --now` kills this runner's own sessions; a plain stop lets the session in flight end.
  const nowPoll = setInterval(() => {
    const kill = new Set(lanesToKill(readControl(CONTROL_PATH), [...new Set(children.values())]));
    if (!kill.size) return;
    log(`control: stop --now - killing own sessions of ${[...kill].join(', ')}`);
    for (const [c, id] of children) if (kill.has(id)) killTree(c);
  }, 15_000);
  nowPoll.unref();
  // Stagger the starts so cold sessions do not hit the CLI and the disk in the same second.
  await Promise.all(lanes.map(async (l, i) => {
    await sleep(i * 45_000);
    // laneLoop is re-entered after an unexpected throw until the deadline; its state lives in logs/<id>/state.json.
    while (Date.now() < t.until.getTime() - 3 * 60_000) {
      try { await laneLoop(l, t, texts); return; } catch (e) { log(`${l.id}: lane loop threw (${String(e?.message ?? e).slice(0, 160)}) - restarting it in 1 min`); await sleep(60_000); }
    }
  }));
  clearInterval(nowPoll);
  log('run: all lanes finished - next: node games/gtai/night/night.mjs report');
}

// ---------------------------------------------------------------- status / report
const git = (cwd, args) => (fs.existsSync(cwd) ? (spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }).stdout ?? '').trim() : '');
function laneSummary(l) {
  const st = readJson(stateFile(l.id), { iterations: [] });
  const journal = readIf(path.join(l.cwd, 'JOURNAL.md'));
  return {
    l, st, last: st.iterations.at(-1), cost: st.iterations.reduce((s, i) => s + (i.costUsd ?? 0), 0),
    apiCost: st.iterations.filter((i) => isApi(i.billing)).reduce((s, i) => s + (i.costUsd ?? 0), 0),
    journalLast: journal.split('\n').map((x) => x.trim()).filter(Boolean).at(-1) ?? '(no JOURNAL.md yet)',
  };
}

/** One line per lane of `root` whose state a builder should worry about (healthy lanes print nothing). */
function healthLines(root, lanes, nowMs = Date.now()) {
  const { runnerStartMs, finished } = runnerStart(readIf(path.join(root, 'logs', 'runner.log')));
  return lanes.map((l) => {
    const dir = path.join(root, 'logs', l.id);
    const st = readJson(path.join(dir, 'state.json'), { iterations: [] });
    const h = laneHealth({ nowMs, runnerStartMs, finished, reported: Boolean(st.reportedFor), iterations: st.iterations.length, lastActivityMs: lastActivity(dir), quietMin: (l.iterMin ?? 90) + 15 });
    return { id: l.id, ...h };
  });
}

function printHealth(label, rows) {
  for (const r of rows) {
    if (['never-started', 'silent'].includes(r.state)) process.stdout.write(`   FLAG ${label}${r.id}: ${r.state.toUpperCase()}: ${r.why}\n`);
    else process.stdout.write(`   health ${label}${r.id}: ${r.state}\n`);
  }
}

function siblingsReport() {
  for (const raw of String(opts.siblings).split(',').map((x) => x.trim()).filter(Boolean)) {
    const root = path.resolve(raw);
    const file = path.join(root, 'night.json');
    if (!fs.existsSync(file)) { process.stdout.write(`\nFLAG sibling ${root}: NEVER-STARTED: no night.json\n`); continue; }
    const sib = parseConfig(fs.readFileSync(file, 'utf8'), root);
    process.stdout.write(`\nsibling ${root}\n`);
    printHealth('', healthLines(root, sib.lanes));
  }
}

function stopCmd() {
  const lanes = opts.lane && opts.lane !== true ? String(opts.lane).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const patch = { ...(lanes ? { stopLanes: lanes } : { stop: true }), now: opts.now === true };
  writeControl(CONTROL_PATH, patch);
  process.stdout.write(`stop written to ${CONTROL_PATH}: ${lanes ? lanes.join(', ') : 'the whole night'}${patch.now ? ' (own sessions are killed)' : ' (the session in flight ends first)'}\n`);
}

function scheduleCmd() {
  const patch = {};
  if (typeof opts.until === 'string') patch.until = opts.until;
  if (typeof opts.freeze === 'string') patch.freeze = opts.freeze;
  if (typeof opts['report-at'] === 'string') patch.reportAt = opts['report-at'];
  if (!Object.keys(patch).length) die('schedule needs --until, --freeze or --report-at');
  const t = { until: new Date(Date.now() + 24 * 3600_000), freeze: new Date(Date.now() + 2 * 3600_000), report: new Date(Date.now() + 3 * 3600_000) };
  const planned = scheduleWith(t, { ...readControl(CONTROL_PATH), ...patch });
  if (planned.error) die(planned.error);
  writeControl(CONTROL_PATH, patch);
  process.stdout.write(`schedule written to ${CONTROL_PATH}: a running night takes it at each lane's next step\n`);
}

function status() {
  const cfg = loadConfig();
  loadBilling(true);
  process.stdout.write(`night ${ROOT} | ${cfg.lanes.length} lane(s) | billing: ${billing.line()}\n`);
  if (!cfg.lanes.length) process.stdout.write(`(no lanes configured: add them to ${CONFIG})\n`);
  for (const l of cfg.lanes) {
    const s = laneSummary(l);
    const last = s.last ? `${s.last.phase} ${s.last.timedOut ? 'capped' : `exit ${s.last.code}`} via ${s.last.billing}${s.last.limited ? ' LIMIT' : ''}${s.last.drained ? ' DRAINED' : ''}` : 'none';
    process.stdout.write(`\n== ${l.id}: ${s.st.iterations.length} iteration(s), $${s.cost.toFixed(2)} (API key $${s.apiCost.toFixed(2)}) | last: ${last}${s.st.reportedFor ? ' | REPORTED' : ''}${fs.existsSync(l.cwd) ? '' : ' | CWD MISSING'}\n`);
    process.stdout.write(`   journal: ${s.journalLast.slice(0, 200)}\n   commit:  ${git(l.cwd, ['log', '-1', '--oneline']) || '(none)'}\n`);
    printHealth('', healthLines(ROOT, [l]));
  }
  if (opts.siblings && opts.siblings !== true) siblingsReport();
}

function report() {
  const cfg = loadConfig();
  const url = (p) => `file:///${p.replace(/\\/g, '/')}`;
  const link = (p, label) => (fs.existsSync(p) ? `[${label}](${url(p)})` : `${label} missing`);
  const lanes = cfg.lanes.map(laneSummary);
  const total = lanes.reduce((s, x) => s + x.cost, 0);
  const md = ['# GTAI night: scoreboard', '', `Generated ${new Date().toLocaleString()} from ${CONFIG}. Total CLI cost $${total.toFixed(2)}.`, '',
    '| lane | iterations | cost (API key) | last | report | evidence |', '|---|---|---|---|---|---|'];
  for (const s of lanes) {
    const last = s.last ? `${s.last.phase} ${s.last.timedOut ? 'capped' : `exit ${s.last.code}`}` : 'never ran';
    md.push(`| ${s.l.id} | ${s.st.iterations.length} | $${s.cost.toFixed(2)} ($${s.apiCost.toFixed(2)}) | ${last} | ${link(path.join(s.l.cwd, 'REPORT.md'), 'REPORT.md')} | ${link(path.join(s.l.cwd, s.l.evidence), `${s.l.evidence}/`)} |`);
  }
  for (const s of lanes) {
    const commits = git(s.l.cwd, ['log', '-10', '--oneline']);
    md.push('', `## ${s.l.id}`, '', `cwd \`${s.l.cwd}\``, '', `Last journal line: ${s.journalLast}`, '', '```', commits || '(no commits)', '```');
  }
  fs.writeFileSync(path.join(ROOT, 'SCOREBOARD.md'), `${md.join('\n')}\n`);
  process.stdout.write(`wrote ${path.join(ROOT, 'SCOREBOARD.md')}\n`);
}

// `billing [--reset api|api2|api3|subscription|all]`: show the paths; --reset unblocks one in a running night (re-read per pick).
function billingCmd() {
  loadBilling(true);
  const r = opts.reset === true ? 'all' : opts.reset;
  if (r) {
    for (const m of r === 'all' ? ['api', 'api2', 'api3', 'subscription'] : [String(r)]) { billing.blocked[m] = 0; delete billing.reasons[m]; }
    billing.save();
  }
  process.stdout.write(`billing: ${billing.line()}\n`);
  for (const [m, why] of Object.entries(billing.reasons)) process.stdout.write(`  last block on ${m}: ${why}\n`);
}

// ---------------------------------------------------------------- main
const cmds = { init, run: runAll, status, report, billing: billingCmd, stop: stopCmd, schedule: scheduleCmd };
if (!cmds[cmd]) die('usage: night.mjs init|run|status|report|billing|stop|schedule [--root R] [options] (see the header)');
await cmds[cmd]();
