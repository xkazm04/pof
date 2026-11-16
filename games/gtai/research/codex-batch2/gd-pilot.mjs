// Tests and tools pilot: Claude specifies, Codex writes in its own worktree, the machine grades, one repair round.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const BASE = process.argv[3];
const R = 'C:/Users/kazda/kiro/gtai';
const POF = 'C:/Users/kazda/kiro/pof';
const HOME = 'C:/Users/kazda/kiro/pof-codex';
const FROM = 'C:/Users/kazda/kiro/gtai-wt/int-day';
const HIDDEN = path.join(OUT, '..', 'bt-tools');
const GODOT = 'C:\\Users\\kazda\\kiro\\gtai-spike\\tools\\godot\\Godot_v4.7.2-stable_win64_console.exe';
const env = { ...process.env, GODOT_BIN: GODOT };
const BAR = 70;
const LAWS = [
  'Do NOT commit, push, create branches, or rewrite git history. Leave changes in the working tree; the overseer reviews and commits.',
  'Change only the files listed under "You may change". Never change the code under test to make a test pass: report the defect in openQuestions instead.',
  'Godot 4.7.2 GDScript, statically typed; GUT tests extend GutTest; a test states behaviour, in the style of project/tests/unit. Warnings are errors.',
  'Native DLLs are already in project/native/bin. Do not rebuild them.',
  'A test states what the code is FOR. Do not pin accidental behaviour (float edge quirks, unclamped inputs, permissive parsing, defaults nobody chose): if behaviour looks like a bug, leave it untested and name it in openQuestions.',
  'Tests use their own fixtures. Never assert a value taken from a real asset, table row or tuned constant that a designer may change; read the constant from the code, or assert a relation.',
  'Do not edit JOURNAL.md, REPORT.md, tools/debt/baseline.json or docs.',
];
const UNITS = [
  ['enemy_brain', 'EnemyBrain', 'features/combat/ai/enemy_brain.gd'],
  ['react_pose', 'ReactPose', 'features/combat/react/react_pose.gd'],
  ['servo_shift', 'ServoShift', 'features/bosses/servo/servo_shift.gd'],
  ['kerb_dresser', 'KerbDresser', 'features/city/gen/kerb_dresser.gd'],
  ['sim_clips', 'CitySimClips', 'features/city/sim/sim_clips.gd'],
  ['rig_hose', 'RigHose', 'features/characters/rig_hose.gd'],
  ['noir_pack', 'NoirPack', 'features/fx/noir/noir_pack.gd'],
  ['marker_shapes', 'MarkerShapes', 'core/render/marker_shapes.gd'],
];
const TOOLS = [
  { id: 'run_reels', dir: 'tools/reel', goal: 'Write tools/reel/run_reels.mjs, a builtins-only ES module and CLI that runs the director reel gate and judges it with parseReel from ./check_reel.mjs. Export reelArgs(view, loadout = "pistol") returning the Godot argv array: --headless --path project --quit-after 40000 res://dev/arena/arena.tscn -- --rigs --bot=reel --reel=director --view=<view> --loadout=<loadout>. Export async runReels({ views, expect, outDir, run }): for each view call await run(view, logPath), where logPath is a file directly under outDir and different per view and run returns the exit code; read the log and judge it. Return { ok, views: [{ view, code, ok, problems, log }] }. A nonzero exit fails that view with a problem naming the code; a missing log fails that view and must not throw; one view failing never stops the others; no views means ok false. The default run spawns GODOT_BIN from the environment. CLI: node tools/reel/run_reels.mjs --out=<dir> [--views=top,tilt70,combo] [--expect=19], print each view, exit 0 when ok, 1 when not, 2 on usage errors.' },
  { id: 'export_checked', dir: 'tools/export', goal: 'Write tools/export/export_checked.mjs, a builtins-only ES module and CLI that refuses to export a tree whose city was not baked. Export exportArgs(out) returning --headless --path project --export-release windows-showcase <out> as an array. Export async exportChecked({ out, check, run }): check() defaults to checkBaked from ./check_baked.mjs with its default paths, run(args) spawns GODOT_BIN and resolves its exit code. If check throws or is not ok, do not call run and return { ok: false, reason } where reason names what is missing. Otherwise call run(exportArgs(out)) and return { ok, code }. CLI: node tools/export/export_checked.mjs [--out=../build/export/windows/RTAI.exe], exit 0 when ok, 1 when not.' },
  { id: 'repeat_scenario', dir: 'tools/tests', goal: 'Write tools/tests/repeat_scenario.mjs, a builtins-only ES module and CLI for chasing an intermittent scenario failure. Export firstError(text): the text after the first line starting with ERROR: or SCRIPT ERROR:, trimmed, or null. Export async repeat({ n, run, stopOnFail = false }): call await run() up to n times; each returns { code, out }; a run fails when code is nonzero or firstError finds something. Return { runs, passed, failed, errors } where errors is [{ error, count }] sorted by count descending, then first seen, and a failure with no error line uses a label containing the exit code. n below 1 throws RangeError. stopOnFail ends at the first failure. CLI: node tools/tests/repeat_scenario.mjs --select=<scenario> [--n=10] runs node tools/tests/run_scenarios.mjs --select=<scenario> each time, prints the summary, exits 0 when none failed, 1 otherwise.' },
];
const git = (cwd, ...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const save = (n, v) => fs.writeFileSync(path.join(OUT, n), typeof v === 'string' ? v : JSON.stringify(v, null, 2));
const results = [];
const shell = (cmd, cwd, min = 40) => new Promise((done) => {
  let out = '';
  const c = spawn(cmd, { cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const t = setTimeout(() => spawnSync('taskkill', ['/F', '/T', '/PID', String(c.pid)]), min * 60_000);
  c.stdout.on('data', (b) => { out += b; }); c.stderr.on('data', (b) => { out += b; });
  c.on('close', (code) => { clearTimeout(t); done({ code, out }); });
});
const dispatch = (args, cwd = POF) => shell(`npx tsx scripts/codex/dispatch.ts ${args}`, cwd, 30);
const scopeOnly = (wt, scope) => git(wt, 'status', '--porcelain', '--untracked-files=all').stdout.split('\n').filter(Boolean).map((l) => l.slice(3)).filter((f) => !scope.includes(f) && !f.endsWith('.uid'));

async function gradeTest(wt, stem, file, scope, name) {
  const unit = spawnSync('node', ['tools/tests/run_unit.mjs', `--select=test_${stem}`, '--no-rerun'], { cwd: wt, env, encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 1 << 26 });
  save(`${name}.unit.log`, `${unit.stdout}\n${unit.stderr}`.slice(-4000));
  if (unit.status !== 0) return { pass: false, why: 'tests red on the real code', detail: `${unit.stdout}`.slice(-1500) };
  const extra = scopeOnly(wt, scope);
  if (extra.length) return { pass: false, why: `outside scope: ${extra.join(', ')}`, detail: extra.join('\n') };
  git(wt, 'add', '--', ...scope, `${scope[0]}.uid`);
  const c = git(wt, 'commit', '-q', '-m', `pilot grade ${name}`);
  if (c.status !== 0 && !/nothing to commit/.test(c.stdout + c.stderr)) {
    const text = `${c.stdout}\n${c.stderr}`;
    save(`${name}.commit.log`, text.slice(-5000));
    return { pass: false, why: 'lint rejected the test', detail: text.slice(-1500) };
  }
  const m = await shell(`node tools/mutate/mutate.mjs --file=${file} --tests=test_${stem} --max=15 --remove-worktree`, wt, 45);
  save(`${name}.mutate.log`, m.out.slice(-9000));
  const pct = [...m.out.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((x) => +x[1]).pop();
  if (m.code !== 0 || pct === undefined) return { pass: false, why: 'mutation run did not finish', detail: m.out.slice(-1500) };
  return { pass: pct >= BAR, score: pct, why: pct >= BAR ? 'mutation score at the bar' : `mutation score ${pct} % under ${BAR} %`, detail: m.out.slice(-1800) };
}

function gradeTool(wt, tool) {
  const hidden = `${tool.id}.test.mjs`;
  const dst = path.join(wt, tool.dir, hidden);
  fs.copyFileSync(path.join(HIDDEN, hidden), dst);
  const r = spawnSync('node', ['--test', `${tool.dir}/${hidden}`], { cwd: wt, encoding: 'utf8', timeout: 120_000 });
  fs.rmSync(dst);
  save(`${tool.id}.hidden.log`, `${r.stdout}\n${r.stderr}`.slice(-5000));
  return { pass: r.status === 0, why: r.status === 0 ? 'hidden tests pass' : 'hidden tests fail', detail: `${r.stdout}`.slice(-1800) };
}

async function run(job) {
  const t0 = Date.now();
  const tp = path.join(OUT, `${job.task.id}.json`);
  save(`${job.task.id}.json`, job.task);
  const d = await dispatch(`run "${tp}" --timeout-min 25`);
  save(`${job.name}.dispatch.log`, d.out);
  const wt = `${HOME}/wt/${job.task.id}`;
  const res = { name: job.name, kind: job.kind, dispatch: d.code };
  if (!fs.existsSync(wt)) { res.error = d.out.slice(-300); results.push(res); save('results.json', results); return; }
  let g = await job.grade(wt);
  res.first = { pass: g.pass, why: g.why, score: g.score };
  if (!g.pass) {
    const detail = g.detail.replace(/\r?\n/g, ' | ').replace(/["%^&<>]/g, ' ').slice(0, 1400);
    const r2 = await dispatch(`resume ${job.task.id} "The machine grader rejected this: ${g.why.replace(/%/g, 'percent')}. Fix it. Output: ${detail}"`);
    save(`${job.name}.repair.log`, r2.out);
    g = await job.grade(wt);
    res.second = { pass: g.pass, why: g.why, score: g.score };
  }
  res.pass = g.pass; res.secs = Math.round((Date.now() - t0) / 1000); res.wt = wt;
  results.push(res); save('results.json', results);
  console.log(JSON.stringify(res));
}

const common = { tier: 'bulk', access: 'write-verified', model: 'gpt-6.1-sol', repo: R, base: BASE, laws: LAWS, copyIgnored: { from: FROM, paths: ['project/.godot', 'project/native/bin'] } };
const jobs = [
  ...UNITS.map(([stem, cls, file]) => {
    const test = `project/tests/unit/test_${stem}.gd`;
    return { name: `t-${stem}`, kind: 'test', grade: (wt) => gradeTest(wt, stem, file, [test], `t-${stem}`), task: { ...common, id: `gt-${stem}`, title: `GUT tests for ${cls}`, goal: `${cls} (project/${file}) has no tests. Write ${test}: GUT tests that pin its real behaviour, including its boundaries and failure paths, so that a change to a comparison, a constant or a branch in that file makes a test fail. Do not change ${cls}.`, context: [`project/${file}`, 'project/tests/unit/test_flamer_sway.gd'], scope: [test], acceptance: [`node tools/tests/run_unit.mjs --select=test_${stem} --no-rerun (GODOT_BIN=${GODOT})`] } };
  }),
  ...TOOLS.map((tool) => ({ name: `w-${tool.id}`, kind: 'tool', grade: (wt) => Promise.resolve(gradeTool(wt, tool)), task: { ...common, id: `gw-${tool.id}`, copyIgnored: undefined, title: `Tool ${tool.id}`, goal: tool.goal, context: ['tools/lib/repo.mjs', 'tools/reel/check_reel.mjs', 'tools/export/check_baked.mjs'], scope: [`${tool.dir}/${tool.id}.mjs`], acceptance: [`node ${tool.dir}/${tool.id}.mjs --help or a run on a small sample you make in a temp folder`] } })),
];
const queue = [...jobs];
await Promise.all(Array.from({ length: 2 }, async () => {
  while (queue.length) { const j = queue.shift(); try { await run(j); } catch (e) { results.push({ name: j.name, error: String(e).slice(0, 400) }); save('results.json', results); console.log(j.name, 'ERROR', String(e).slice(0, 300)); } }
}));
console.log('DONE');
