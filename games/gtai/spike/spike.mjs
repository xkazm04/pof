#!/usr/bin/env node
/**
 * GTAI overnight engine spike: one Claude CLI agent per lane (UE 5.8, Godot 4, Unity 6, plus a shared art lane),
 * each looping in fresh headless sessions until a deadline. A lane's memory is its own JOURNAL.md and git log.
 * Builtins only.
 *
 *   node games/gtai/spike/spike.mjs init      [--root R] --style <art-direction variant dir>
 *   node games/gtai/spike/spike.mjs preflight [--root R] [--fetch-godot] [--smoke]
 *   node games/gtai/spike/spike.mjs run       [--root R] [--until 08:00] [--lanes ue,godot,unity,art]
 *                                             [--model claude-opus-5-5] [--effort high] [--iter-min 100]
 *                                             [--freeze HH:MM] [--report-at HH:MM] [--model-<lane> <id>]
 *   node games/gtai/spike/spike.mjs status    [--root R]
 *   node games/gtai/spike/spike.mjs report    [--root R]
 *
 * Process rule (repo law): only PIDs this script spawned are ever killed (taskkill /T /PID <own child>).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIEF = path.join(HERE, 'brief');
const ALL_LANES = ['ue', 'godot', 'unity', 'art'];
const UE_ROOT = 'C:/Program Files/Epic Games/UE_5.8';
const UNITY_EXE = 'C:/Program Files/Unity/Hub/Editor/6000.6.4f1/Editor/Unity.exe';
const BLENDER_EXE = 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe';
const GODOT_TAG_DEFAULT = '4.7.2-stable';

// ---------------------------------------------------------------- args
const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  opts[k] = v;
}
const ROOT = path.resolve(String(opts.root ?? 'C:/Users/kazda/kiro/gtai-spike'));
const die = (m) => { process.stderr.write(`spike: ${m}\n`); process.exit(1); };
const ts = (d = new Date()) => d.toTimeString().slice(0, 5);
const laneDir = (l) => path.join(ROOT, 'lanes', l);
const readIf = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const log = (line) => {
  const s = `[${new Date().toISOString()}] ${line}`;
  process.stdout.write(`${s}\n`);
  fs.mkdirSync(ROOT, { recursive: true });
  fs.appendFileSync(path.join(ROOT, 'runner.log'), `${s}\n`);
};

// ---------------------------------------------------------------- init
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function init() {
  const style = opts.style && opts.style !== true ? path.resolve(String(opts.style)) : null;
  if (!style || !fs.existsSync(path.join(style, 'DESIGN.md'))) die('--style <dir containing DESIGN.md> is required (an art-direction variant)');
  for (const d of ['shared/style', 'shared/assets', 'tools']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  copyDir(style, path.join(ROOT, 'shared', 'style'));
  const common = fs.readFileSync(path.join(BRIEF, 'common.md'), 'utf8');
  const mvp = fs.readFileSync(path.join(BRIEF, 'mvp-duel.md'), 'utf8');
  for (const l of ALL_LANES) {
    const dir = laneDir(l);
    for (const d of ['evidence/autoplay', 'logs']) fs.mkdirSync(path.join(dir, d), { recursive: true });
    const lane = fs.readFileSync(path.join(BRIEF, `lane-${l}.md`), 'utf8');
    // CLAUDE.md is loaded by every headless session (--setting-sources project,local), so the brief is always present.
    fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `${lane}\n\n---\n\n${common}`);
    fs.writeFileSync(path.join(dir, 'MVP.md'), mvp);
  }
  fs.writeFileSync(path.join(ROOT, 'spike.json'), JSON.stringify({ created: new Date().toISOString(), style, lanes: ALL_LANES }, null, 2));
  log(`init: ${ROOT} (style ${style})`);
}

// ---------------------------------------------------------------- preflight
function run1(file, args, timeoutMs = 60_000) {
  const r = spawnSync(file, args, { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, err: r.error };
}

function godotPaths() {
  const dir = path.join(ROOT, 'tools', 'godot');
  const exe = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^Godot_v.*_win64\.exe$/.test(f)) : null;
  return { dir, exe: exe ? path.join(dir, exe) : null };
}

function fetchGodot() {
  const tag = String(opts['godot-tag'] ?? GODOT_TAG_DEFAULT);
  const { dir } = godotPaths();
  fs.mkdirSync(dir, { recursive: true });
  const base = `https://github.com/godotengine/godot/releases/download/${tag}`;
  const zip = path.join(dir, `Godot_v${tag}_win64.exe.zip`);
  const tpz = path.join(dir, `Godot_v${tag}_export_templates.tpz`);
  for (const [url, out] of [[`${base}/Godot_v${tag}_win64.exe.zip`, zip], [`${base}/Godot_v${tag}_export_templates.tpz`, tpz]]) {
    if (fs.existsSync(out)) continue;
    log(`download ${url}`);
    const r = run1('curl', ['-fL', '-o', out, url], 30 * 60_000);
    if (r.code !== 0) die(`download failed: ${url}\n${r.out}`);
  }
  run1('tar', ['-xf', zip, '-C', dir], 5 * 60_000);
  // Export templates install to %APPDATA%/Godot/export_templates/<x.y.z.stable>/ (the tpz holds templates/*).
  const ver = tag.replace(/-/g, '.');
  const tdir = path.join(process.env.APPDATA ?? '', 'Godot', 'export_templates', ver);
  if (!fs.existsSync(path.join(tdir, 'version.txt'))) {
    const tmp = path.join(dir, 'tpl-extract');
    fs.mkdirSync(tmp, { recursive: true });
    const r = run1('tar', ['-xf', tpz, '-C', tmp], 15 * 60_000);
    if (r.code !== 0) die(`template extract failed\n${r.out}`);
    copyDir(path.join(tmp, 'templates'), tdir);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  log(`godot ${tag} ready in ${dir}; templates in ${tdir}`);
}

function preflight() {
  if (opts['fetch-godot']) fetchGodot();
  const rows = [];
  const check = (name, ok, detail, fix = '') => rows.push({ name, ok, detail, fix });

  const cl = run1('claude', ['--version']);
  check('claude CLI', cl.code === 0, cl.out.trim().split('\n')[0] ?? '', 'install Claude Code');
  if (opts.smoke) {
    const s = spawnSync('claude', ['-p', '--model', String(opts.model ?? 'claude-opus-5-5'), '--output-format', 'json',
      '--setting-sources', 'project,local', '--strict-mcp-config'], { input: 'Reply with the single word OK.', encoding: 'utf8', timeout: 180_000, windowsHide: true });
    check('claude smoke (model + usage)', /\bOK\b/.test(s.stdout ?? ''), (s.stdout ?? s.stderr ?? '').slice(0, 160).replace(/\s+/g, ' '), 'check the model id and remaining usage');
  }
  for (const f of ['Engine/Binaries/Win64/UnrealEditor.exe', 'Engine/Build/BatchFiles/Build.bat', 'Engine/Build/BatchFiles/RunUAT.bat', 'Engine/Plugins/2D/Paper2D/Paper2D.uplugin']) {
    check(`UE 5.8 ${path.basename(f)}`, fs.existsSync(path.join(UE_ROOT, f)), path.join(UE_ROOT, f));
  }
  const g = godotPaths();
  check('Godot editor', !!g.exe, g.exe ?? `${g.dir} (empty)`, 'rerun preflight with --fetch-godot');
  const ver = String(opts['godot-tag'] ?? GODOT_TAG_DEFAULT).replace(/-/g, '.');
  const tdir = path.join(process.env.APPDATA ?? '', 'Godot', 'export_templates', ver);
  check('Godot export templates', fs.existsSync(path.join(tdir, 'version.txt')), tdir, 'rerun preflight with --fetch-godot');

  if (fs.existsSync(UNITY_EXE)) {
    const lf = path.join(ROOT, 'tools', 'unity-licence-probe.log');
    fs.mkdirSync(path.dirname(lf), { recursive: true });
    const u = run1(UNITY_EXE, ['-batchmode', '-quit', '-nographics', '-logFile', lf], 240_000);
    const text = readIf(lf);
    const bad = u.code !== 0 || /No valid Unity Editor license|Access token is unavailable|com\.unity\.editor\.headless' was not found/.test(text);
    check('Unity licence (batchmode)', !bad, `exit ${u.code}`, 'open Unity Hub, sign in, Preferences > Licenses > Add > "Get a free personal license"; then rerun preflight');
  } else check('Unity 6000.6.4f1', false, UNITY_EXE, 'install the editor through Unity Hub');

  const b = run1(BLENDER_EXE, ['-b', '--version'], 120_000);
  check('Blender', b.code === 0, (b.out.match(/Blender \d+\.\d+\.\d+/) ?? ['?'])[0]);
  const ff = run1('ffmpeg', ['-version']);
  check('ffmpeg', ff.code === 0, (ff.out.split('\n')[0] ?? '').slice(0, 60));

  const disk = run1('powershell', ['-NoProfile', '-Command', "[math]::Round((Get-PSDrive C).Free/1GB)"]);
  const freeGb = Number(disk.out.trim());
  check('disk C: free >= 150 GB', freeGb >= 150, `${freeGb} GB`, 'free space; 4 lanes can take ~120 GB with UE intermediates');
  const pc = run1('powercfg', ['/query', 'SCHEME_CURRENT', 'SUB_SLEEP', 'STANDBYIDLE']);
  const ac = pc.out.match(/Current AC Power Setting Index:\s*0x([0-9a-f]+)/i);
  check('sleep disabled on AC', !!ac && parseInt(ac[1], 16) === 0, ac ? `${parseInt(ac[1], 16)} s` : 'unknown', 'powercfg /change standby-timeout-ac 0   (and pause Windows Update restarts tonight)');
  check('style staged', fs.existsSync(path.join(ROOT, 'shared', 'style', 'DESIGN.md')), path.join(ROOT, 'shared', 'style'), 'run init --style <dir>');

  const w = Math.max(...rows.map((r) => r.name.length));
  for (const r of rows) process.stdout.write(`${r.ok ? ' GO ' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.detail}${r.ok || !r.fix ? '' : `\n      fix: ${r.fix}`}\n`);
  const bad = rows.filter((r) => !r.ok);
  process.stdout.write(bad.length ? `\nNO-GO: ${bad.length} check(s) failed. A lane whose check fails will log BLOCKED and lose the night.\n` : '\nGO: all checks passed.\n');
  process.exitCode = bad.length ? 2 : 0;
}

// ---------------------------------------------------------------- run
function nextAt(hhmm, after = new Date()) {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) die(`bad time "${hhmm}" (HH:MM)`);
  const d = new Date(after);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d <= after) d.setDate(d.getDate() + 1);
  return d;
}

function prompt(lane, n, phase, t, capAt) {
  const head = `GTAI engine spike - lane "${lane}", iteration ${n}, phase ${phase}.
Now ${ts()}. Freeze ${ts(t.freeze)}. Report ${ts(t.report)}. Deadline ${ts(t.until)}. This session is stopped at ${ts(capAt)} at the latest.
Your brief is CLAUDE.md (loaded) plus MVP.md. Shared material is read-only at ../../shared/ (style/ and assets/; assets/LATEST names the newest pack).`;
  if (phase === 'REPORT') {
    return `${head}
REPORT phase: build no new features. Read JOURNAL.md, git log and evidence/. If autoplay evidence is missing or stale, run --autoplay once (budget 15 minutes).
Then write REPORT.md and scorecard.json exactly as CLAUDE.md specifies. Check that every evidence path you cite exists. Commit. Finish before ${ts(t.until)}.`;
  }
  return `${head}
Start by reading JOURNAL.md (create it on iteration 1) and \`git log --oneline -30\`.${lane === 'art' ? '' : ' Check ../../shared/assets/LATEST and integrate a newer pack when one appears.'}
${phase === 'STABILIZE' ? 'It is past freeze: fix bugs, keep the build runnable, refresh the autoplay/stress evidence and the video. No new features.' : 'Continue toward the MVP, highest value first. Commit as you go.'}
Log MILESTONE / FRICTION / BLOCKED / LOOP entries as you work. Before you stop, append a NEXT: entry to JOURNAL.md.`;
}

const children = new Set();
function killTree(p) {
  if (!p?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { windowsHide: true });
  else p.kill('SIGKILL');
}

function runClaude(lane, text, timeoutMs, n, cfg) {
  return new Promise((resolve) => {
    const dir = laneDir(lane);
    const tag = String(n).padStart(3, '0');
    const out = fs.createWriteStream(path.join(dir, 'logs', `iter-${tag}.jsonl`));
    const err = fs.createWriteStream(path.join(dir, 'logs', `iter-${tag}.err`));
    // --model-<lane> overrides the model for one lane (e.g. the art lane); engine lanes should share one model for a fair comparison.
    const model = String(opts[`model-${lane}`] ?? cfg.model);
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', model, '--effort', cfg.effort,
      '--permission-mode', 'bypassPermissions', '--setting-sources', 'project,local', '--strict-mcp-config',
      '--add-dir', path.join(ROOT, 'shared'), '--add-dir', path.join(ROOT, 'tools')];
    const started = Date.now();
    const p = spawn('claude', args, { cwd: dir, windowsHide: true, env: { ...process.env, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' } });
    children.add(p);
    let tail = '';
    let timedOut = false;
    p.stdout.on('data', (b) => { out.write(b); tail = (tail + b.toString()).slice(-200_000); });
    p.stderr.on('data', (b) => err.write(b));
    p.stdin.on('error', () => {});
    p.stdin.end(text);
    const timer = setTimeout(() => { timedOut = true; killTree(p); }, timeoutMs);
    p.on('close', (code) => {
      clearTimeout(timer);
      children.delete(p);
      out.end(); err.end();
      let result = null;
      for (const line of tail.split('\n').reverse()) {
        if (!line.includes('"type":"result"')) continue;
        try { result = JSON.parse(line); break; } catch { /* partial line */ }
      }
      const errText = readIf(path.join(dir, 'logs', `iter-${tag}.err`));
      const blob = `${result?.result ?? ''}\n${errText}`;
      resolve({
        n, code, timedOut, wallS: Math.round((Date.now() - started) / 1000),
        costUsd: result?.total_cost_usd ?? null, turns: result?.num_turns ?? null, isError: result?.is_error ?? (code !== 0 && !timedOut),
        limited: /usage limit|limit reached|rate.?limit|429|overloaded|quota/i.test(blob) && !timedOut,
      });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

