#!/usr/bin/env node
/**
 * GTAI overnight engine spike: one Claude CLI agent per lane (UE 5.8, Godot 4, Unity 6, plus a shared art lane),
 * each looping in fresh headless sessions until a deadline. A lane's memory is its own JOURNAL.md and git log.
 * Builtins only.
 *
 *   node games/gtai/spike/spike.mjs init      [--root R] [--style <art-direction variant dir>]   (re-runnable)
 *   node games/gtai/spike/spike.mjs prep      [--root R] [--lanes ue,godot,unity,art]   (downloads + bootstraps + build proofs)
 *   node games/gtai/spike/spike.mjs preflight [--root R] [--fetch-godot] [--smoke] [--billing api-first|api|subscription]
 *   node games/gtai/spike/spike.mjs run       [--root R] [--until 08:00] [--lanes ue,godot,unity,art]
 *                                             [--model claude-opus-5-5] [--effort high] [--iter-min 100]
 *                                             [--freeze HH:MM] [--report-at HH:MM] [--model-<lane> <id>] [--precheck]
 *                                             [--billing api-first (default: .env key until drained, then subscription)]
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

// Re-runnable: it rewrites the briefs and (with --style) restages the style, and never touches a lane's
// project/, JOURNAL.md, evidence or git history. Without --style the style is left as it is (preflight says so).
function init() {
  const style = opts.style && opts.style !== true ? path.resolve(String(opts.style)) : null;
  if (style && !fs.existsSync(path.join(style, 'DESIGN.md'))) die(`--style ${style} has no DESIGN.md (pass an art-direction variant dir)`);
  for (const d of ['shared/style', 'shared/assets', 'tools']) fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  if (style) {
    fs.rmSync(path.join(ROOT, 'shared', 'style'), { recursive: true, force: true });
    copyDir(style, path.join(ROOT, 'shared', 'style'));
  }
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
  const prev = fs.existsSync(path.join(ROOT, 'spike.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'spike.json'), 'utf8')) : {};
  const meta = { ...prev, created: prev.created ?? new Date().toISOString(), updated: new Date().toISOString(), style: style ?? prev.style ?? null, lanes: ALL_LANES };
  fs.writeFileSync(path.join(ROOT, 'spike.json'), JSON.stringify(meta, null, 2));
  log(`init: ${ROOT} (style ${meta.style ?? 'NOT STAGED - rerun init --style <variant dir>'})`);
}

// ---------------------------------------------------------------- billing
// The owner's rule (2026-11-01): spend the Anthropic API key in the repo's .env first, then fall back to the
// Claude subscription. The key line may be spelled ANTHROPIC_API_KEY or the owner's ANTRHOPIC_API_KEY.
const REPO_ENV = path.resolve(HERE, '..', '..', '..', '.env');
function apiKeyFromEnvFile() {
  const text = readIf(String(opts['env-file'] ?? REPO_ENV));
  const m = text.match(/^\s*(?:ANTHROPIC_API_KEY|ANTRHOPIC_API_KEY)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}
const BILLING_FILE = () => path.join(ROOT, 'billing.json');
// Never stop for billing (owner, 2026-11-01 21:50): a path that is drained or limited is BLOCKED until a time, and
// every iteration picks the first unblocked path in preference order (API key, then subscription). A drained key is
// re-probed every API_REPROBE_MIN, because the owner may raise its spend limit mid-night (it happened at 21:36).
// billing.json is re-read before every pick, so `spike.mjs billing --reset api` unblocks a path in a running night.
const API_REPROBE_MIN = 45;
const billing = {
  mode: 'subscription', // the path of the last pick: 'api' | 'subscription'
  key: null,
  want: 'api-first', // api-first | api | subscription
  blocked: { api: 0, subscription: 0 }, // epoch ms until which a path is known to be drained or limited
  reasons: {},
  load() {
    this.want = String(opts.billing ?? 'api-first');
    this.key = apiKeyFromEnvFile();
    this.sync();
    if (this.want !== 'subscription' && !this.key) log('billing: no ANTHROPIC_API_KEY / ANTRHOPIC_API_KEY in .env - using the subscription');
    this.pick();
  },
  sync() {
    const saved = fs.existsSync(BILLING_FILE()) ? JSON.parse(readIf(BILLING_FILE()) || '{}') : {};
    if (saved.blocked) { this.blocked = { api: 0, subscription: 0, ...saved.blocked }; this.reasons = saved.reasons ?? {}; }
    else if (saved.exhausted) this.blocked.api = Date.parse(saved.at) + API_REPROBE_MIN * 60_000; // the pre-2026-11-01 file shape
  },
  save() {
    const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
    fs.writeFileSync(BILLING_FILE(), JSON.stringify({ blocked: this.blocked, until: { api: iso(this.blocked.api), subscription: iso(this.blocked.subscription) }, reasons: this.reasons, updated: new Date().toISOString() }, null, 2));
  },
  order() { return this.want === 'subscription' ? ['subscription'] : this.want === 'api' ? ['api'] : ['api', 'subscription']; },
  usable(m) { return m === 'subscription' || !!this.key; },
  pick() {
    this.sync();
    const now = Date.now();
    const m = this.order().find((x) => this.usable(x) && this.blocked[x] <= now) ?? null;
    if (m) this.mode = m;
    return m;
  },
  nextFree() { return Math.min(...this.order().filter((x) => this.usable(x)).map((x) => this.blocked[x])); },
  block(m, untilMs, reason) {
    this.sync();
    this.blocked[m] = Math.max(this.blocked[m] ?? 0, untilMs);
    this.reasons[m] = `${new Date().toISOString()} ${reason.slice(0, 240).replace(/\s+/g, ' ')}`;
    this.save();
    const next = this.order().find((x) => x !== m && this.usable(x) && this.blocked[x] <= Date.now());
    log(`billing: ${m} blocked until ${ts(new Date(this.blocked[m]))} (${reason.slice(0, 100).replace(/\s+/g, ' ')}) - ${next ? `lanes continue on ${next}` : 'no path free: lanes wait'}`);
  },
  env(base, m = this.mode) {
    const e = { ...base };
    delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN; // never inherit a stray key from the shell
    if (m === 'api') e.ANTHROPIC_API_KEY = this.key;
    return e;
  },
};
// An API-billing failure (drained credit, a workspace spend limit, a refused key), as distinct from a subscription
// usage limit. The spend limit reads "You have reached your specified API usage limits" (night of 2026-11-01).
const API_DRAINED = /credit balance is too low|insufficient[_ ]credit|specified API usage limits|API usage limits|billing|payment required|\b402\b|invalid x-api-key|invalid api key|authentication_error|permission_error/i;
const LIMITED = /usage limit|limit reached|hit your limit|rate.?limit|\b429\b|overloaded|quota/i;
// When a limit names its reset, wait exactly that long (+1 min); otherwise 15 min.
function resetAt(text) {
  const epoch = text.match(/limit reached\|(\d{10})/);
  if (epoch) return Number(epoch[1]) * 1000 + 60_000;
  const clock = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (clock) {
    let h = Number(clock[1]) % 12; if (/pm/i.test(clock[3])) h += 12;
    return nextAt(`${h}:${clock[2] ?? '00'}`).getTime() + 60_000;
  }
  return Date.now() + 15 * 60_000;
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

// Windows' own bsdtar: the GNU tar on a Git-Bash PATH reads "C:" as a remote host ("Cannot connect to C:").
const WIN_TAR = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32', 'tar.exe');

// Async (the downloads are ~1 GB and must not block other lanes' prep) and throwing (a lane failure must not
// process.exit the whole prep, which orphaned its siblings' steps on the first run).
async function fetchGodot() {
  const tag = String(opts['godot-tag'] ?? GODOT_TAG_DEFAULT);
  const { dir } = godotPaths();
  fs.mkdirSync(dir, { recursive: true });
  const base = `https://github.com/godotengine/godot/releases/download/${tag}`;
  const zip = path.join(dir, `Godot_v${tag}_win64.exe.zip`);
  const tpz = path.join(dir, `Godot_v${tag}_export_templates.tpz`);
  for (const [url, out] of [[`${base}/Godot_v${tag}_win64.exe.zip`, zip], [`${base}/Godot_v${tag}_export_templates.tpz`, tpz]]) {
    if (fs.existsSync(out) && fs.statSync(out).size > 1e6) continue;
    log(`download ${url}`);
    const r = await exec('curl', ['-fsSL', '-o', out, url], { timeoutMs: 40 * 60_000 });
    if (r.code !== 0) throw new Error(`download failed: ${url} ${r.out.slice(-200)}`);
  }
  if (!godotPaths().exe) {
    const r = await exec(WIN_TAR, ['-xf', zip, '-C', dir], { timeoutMs: 5 * 60_000 });
    if (r.code !== 0) throw new Error(`editor unzip failed: ${r.out.slice(-200)}`);
  }
  // Export templates install to %APPDATA%/Godot/export_templates/<x.y.z.stable>/ (the tpz is a zip holding templates/*).
  const ver = tag.replace(/-/g, '.');
  const tdir = path.join(process.env.APPDATA ?? '', 'Godot', 'export_templates', ver);
  if (!fs.existsSync(path.join(tdir, 'version.txt'))) {
    const tmp = path.join(dir, 'tpl-extract');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const r = await exec(WIN_TAR, ['-xf', tpz, '-C', tmp], { timeoutMs: 20 * 60_000 });
    if (r.code !== 0) throw new Error(`template extract failed: ${r.out.slice(-200)}`);
    copyDir(path.join(tmp, 'templates'), tdir);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  log(`godot ${tag} ready in ${dir}; templates in ${tdir}`);
  return tdir;
}

async function preflight() {
  if (opts['fetch-godot']) await fetchGodot();
  const rows = [];
  const check = (name, ok, detail, fix = '') => rows.push({ name, ok, detail, fix });

  const cl = run1('claude', ['--version']);
  check('claude CLI', cl.code === 0, cl.out.trim().split('\n')[0] ?? '', 'install Claude Code');
  billing.load();
  check('billing', true, billing.order().filter((m) => billing.usable(m)).join(' -> ') + ' (a drained or limited path is skipped, never waited on while another is free)');
  if (opts.smoke) {
    // One tiny Opus turn per billing path: the API key (if any) and the subscription.
    const modes = billing.key ? ['api', 'subscription'] : ['subscription'];
    for (const m of modes) {
      const saved = billing.mode; billing.mode = m;
      const s = spawnSync('claude', ['-p', '--model', String(opts.model ?? 'claude-opus-5-5'), '--output-format', 'stream-json', '--verbose',
        '--setting-sources', 'project,local', '--strict-mcp-config'], { input: 'Reply with the single word OK.', encoding: 'utf8', timeout: 180_000, windowsHide: true, env: billing.env(process.env) });
      billing.mode = saved;
      const src = ((s.stdout ?? '').match(/"apiKeySource"\s*:\s*"([^"]*)"/) ?? [])[1] ?? '?';
      const res = (s.stdout ?? '').split('\n').reverse().find((l) => l.includes('"type":"result"')) ?? '';
      const ok = /"result"\s*:\s*"[^"]*\bOK\b/.test(res) && !/"is_error"\s*:\s*true/.test(res);
      check(`claude smoke via ${m} (key source: ${src})`, ok, (res || s.stderr || '').slice(0, 200).replace(/\s+/g, ' '),
        m === 'api' ? 'the API key is invalid or has no credit - the run will fall straight through to the subscription' : 'check the model id and remaining subscription usage');
    }
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
    // "Access token is unavailable" also appears transiently in GOOD runs; the verdict is the exit code plus
    // a resolved entitlement (the failing run on 2026-11-01 exited 198 with "0 entitlement groups").
    const bad = u.code !== 0 || /No valid Unity Editor license/.test(text) || !/Successfully resolved entitlement/.test(text);
    check('Unity licence (batchmode)', !bad, `exit ${u.code}`, 'START UNITY HUB and leave it running (batchmode takes its access token from the Hub - measured 2026-11-01: exit 198 with the Hub closed, 0 with it open); if still failing, Hub > Preferences > Licenses');
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

// ---------------------------------------------------------------- prep
// Environment preparation, run once before the night: every download, project bootstrap and toolchain proof
// (a real export/build per engine), so the lanes spend the night on development. Each lane gets PREP.md with
// the step timings, because setup cost is part of the engine comparison even when it is paid in advance.
function exec(file, args, { cwd, timeoutMs = 30 * 60_000, logFile } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn(file, args, { cwd, windowsHide: true });
    children.add(p);
    let out = '';
    const sink = logFile ? fs.createWriteStream(logFile) : null;
    const onData = (b) => { out = (out + b.toString()).slice(-400_000); sink?.write(b); };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(p); }, timeoutMs);
    p.on('error', (e) => { out += `\nspawn error: ${e.message}`; });
    p.on('close', (code) => { clearTimeout(timer); children.delete(p); sink?.end(); resolve({ code, out, timedOut, s: Math.round((Date.now() - started) / 1000) }); });
  });
}

function prepLog(lane) {
  const f = path.join(laneDir(lane), 'PREP.md');
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# Environment prep (done before the night, by the host)\n\nSetup is pre-paid so the night is development only. These timings still count in the engine comparison.\n\n`);
  return async (name, fn) => {
    const t0 = Date.now();
    let ok = false, detail = '';
    try { [ok, detail] = await fn(); } catch (e) { detail = e.message; }
    const line = `- ${ok ? 'OK  ' : 'FAIL'} ${name} (${Math.round((Date.now() - t0) / 1000)} s)${detail ? ` - ${String(detail).replace(/\s+/g, ' ').slice(0, 300)}` : ''}`;
    fs.appendFileSync(f, `${line}\n`);
    log(`prep ${lane}: ${line.slice(2)}`);
    return ok;
  };
}

const UE_FILES = (name) => ({
  [`${name}.uproject`]: JSON.stringify({
    FileVersion: 3, EngineAssociation: '5.8', Category: '', Description: 'GTAI engine spike',
    Modules: [{ Name: name, Type: 'Runtime', LoadingPhase: 'Default', AdditionalDependencies: ['Engine'] }],
    Plugins: [{ Name: 'Paper2D', Enabled: true }, { Name: 'EnhancedInput', Enabled: true }, { Name: 'PythonScriptPlugin', Enabled: true }, { Name: 'EditorScriptingUtilities', Enabled: true }],
  }, null, 2),
  [`Source/${name}.Target.cs`]: `using UnrealBuildTool;\n\npublic class ${name}Target : TargetRules\n{\n\tpublic ${name}Target(TargetInfo Target) : base(Target)\n\t{\n\t\tType = TargetType.Game;\n\t\tDefaultBuildSettings = BuildSettingsVersion.Latest;\n\t\tIncludeOrderVersion = EngineIncludeOrderVersion.Latest;\n\t\tExtraModuleNames.Add("${name}");\n\t}\n}\n`,
  [`Source/${name}Editor.Target.cs`]: `using UnrealBuildTool;\n\npublic class ${name}EditorTarget : TargetRules\n{\n\tpublic ${name}EditorTarget(TargetInfo Target) : base(Target)\n\t{\n\t\tType = TargetType.Editor;\n\t\tDefaultBuildSettings = BuildSettingsVersion.Latest;\n\t\tIncludeOrderVersion = EngineIncludeOrderVersion.Latest;\n\t\tExtraModuleNames.Add("${name}");\n\t}\n}\n`,
  [`Source/${name}/${name}.Build.cs`]: `using UnrealBuildTool;\n\npublic class ${name} : ModuleRules\n{\n\tpublic ${name}(ReadOnlyTargetRules Target) : base(Target)\n\t{\n\t\tPCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;\n\t\tPublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput", "Paper2D" });\n\t}\n}\n`,
  [`Source/${name}/${name}.h`]: '#pragma once\n\n#include "CoreMinimal.h"\n',
  [`Source/${name}/${name}.cpp`]: `#include "${name}.h"\n#include "Modules/ModuleManager.h"\n\nIMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, ${name}, "${name}");\n`,
  'Config/DefaultEngine.ini': '[/Script/EngineSettings.GeneralProjectSettings]\nProjectName=GTAI Spike\n',
  'Config/DefaultGame.ini': '[/Script/EngineSettings.GeneralProjectSettings]\nProjectName=GTAI Spike\n',
});

async function prepUe() {
  const step = prepLog('ue');
  const proj = path.join(laneDir('ue'), 'project');
  const up = path.join(proj, 'GTAISpike.uproject');
  const logs = path.join(laneDir('ue'), 'logs');
  await step('scaffold C++ project (Paper2D, EnhancedInput, Python enabled)', async () => {
    if (fs.existsSync(up)) return [true, 'already present'];
    for (const [rel, body] of Object.entries(UE_FILES('GTAISpike'))) {
      fs.mkdirSync(path.dirname(path.join(proj, rel)), { recursive: true });
      fs.writeFileSync(path.join(proj, rel), body);
    }
    return [true, up];
  });
  const built = await step('Build.bat GTAISpikeEditor Win64 Development', async () => {
    const r = await exec('cmd', ['/c', path.join(UE_ROOT, 'Engine/Build/BatchFiles/Build.bat'), 'GTAISpikeEditor', 'Win64', 'Development', `-Project=${up}`, '-WaitMutex'],
      { timeoutMs: 40 * 60_000, logFile: path.join(logs, 'prep-build-editor.log') });
    return [r.code === 0, r.timedOut ? 'timed out' : (r.out.match(/Result: \w+|Total execution time: [\d.]+ seconds/g) ?? []).join('; ') || `exit ${r.code}`];
  });
  if (!built) return;
  await step('headless editor/game boot (warms project shaders)', async () => {
    const lf = path.join(logs, 'prep-boot.log');
    const r = await exec(path.join(UE_ROOT, 'Engine/Binaries/Win64/UnrealEditor.exe'), [up, '-game', '-RenderOffScreen', '-windowed', '-ResX=640', '-ResY=360', '-unattended', '-nosplash', '-ExecCmds=quit', `-abslog=${lf}`],
      { timeoutMs: 25 * 60_000 });
    const text = readIf(lf);
    // Judge by the log, not the exit code (shutdown crashes are a known UE trait on this machine).
    const ok = /Engine is initialized|LogLoad: Took .* to LoadMap/.test(text);
    return [ok, `${r.timedOut ? 'timed out (killed own PID); ' : ''}exit ${r.code}; log ${ok ? 'shows engine init' : 'has no engine init line'}`];
  });
  await step('RunUAT BuildCookRun Win64 (packaging proof)', async () => {
    const out = path.join(laneDir('ue'), 'build', 'prep-check');
    const r = await exec('cmd', ['/c', path.join(UE_ROOT, 'Engine/Build/BatchFiles/RunUAT.bat'), 'BuildCookRun', `-project=${up}`, '-platform=Win64', '-clientconfig=Development',
      '-build', '-cook', '-stage', '-pak', '-archive', `-archivedirectory=${out}`, '-noP4', '-utf8output', '-unattended', '-nocompileeditor'],
      { timeoutMs: 60 * 60_000, logFile: path.join(logs, 'prep-package.log') });
    const exe = fs.existsSync(out) ? fs.readdirSync(out, { recursive: true }).find((f) => /GTAISpike\.exe$/i.test(String(f))) : null;
    return [r.code === 0 && !!exe, `${r.timedOut ? 'timed out; ' : ''}exit ${r.code}; ${exe ? `packaged ${exe}` : 'no packaged exe'}`];
  });
}

async function prepGodot() {
  const step = prepLog('godot');
  const fetched = await step('download Godot editor + export templates', async () => { await fetchGodot(); return [!!godotPaths().exe, godotPaths().exe ?? 'no exe after download']; });
  if (!fetched) return;
  const dir = godotPaths().dir;
  const con = fs.readdirSync(dir).find((f) => /_win64_console\.exe$/.test(f));
  const godot = con ? path.join(dir, con) : godotPaths().exe;
  const proj = path.join(laneDir('godot'), 'project');
  const ver = String(opts['godot-tag'] ?? GODOT_TAG_DEFAULT).replace(/-stable$/, '').split('.').slice(0, 2).join('.');
  await step('scaffold project (project.godot, main.tscn, Windows export preset)', async () => {
    fs.mkdirSync(proj, { recursive: true });
    if (!fs.existsSync(path.join(proj, 'project.godot'))) {
      fs.writeFileSync(path.join(proj, 'project.godot'), `config_version=5\n\n[application]\n\nconfig/name="GTAISpike"\nrun/main_scene="res://main.tscn"\nconfig/features=PackedStringArray("${ver}")\n\n[rendering]\n\nrenderer/rendering_method="forward_plus"\n`);
      fs.writeFileSync(path.join(proj, 'main.tscn'), '[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n');
      fs.writeFileSync(path.join(proj, 'export_presets.cfg'), '[preset.0]\n\nname="Windows Desktop"\nplatform="Windows Desktop"\nrunnable=true\nexport_filter="all_resources"\nexport_path="../build/GTAISpike.exe"\n\n[preset.0.options]\n\nbinary_format/embed_pck=true\n');
    }
    return [true, `console exe: ${godot}`];
  });
  await step('headless --import', async () => {
    const r = await exec(godot, ['--headless', '--path', proj, '--import'], { timeoutMs: 10 * 60_000, logFile: path.join(laneDir('godot'), 'logs', 'prep-import.log') });
    return [r.code === 0 && fs.existsSync(path.join(proj, '.godot')), `exit ${r.code}`];
  });
  await step('headless --export-release "Windows Desktop" (export proof)', async () => {
    const out = path.join(laneDir('godot'), 'build', 'prep-check', 'GTAISpike.exe');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = await exec(godot, ['--headless', '--path', proj, '--export-release', 'Windows Desktop', out], { timeoutMs: 15 * 60_000, logFile: path.join(laneDir('godot'), 'logs', 'prep-export.log') });
    return [fs.existsSync(out), `exit ${r.code}; ${fs.existsSync(out) ? `${Math.round(fs.statSync(out).size / 1e6)} MB exe` : 'no exe'}`];
  });
}

// Newest version of a Unity-registry package whose minimum editor is <= this editor.
function unityPackageVersion(name, editor = '6000.6') {
  // Built-in packages (2d.sprite, 2d.tilemap, ...) ship inside the editor and are not on the registry.
  const builtin = path.join(path.dirname(UNITY_EXE), 'Data/Resources/PackageManager/BuiltInPackages', name, 'package.json');
  if (fs.existsSync(builtin)) return JSON.parse(fs.readFileSync(builtin, 'utf8')).version ?? null;
  const r = run1('curl', ['-fsL', `https://packages.unity.com/${name}`], 60_000);
  if (r.code !== 0) return null;
  const doc = JSON.parse(r.out);
  const num = (v) => String(v).split(/[.-]/).slice(0, 3).map((x) => Number(x) || 0);
  const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const ok = Object.entries(doc.versions ?? {}).filter(([v, m]) => !/-(pre|exp|preview)/.test(v) && (!m.unity || cmp(m.unity, editor) <= 0)).map(([v]) => v);
  return ok.sort(cmp).at(-1) ?? null;
}

async function prepUnity() {
  const step = prepLog('unity');
  const proj = path.join(laneDir('unity'), 'project');
  const logs = path.join(laneDir('unity'), 'logs');
  const tpl = path.join(path.dirname(UNITY_EXE), 'Data/Resources/PackageManager/ProjectTemplates/com.unity.template.urp-blank-17.2.1.tgz');
  const created = await step('create project from the urp-blank template (neutral: URP serves 2D and 3D)', async () => {
    if (fs.existsSync(path.join(proj, 'ProjectSettings'))) return [true, 'already present'];
    const lf = path.join(logs, 'prep-create.log');
    const r = await exec(UNITY_EXE, ['-batchmode', '-nographics', '-quit', '-createProject', proj, '-cloneFromTemplate', tpl, '-logFile', lf], { timeoutMs: 30 * 60_000 });
    return [r.code === 0 && fs.existsSync(path.join(proj, 'Packages', 'manifest.json')), `exit ${r.code}${r.code === 198 ? ' (licence: is Unity Hub running?)' : ''}`];
  });
  if (!created) return;
  await step('add packages (inputsystem, 2d.animation, 2d.sprite, 2d.tilemap, cloud.gltfast) and resolve', async () => {
    const mf = path.join(proj, 'Packages', 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const added = [];
    for (const n of ['com.unity.inputsystem', 'com.unity.2d.animation', 'com.unity.2d.sprite', 'com.unity.2d.tilemap', 'com.unity.cloud.gltfast']) {
      if (m.dependencies[n]) continue;
      const v = unityPackageVersion(n);
      if (!v) return [false, `no compatible version found for ${n}`];
      m.dependencies[n] = v; added.push(`${n}@${v}`);
    }
    fs.writeFileSync(mf, JSON.stringify(m, null, 2));
    const lf = path.join(logs, 'prep-resolve.log');
    const r = await exec(UNITY_EXE, ['-batchmode', '-nographics', '-quit', '-projectPath', proj, '-logFile', lf], { timeoutMs: 30 * 60_000 });
    const lock = readIf(path.join(proj, 'Packages', 'packages-lock.json'));
    const missing = ['com.unity.inputsystem', 'com.unity.cloud.gltfast'].filter((n) => !lock.includes(`"${n}"`));
    const errs = (readIf(lf).match(/error CS\d+[^\n]*/g) ?? []).slice(0, 3);
    return [r.code === 0 && !missing.length && !errs.length, `exit ${r.code}; added ${added.join(', ') || 'none'}${missing.length ? `; missing in lock: ${missing}` : ''}${errs.length ? `; ${errs.join(' | ')}` : ''}`];
  });
  await step('batchmode BuildPlayer StandaloneWindows64 (build proof)', async () => {
    const ed = path.join(proj, 'Assets', 'Editor');
    fs.mkdirSync(ed, { recursive: true });
    const script = path.join(ed, 'PrepBuildCheck.cs');
    const out = path.join(laneDir('unity'), 'build', 'prep-check', 'GTAISpike.exe').replace(/\\/g, '/');
    fs.writeFileSync(script, `using UnityEditor;\nusing UnityEditor.Build.Reporting;\nusing UnityEngine;\n\npublic static class PrepBuildCheck\n{\n    public static void Run()\n    {\n        var guids = AssetDatabase.FindAssets("t:Scene", new[] { "Assets" });\n        var scenes = new string[guids.Length > 0 ? 1 : 0];\n        if (guids.Length > 0) scenes[0] = AssetDatabase.GUIDToAssetPath(guids[0]);\n        var report = BuildPipeline.BuildPlayer(scenes, "${out}", BuildTarget.StandaloneWindows64, BuildOptions.None);\n        Debug.Log("PREP_BUILD_RESULT " + report.summary.result);\n        EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 2);\n    }\n}\n`);
    const lf = path.join(logs, 'prep-build.log');
    const r = await exec(UNITY_EXE, ['-batchmode', '-nographics', '-projectPath', proj, '-executeMethod', 'PrepBuildCheck.Run', '-logFile', lf], { timeoutMs: 40 * 60_000 });
    fs.rmSync(script, { force: true }); fs.rmSync(`${script}.meta`, { force: true });
    const ok = fs.existsSync(out) && /PREP_BUILD_RESULT Succeeded/.test(readIf(lf));
    return [ok, `exit ${r.code}; ${ok ? 'player built' : (readIf(lf).match(/PREP_BUILD_RESULT \w+|error[^\n]{0,160}/i) ?? ['no result line'])[0]}`];
  });
}