async function laneLoop(lane, t, cfg) {
  const stateFile = path.join(laneDir(lane), 'runner-state.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { lane, iterations: [] };
  let n = state.iterations.length;
  let reported = false;
  let fails = 0;
  while (Date.now() < t.until.getTime() - 3 * 60_000 && !reported) {
    const now = Date.now();
    const phase = now < t.freeze.getTime() ? 'BUILD' : now < t.report.getTime() ? 'STABILIZE' : 'REPORT';
    const boundary = phase === 'REPORT' ? t.until.getTime() - 2 * 60_000 : t.report.getTime();
    const capAt = new Date(Math.min(now + cfg.iterMin * 60_000, boundary));
    // Too little time left before the boundary to do useful work: wait for the next phase instead.
    if (boundary - now < 4 * 60_000 && phase !== 'REPORT') { await sleep(boundary - now); continue; }
    n += 1;
    log(`${lane}: iteration ${n} ${phase} until ${ts(capAt)}`);
    const r = await runClaude(lane, prompt(lane, n, phase, t, capAt), capAt.getTime() - now, n, cfg);
    state.iterations.push({ ...r, phase, start: new Date(now).toISOString() });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    log(`${lane}: iteration ${n} ${r.timedOut ? 'stopped at cap' : `exit ${r.code}`} ${r.wallS}s${r.costUsd != null ? ` $${r.costUsd.toFixed(2)}` : ''}${r.limited ? ' USAGE-LIMIT' : ''}`);
    if (phase === 'REPORT') { reported = true; break; }
    if (r.limited) { log(`${lane}: usage limit - waiting 15 min`); await sleep(15 * 60_000); continue; }
    fails = r.isError && r.wallS < 120 ? fails + 1 : 0;
    if (fails >= 5) { log(`${lane}: 5 fast failures in a row - cooling down 10 min (read logs/iter-*.err)`); await sleep(10 * 60_000); fails = 0; }
    await sleep(fails ? 2 * 60_000 : 20_000);
  }
  log(`${lane}: done (${n} iterations)`);
}

async function runAll() {
  if (!fs.existsSync(path.join(ROOT, 'spike.json'))) die(`no spike at ${ROOT}: run init first`);
  const lanes = String(opts.lanes ?? ALL_LANES.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  for (const l of lanes) if (!ALL_LANES.includes(l)) die(`unknown lane "${l}"`);
  const until = nextAt(String(opts.until ?? '08:00'));
  const freeze = opts.freeze ? nextAt(String(opts.freeze)) : new Date(until.getTime() - 75 * 60_000);
  const report = opts['report-at'] ? nextAt(String(opts['report-at'])) : new Date(until.getTime() - 45 * 60_000);
  if (!(freeze <= report && report < until)) die('need freeze <= report-at < until');
  const cfg = { model: String(opts.model ?? 'claude-opus-5-5'), effort: String(opts.effort ?? 'high'), iterMin: Number(opts['iter-min'] ?? 100) };
  const t = { until, freeze, report };
  log(`run: lanes ${lanes.join(',')} | model ${cfg.model}@${cfg.effort} | freeze ${freeze.toLocaleString()} | report ${report.toLocaleString()} | deadline ${until.toLocaleString()}`);
  const stop = () => { log('interrupted - stopping own child sessions'); for (const c of children) killTree(c); process.exit(130); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // Stagger the starts so four cold sessions do not hit the CLI and the disk in the same second.
  await Promise.all(lanes.map(async (l, i) => { await sleep(i * 45_000); return laneLoop(l, t, cfg); }));
  log('run: all lanes finished - next: node games/gtai/spike/spike.mjs report');
}

// ---------------------------------------------------------------- status / report
function laneSummary(l) {
  const dir = laneDir(l);
  const j = readIf(path.join(dir, 'JOURNAL.md'));
  const st = fs.existsSync(path.join(dir, 'runner-state.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'runner-state.json'), 'utf8')) : { iterations: [] };
  const friction = [...j.matchAll(/FRICTION:\s*(\d+)\s*min/g)].reduce((s, m) => s + Number(m[1]), 0);
  const milestones = [...j.matchAll(/^.*MILESTONE:.*$/gm)].map((m) => m[0].trim());
  const blocked = [...j.matchAll(/^.*BLOCKED:.*$/gm)].map((m) => m[0].trim());
  const loops = [...j.matchAll(/LOOP:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const cost = st.iterations.reduce((s, i) => s + (i.costUsd ?? 0), 0);
  const score = fs.existsSync(path.join(dir, 'scorecard.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'scorecard.json'), 'utf8')) : null;
  return { l, dir, j, st, friction, milestones, blocked, loops, cost, score };
}

function status() {
  const latest = readIf(path.join(ROOT, 'shared', 'assets', 'LATEST')).trim() || 'none yet';
  process.stdout.write(`spike ${ROOT} | shared pack: ${latest}\n`);
  for (const l of ALL_LANES) {
    if (!fs.existsSync(laneDir(l))) continue;
    const s = laneSummary(l);
    const last = s.st.iterations.at(-1);
    process.stdout.write(`\n== ${l}: ${s.st.iterations.length} iteration(s), $${s.cost.toFixed(2)}, ${s.milestones.length} milestone(s), friction ${s.friction} min, blocked ${s.blocked.length}${last ? ` | last: ${last.phase} ${last.timedOut ? 'capped' : `exit ${last.code}`}${last.limited ? ' LIMIT' : ''}` : ''}\n`);
    process.stdout.write(`${s.j.trim().split('\n').slice(-6).map((x) => `   ${x}`).join('\n')}\n`);
  }
}

function report() {
  const lanes = ALL_LANES.filter((l) => fs.existsSync(laneDir(l))).map(laneSummary);
  const keys = ['move', 'aim', 'shoot', 'reload', 'roll_iframes', 'hit_react', 'death_anim', 'walk_cycle', 'idle', 'ai_opponent', 'round_flow', 'kill_bark', 'style_applied', 'shared_assets_used', 'autoplay', 'stress', 'video', 'windows_build', 'melee_stretch'];
  const v = (x) => (x == null ? 'unmeasured' : String(x));
  const md = ['# GTAI engine spike: scoreboard', '', `Generated ${new Date().toLocaleString()}. "unmeasured" means the lane did not measure it. It is not zero.`, '',
    `| | ${lanes.map((s) => s.l).join(' | ')} |`, `|---|${lanes.map(() => '---').join('|')}|`];
  const row = (label, f) => md.push(`| ${label} | ${lanes.map((s) => f(s)).join(' | ')} |`);
  row('engine', (s) => v(s.score && `${s.score.engine} ${s.score.engineVersion}`));
  row('approach', (s) => v(s.score?.approach));
  row('min to first playable', (s) => v(s.score?.minutesToFirstPlayable));
  row('min to MVP complete', (s) => v(s.score?.minutesToMvpComplete));
  row('checklist done', (s) => (s.score ? `${keys.filter((k) => s.score.checklist?.[k]).length}/${keys.length}` : 'no scorecard'));
  row('edit->see loop (s)', (s) => (s.loops.length ? s.loops.join(', ') : 'unmeasured'));
  row('build s / size MB', (s) => `${v(s.score?.buildSeconds)} / ${v(s.score?.buildSizeMB)}`);
  row('autoplay fps avg/min', (s) => `${v(s.score?.autoplay?.avgFps)} / ${v(s.score?.autoplay?.minFps)}`);
  row('stress 60 robots fps avg/1%', (s) => `${v(s.score?.stress?.avgFps)} / ${v(s.score?.stress?.p1LowFps)}`);
  row('friction minutes (journal)', (s) => String(s.friction));
  row('blocked on human', (s) => String(s.blocked.length));
  row('headless automation', (s) => v(s.score?.headlessAutomation));
  row('agent friendliness', (s) => v(s.score?.agentFriendliness));
  row('would ship GTAI on it', (s) => v(s.score?.wouldShipGtaiOnThis));
  row('iterations / CLI cost', (s) => `${s.st.iterations.length} / $${s.cost.toFixed(2)}`);
  md.push('', '## Milestones', '');
  for (const s of lanes) md.push(`### ${s.l}`, '', ...(s.milestones.length ? s.milestones.map((m) => `- ${m.replace(/^- /, '')}`) : ['- none logged']), '');
  md.push('## Read next', '', ...lanes.map((s) => `- ${s.l}: \`${path.join(s.dir, 'REPORT.md')}\`, evidence in \`${path.join(s.dir, 'evidence')}\``));
  fs.writeFileSync(path.join(ROOT, 'SCOREBOARD.md'), md.join('\n'));

  // A static compare page: the last 4 autoplay frames per engine lane, the art pack preview, and each video.
  const frames = (s) => {
    const d = path.join(s.dir, 'evidence', 'autoplay');
    const f = fs.existsSync(d) ? fs.readdirSync(d).filter((x) => /\.png$/i.test(x)).sort() : [];
    return f.length ? [0.25, 0.5, 0.75, 1].map((q) => path.join(d, f[Math.min(f.length - 1, Math.floor(q * (f.length - 1)))])) : [];
  };
  const latest = readIf(path.join(ROOT, 'shared', 'assets', 'LATEST')).trim();
  const preview = latest ? path.join(ROOT, 'shared', 'assets', `pack-v${latest}`, 'preview.png') : null;
  const url = (p) => `file:///${p.replace(/\\/g, '/')}`;
  const cards = lanes.map((s) => {
    const imgs = s.l === 'art' ? (preview && fs.existsSync(preview) ? [preview] : []) : frames(s);
    const vid = path.join(s.dir, 'evidence', 'duel.mp4');
    return `<section><h2>${s.l}</h2><p>${s.score ? `${s.score.engine ?? ''} ${s.score.engineVersion ?? ''} - ${s.score.approach ?? ''}` : 'no scorecard'}</p>
${fs.existsSync(vid) ? `<video src="${url(vid)}" controls muted loop></video>` : '<p class="miss">no duel.mp4</p>'}
<div class="g">${imgs.map((i) => `<img src="${url(i)}" alt="${s.l} frame">`).join('') || '<p class="miss">no frames</p>'}</div></section>`;
  }).join('\n');
  fs.writeFileSync(path.join(ROOT, 'compare.html'), `<!doctype html><meta charset="utf-8"><title>GTAI engine spike</title>
<style>:root{--bg:#121214;--fg:#ececec;--mut:#9a9a9a}body{background:var(--bg);color:var(--fg);font:16px system-ui;margin:24px}
section{margin:0 0 40px}video{width:100%;max-width:960px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
img{width:100%}.miss{color:var(--mut)}</style><h1>GTAI engine spike</h1><p>See SCOREBOARD.md beside this page.</p>${cards}`);
  process.stdout.write(`wrote ${path.join(ROOT, 'SCOREBOARD.md')}\n      ${path.join(ROOT, 'compare.html')}\n`);
}

// ---------------------------------------------------------------- main
const cmds = { init, preflight, run: runAll, status, report };
if (!cmds[cmd]) die('usage: spike.mjs init|preflight|run|status|report [options] (see the header)');
await cmds[cmd]();