async function prepArt() {
  const step = prepLog('art');
  await step('Blender headless: rigged mesh + action -> GLB and FBX export proof', async () => {
    const dir = path.join(ROOT, 'tools', 'prep-check');
    fs.mkdirSync(dir, { recursive: true });
    const py = path.join(dir, 'export_check.py');
    fs.writeFileSync(py, [
      'import bpy, sys, os',
      'out = sys.argv[sys.argv.index("--") + 1]',
      'bpy.ops.wm.read_factory_settings(use_empty=True)',
      'bpy.ops.object.armature_add(location=(0, 0, 0)); arm = bpy.context.object',
      'bpy.ops.mesh.primitive_cube_add(size=0.5, location=(0, 0, 0.5)); cube = bpy.context.object',
      'cube.parent = arm; mod = cube.modifiers.new("Armature", "ARMATURE"); mod.object = arm',
      'vg = cube.vertex_groups.new(name=arm.data.bones[0].name); vg.add([v.index for v in cube.data.vertices], 1.0, "REPLACE")',
      'arm.animation_data_create(); act = bpy.data.actions.new("walk"); arm.animation_data.action = act',
      'pb = arm.pose.bones[0]',
      'for f, z in ((1, 0.0), (12, 0.6), (24, 0.0)):',
      '    pb.rotation_mode = "XYZ"; pb.rotation_euler[2] = z; pb.keyframe_insert("rotation_euler", frame=f)',
      'bpy.ops.export_scene.gltf(filepath=os.path.join(out, "check.glb"), export_format="GLB", export_animations=True)',
      'bpy.ops.export_scene.fbx(filepath=os.path.join(out, "check.fbx"), bake_anim=True)',
      'print("PREP_EXPORT_OK")',
    ].join('\n'));
    const r = await exec(BLENDER_EXE, ['-b', '--python', py, '--', dir], { timeoutMs: 10 * 60_000 });
    const ok = /PREP_EXPORT_OK/.test(r.out) && fs.existsSync(path.join(dir, 'check.glb')) && fs.existsSync(path.join(dir, 'check.fbx'));
    return [ok, ok ? 'check.glb + check.fbx written' : r.out.slice(-300)];
  });
  await step('ffmpeg present (sprite contact sheets, duel.mp4)', async () => { const r = run1('ffmpeg', ['-version']); return [r.code === 0, (r.out.split('\n')[0] ?? '').slice(0, 60)]; });
}

async function prep() {
  if (!fs.existsSync(path.join(ROOT, 'spike.json'))) die(`no spike at ${ROOT}: run init first`);
  const lanes = String(opts.lanes ?? ALL_LANES.join(',')).split(',').map((s) => s.trim());
  const fns = { ue: prepUe, godot: prepGodot, unity: prepUnity, art: prepArt };
  const stop = () => { log('prep interrupted - stopping own child processes'); for (const c of children) killTree(c); process.exit(130); };
  process.on('SIGINT', stop);
  log(`prep: ${lanes.join(',')}`);
  await Promise.all(lanes.map((l) => fns[l]()));
  const fails = lanes.flatMap((l) => readIf(path.join(laneDir(l), 'PREP.md')).split('\n').filter((x) => x.startsWith('- FAIL')).map((x) => `${l}: ${x.slice(7)}`));
  log(fails.length ? `prep: ${fails.length} failing step(s):\n  ${fails.join('\n  ')}` : 'prep: every step OK');
  process.exitCode = fails.length ? 2 : 0;
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
  // --precheck: a short run (about an hour) before the night, to surface blockers early. Same lanes, same repos;
  // the night continues from where it stops. Its report is PRECHECK.md, not the morning's REPORT.md and scorecard.
  if (opts.precheck) {
    const pre = `${head}
This is a SHORT PRE-CHECK run before the night run. Its purpose is to find blockers early. The night run continues from your JOURNAL.md and git, so nothing you do now is wasted.`;
    if (phase === 'REPORT') {
      return `${pre}
PRE-CHECK REPORT phase: build no new features. Write PRECHECK.md (under 60 lines):
1. what works now, each item with an evidence path or command;
2. every BLOCKED or FRICTION item you hit, with the minutes it cost and whether it is solved;
3. **what the host or owner must fix before the night** (missing tool, licence, permission, asset, unclear brief), or "nothing";
4. your plan for the night in 5 bullets, and your confidence 1-5 that you will reach a runnable Windows build of the MVP by morning.
Append a NEXT: entry to JOURNAL.md. Commit. Finish before ${ts(t.until)}.`;
    }
    return `${pre}
Start by reading JOURNAL.md (create it on iteration 1) and \`git log --oneline -30\`. Go straight for the riskiest part of your engine's path: get something on screen, controllable, in the engine you were given, and prove you can build and capture it headlessly.${lane === 'art' ? ' For the art lane: get one rigged robot through the full path (model, a clip, the top-down sprite render, the GLB and FBX export) before polishing.' : ''}
Log MILESTONE / FRICTION / BLOCKED / LOOP entries as you work. Before you stop, append a NEXT: entry to JOURNAL.md.`;
  }
  if (phase === 'REPORT') {
    return `${head}
REPORT phase: build no new features. Read JOURNAL.md, git log and evidence/. If autoplay evidence is missing or stale, run --autoplay once (budget 15 minutes).
${lane === 'art' ? '' : 'If evidence/showcase.mp4 is missing, record it from the real build first (60 to 90 s; budget 15 minutes). '}Then write REPORT.md and scorecard.json exactly as CLAUDE.md specifies, including the "push" block. Check that every evidence path you cite exists. Commit. Finish before ${ts(t.until)}.`;
  }
  return `${head}
Start by reading JOURNAL.md (create it on iteration 1) and \`git log --oneline -30\`.${lane === 'art' ? '' : ' Check ../../shared/assets/LATEST and integrate a newer pack when one appears.'}
${phase === 'STABILIZE' ? `It is past freeze: fix bugs, keep the build runnable, refresh the autoplay/stress/weapon/mission evidence${lane === 'art' ? '' : ', and record evidence/showcase.mp4 (60 to 90 s, the best honest minute of your build: see "Night push" in MVP.md)'}. No new features.` : `Work order: any unevidenced MVP item first, then the "Night push" list in MVP.md (it outranks the remaining night-stretch items), in order. There is no "done" tonight: when an item is evidenced, start the next one; when the list is finished, raise the quality of the weakest item. Do not end the session early. Commit as you go.`}
Log MILESTONE / FRICTION / BLOCKED / LOOP entries as you work. Before you stop, append a NEXT: entry to JOURNAL.md.`;
}

const children = new Set();
function killTree(p) {
  if (!p?.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(p.pid)], { windowsHide: true });
  else p.kill('SIGKILL');
}

function runClaude(lane, text, timeoutMs, n, cfg, mode = billing.mode) {
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
    const p = spawn('claude', args, { cwd: dir, windowsHide: true, env: billing.env({ ...process.env, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: '0' }, mode) });
    children.add(p);
    let tail = '';
    let head = '';
    let timedOut = false;
    p.stdout.on('data', (b) => { out.write(b); tail = (tail + b.toString()).slice(-200_000); if (head.length < 20_000) head += b.toString(); });
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
      const blob = `${result?.result ?? ''}\n${errText}\n${tail.slice(-6000)}`;
      // The stream's system/init event names the credential the CLI actually used: proof of the billing mode.
      const keySource = (head.match(/"apiKeySource"\s*:\s*"([^"]*)"/) ?? [])[1] ?? null;
      // Judge drainage on error surfaces only (result text, stderr, API-error lines), never on what the agent wrote:
      // the game has a boss called "Triage & Billing".
      const errSurface = `${result?.is_error ? result?.result ?? '' : ''}\n${errText}\n${tail.split('\n').filter((l) => /API Error|"type":"error"|"error":\{/.test(l)).join('\n').slice(-4000)}`;
      const drained = mode === 'api' && !timedOut && API_DRAINED.test(errSurface);
      const limited = !drained && !timedOut && LIMITED.test(errSurface);
      resolve({
        n, code, timedOut, wallS: Math.round((Date.now() - started) / 1000), billing: mode, keySource, drained,
        drainReason: drained ? `${errSurface.match(API_DRAINED)?.[0] ?? ''} ${errSurface.trim().slice(0, 200)}` : null,
        costUsd: result?.total_cost_usd ?? null, turns: result?.num_turns ?? null, isError: result?.is_error ?? (code !== 0 && !timedOut),
        limited, limitReason: limited ? errSurface.trim().slice(0, 300) : null, resetAt: limited ? resetAt(errSurface) : null,
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
  let quick = 0;
  while (Date.now() < t.until.getTime() - 3 * 60_000 && !reported) {
    const now = Date.now();
    const phase = now < t.freeze.getTime() ? 'BUILD' : now < t.report.getTime() ? 'STABILIZE' : 'REPORT';
    const boundary = phase === 'REPORT' ? t.until.getTime() - 2 * 60_000 : t.report.getTime();
    const capAt = new Date(Math.min(now + cfg.iterMin * 60_000, boundary));
    // Too little time left before the boundary to do useful work: wait for the next phase instead.
    if (boundary - now < 4 * 60_000 && phase !== 'REPORT') { await sleep(boundary - now); continue; }
    // Every billing path drained or limited: wait for the first to free up (re-checked at least every 15 min).
    const mode = billing.pick();
    if (!mode) {
      const w = Math.max(60_000, Math.min(15 * 60_000, billing.nextFree() - now));
      log(`${lane}: every billing path is blocked - waiting ${Math.round(w / 60_000)} min`);
      await sleep(w); continue;
    }
    n += 1;
    log(`${lane}: iteration ${n} ${phase} until ${ts(capAt)} [${mode}]`);
    let r;
    try { r = await runClaude(lane, prompt(lane, n, phase, t, capAt), capAt.getTime() - now, n, cfg, mode); }
    catch (e) { log(`${lane}: iteration ${n} could not start (${String(e?.message ?? e).slice(0, 160)}) - retrying in 2 min`); await sleep(2 * 60_000); continue; }
    state.iterations.push({ ...r, phase, start: new Date(now).toISOString() });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    log(`${lane}: iteration ${n} [${r.billing}${r.keySource ? `/${r.keySource}` : ''}] ${r.timedOut ? 'stopped at cap' : `exit ${r.code}`} ${r.wallS}s${r.costUsd != null ? ` $${r.costUsd.toFixed(2)}` : ''}${r.limited ? ' USAGE-LIMIT' : ''}`);
    // Drained or limited mid-iteration: block that path and go straight on with the next free one (the journal and
    // git carry the work). In REPORT the report is retried, because it was not written.
    if (r.drained) { billing.block('api', Date.now() + API_REPROBE_MIN * 60_000, r.drainReason ?? 'api error'); continue; }
    if (r.limited) { billing.block(r.billing, r.billing === 'api' ? Math.min(r.resetAt, Date.now() + API_REPROBE_MIN * 60_000) : r.resetAt, r.limitReason ?? 'usage limit'); continue; }
    if (phase === 'REPORT') { reported = true; break; }
    fails = r.isError && r.wallS < 120 ? fails + 1 : 0;
    if (fails >= 5) { log(`${lane}: 5 fast failures in a row - cooling down 10 min (read logs/iter-*.err)`); await sleep(10 * 60_000); fails = 0; }
    // A lane that believes it is finished ends each session in under 3 min; restarting it every 20 s spends money for
    // nothing (pre-check 2026-11-01: art iterations of 246 s, then 54 s). Back off, longer each time, capped at 30 min.
    quick = !r.isError && r.wallS < 180 ? quick + 1 : 0;
    if (quick >= 2) { const m = Math.min(30, 5 * (quick - 1)); log(`${lane}: ${quick} short sessions in a row - waiting ${m} min`); await sleep(Math.min(m * 60_000, t.report.getTime() - Date.now())); continue; }
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
  billing.load();
  const cfg = { model: String(opts.model ?? 'claude-opus-5-5'), effort: String(opts.effort ?? 'high'), iterMin: Number(opts['iter-min'] ?? 100) };
  const t = { until, freeze, report };
  log(`run: billing ${billing.order().filter((m) => billing.usable(m)).join(' -> ')} (now ${billing.pick() ?? 'all blocked'}) | lanes ${lanes.join(',')} | model ${cfg.model}@${cfg.effort} | freeze ${freeze.toLocaleString()} | report ${report.toLocaleString()} | deadline ${until.toLocaleString()}${opts.precheck ? " | PRE-CHECK" : ""}`);
  const stop = () => { log('interrupted - stopping own child sessions'); for (const c of children) killTree(c); process.exit(130); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // A lane must never take the night down with it: log and keep the other lanes running.
  process.on('uncaughtException', (e) => log(`runner: uncaught ${String(e?.stack ?? e).slice(0, 300)}`));
  process.on('unhandledRejection', (e) => log(`runner: unhandled ${String(e?.stack ?? e).slice(0, 300)}`));
  // Stagger the starts so four cold sessions do not hit the CLI and the disk in the same second.
  await Promise.all(lanes.map(async (l, i) => {
    await sleep(i * 45_000);
    // laneLoop is re-entered after an unexpected throw until the deadline; its state lives in runner-state.json.
    while (Date.now() < t.until.getTime() - 3 * 60_000) {
      try { await laneLoop(l, t, cfg); return; } catch (e) { log(`${l}: lane loop threw (${String(e?.message ?? e).slice(0, 160)}) - restarting it in 1 min`); await sleep(60_000); }
    }
  }));
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
  const apiCost = st.iterations.filter((i) => i.billing === 'api').reduce((s, i) => s + (i.costUsd ?? 0), 0);
  const score = fs.existsSync(path.join(dir, 'scorecard.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'scorecard.json'), 'utf8')) : null;
  return { l, dir, j, st, friction, milestones, blocked, loops, cost, apiCost, score };
}

function status() {
  const latest = readIf(path.join(ROOT, 'shared', 'assets', 'LATEST')).trim() || 'none yet';
  process.stdout.write(`spike ${ROOT} | shared pack: ${latest} | billing: ${billingLine()}\n`);
  for (const l of ALL_LANES) {
    if (!fs.existsSync(laneDir(l))) continue;
    const s = laneSummary(l);
    const last = s.st.iterations.at(-1);
    process.stdout.write(`\n== ${l}: ${s.st.iterations.length} iteration(s), $${s.cost.toFixed(2)} (API key $${s.apiCost.toFixed(2)}),${s.milestones.length} milestone(s), friction ${s.friction} min, blocked ${s.blocked.length}${last ? ` | last: ${last.phase} ${last.timedOut ? 'capped' : `exit ${last.code}`}${last.limited ? ' LIMIT' : ''}` : ''}\n`);
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
  const sk = ['readability', 'car', 'crowd', 'soul_swap', 'gamepad'];
  row('night stretch done', (s) => (s.score?.stretch ? `${sk.filter((k) => s.score.stretch[k]).length}/${sk.length} (${sk.filter((k) => s.score.stretch[k]).join(', ') || 'none'})` : 'unmeasured'));
  const pk = ['weapons', 'combat_moves', 'anim_set', 'fx', 'enemy_variety', 'mission_slice', 'showcase'];
  row('night push done', (s) => (s.score?.push ? `${pk.filter((k) => s.score.push[k]).length}/${pk.length} (${pk.filter((k) => s.score.push[k]).join(', ') || 'none'})` : 'unmeasured'));
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
    const show = path.join(s.dir, 'evidence', 'showcase.mp4');
    const vid = fs.existsSync(show) ? show : path.join(s.dir, 'evidence', 'duel.mp4');
    return `<section><h2>${s.l}</h2><p>${s.score ? `${s.score.engine ?? ''} ${s.score.engineVersion ?? ''} - ${s.score.approach ?? ''}` : 'no scorecard'}</p>
${fs.existsSync(vid) ? `<video src="${url(vid)}" controls muted loop></video>` : '<p class="miss">no showcase.mp4 or duel.mp4</p>'}
<div class="g">${imgs.map((i) => `<img src="${url(i)}" alt="${s.l} frame">`).join('') || '<p class="miss">no frames</p>'}</div></section>`;
  }).join('\n');
  fs.writeFileSync(path.join(ROOT, 'compare.html'), `<!doctype html><meta charset="utf-8"><title>GTAI engine spike</title>
<style>:root{--bg:#121214;--fg:#ececec;--mut:#9a9a9a}body{background:var(--bg);color:var(--fg);font:16px system-ui;margin:24px}
section{margin:0 0 40px}video{width:100%;max-width:960px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px}
img{width:100%}.miss{color:var(--mut)}</style><h1>GTAI engine spike</h1><p>See SCOREBOARD.md beside this page.</p>${cards}`);
  process.stdout.write(`wrote ${path.join(ROOT, 'SCOREBOARD.md')}\n      ${path.join(ROOT, 'compare.html')}\n`);
}

function billingLine() {
  billing.load();
  const bl = (m) => (billing.blocked[m] > Date.now() ? `blocked until ${ts(new Date(billing.blocked[m]))}` : 'free');
  return `API key ${billing.key ? bl('api') : 'absent'}, subscription ${bl('subscription')} -> next iteration uses ${billing.pick() ?? 'nothing (waiting)'}`;
}
// `billing [--reset api|subscription|all]`: show the paths; --reset unblocks one in a running night (re-read per pick).
function billingCmd() {
  const r = opts.reset === true ? 'all' : opts.reset;
  if (r) {
    billing.load();
    for (const m of r === 'all' ? ['api', 'subscription'] : [String(r)]) { billing.blocked[m] = 0; delete billing.reasons[m]; }
    billing.save();
  }
  process.stdout.write(`billing: ${billingLine()}\n`);
  for (const [m, why] of Object.entries(billing.reasons)) process.stdout.write(`  last block on ${m}: ${why}\n`);
}

// ---------------------------------------------------------------- main
const cmds = { init, prep, preflight, run: runAll, status, report, billing: billingCmd };
if (!cmds[cmd]) die('usage: spike.mjs init|preflight|run|status|report [options] (see the header)');
await cmds[cmd]();
