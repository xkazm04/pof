// node --test games/gtai/night/night.test.mjs - the pure parts of the night runner, plus an init/status smoke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { apiKeyFromText, backupKeyFromText, backupKey2FromText, buildPrompt, checkPaths, classifyFailure, createBilling, nextAt, parseConfig, phaseAt, planTimes, queueEmpty, requestsFor, resetAt, ts } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve('C:/night-root');
const at = (h, m, day = 2) => new Date(2026, 10, day, h, m, 0, 0);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'night-test-'));

// ---------------------------------------------------------------- config
test('config: the documented example parses, paths resolve against root, defaults fill in', () => {
  const c = parseConfig(JSON.stringify({ lanes: [{ id: 'visual-engine', cwd: 'C:/wt/n-visual', brief: 'briefs/visual-engine.md', model: 'claude-opus-5-5', effort: 'high', addDirs: ['C:/masters'] }], common: 'briefs/common.md' }), ROOT);
  assert.deepEqual(c.errors, []);
  const l = c.lanes[0];
  assert.equal(l.brief, path.join(ROOT, 'briefs', 'visual-engine.md'));
  assert.equal(l.cwd, path.resolve('C:/wt/n-visual'));
  assert.deepEqual(l.addDirs, [path.resolve('C:/masters')]);
  assert.equal(l.writeClaudeMd, false);
  assert.equal(l.evidence, 'evidence');
  assert.equal(c.common, path.join(ROOT, 'briefs', 'common.md'));
});

test('config: the init template (no lanes) is valid', () => {
  assert.deepEqual(parseConfig('{"common":"briefs/common.md","lanes":[]}', ROOT).errors, []);
});

test('config: bad JSON, missing fields, typos, duplicates and bad types are all reported', () => {
  assert.match(parseConfig('{lanes', ROOT).errors[0], /not valid JSON/);
  assert.match(parseConfig('{"lanes":{}}', ROOT).errors.join(), /"lanes" must be an array/);
  const errs = parseConfig(JSON.stringify({ lanez: [], lanes: [
    { id: 'a', cwd: 'x', brief: 'b', writeClaudeMD: true },
    { id: 'a', cwd: 'x', brief: 'b' },
    { id: 'Bad Id', brief: 'b', effort: 'extreme', addDirs: 'C:/x', writeClaudeMd: 'yes', iterMin: 1 },
  ] }), ROOT).errors.join('\n');
  for (const re of [/unknown top-level key "lanez"/, /unknown key "writeClaudeMD"/, /duplicate id/, /"id" must match/, /"cwd" is required/,
    /"effort" must be one of/, /"addDirs" must be an array/, /"writeClaudeMd" must be true or false/, /"iterMin" must be a number/]) assert.match(errs, re);
});

test('config: checkPaths names a missing cwd, brief and common file', () => {
  const c = parseConfig(JSON.stringify({ common: 'c.md', lanes: [{ id: 'a', cwd: 'C:/nope', brief: 'b.md' }] }), ROOT);
  const errs = checkPaths(c, () => false).join('\n');
  assert.match(errs, /lane "a": cwd does not exist/);
  assert.match(errs, /lane "a": brief not found/);
  assert.match(errs, /common brief not found/);
  assert.deepEqual(checkPaths(c, () => true), []);
});

// ---------------------------------------------------------------- phase clock
test('clock: nextAt is strictly after, rolls to tomorrow, rejects bad times', () => {
  assert.equal(nextAt('09:00', at(22, 0)).getTime(), at(9, 0, 3).getTime());
  assert.equal(nextAt('23:30', at(22, 0)).getTime(), at(23, 30).getTime());
  assert.equal(nextAt('22:00', at(22, 0)).getTime(), at(22, 0, 3).getTime());
  assert.throws(() => nextAt('25:00'), /bad time/);
  assert.throws(() => nextAt('9am'), /bad time/);
});

test('clock: an evening start plans tomorrow morning; a restart after freeze keeps today\'s freeze', () => {
  const t = planTimes({ until: '09:00', freeze: '07:30', reportAt: '08:15' }, at(22, 0));
  assert.deepEqual([t.freeze, t.report, t.until].map((d) => d.getTime()), [at(7, 30, 3), at(8, 15, 3), at(9, 0, 3)].map((d) => d.getTime()));
  const r = planTimes({}, at(7, 45, 3)); // supervisor restart past freeze
  assert.equal(r.freeze.getTime(), at(7, 30, 3).getTime());
  assert.equal(phaseAt(at(7, 45, 3).getTime(), r).phase, 'STABILIZE');
  assert.throws(() => planTimes({ until: '09:00', freeze: '08:30', reportAt: '08:00' }, at(22, 0)), /freeze <= report-at < until/);
});

test('clock: BUILD until freeze, STABILIZE until report-at, REPORT until 2 min before the deadline', () => {
  const t = planTimes({}, at(22, 0));
  assert.deepEqual(phaseAt(at(23, 0).getTime(), t), { phase: 'BUILD', boundary: t.freeze.getTime() });
  assert.deepEqual(phaseAt(at(7, 30, 3).getTime(), t), { phase: 'STABILIZE', boundary: t.report.getTime() });
  assert.deepEqual(phaseAt(at(8, 20, 3).getTime(), t), { phase: 'REPORT', boundary: t.until.getTime() - 120_000 });
});

// ---------------------------------------------------------------- prompt
test('prompt: common, brief, phase instruction and memory line, in that order', () => {
  const t = planTimes({}, at(22, 0));
  const p = buildPrompt({ laneId: 'visual-engine', n: 3, phase: 'BUILD', t, capAt: at(23, 30), now: at(22, 0), common: 'COMMON-RULES', brief: 'LANE-BRIEF' });
  assert.match(p, /lane "visual-engine", iteration 3, phase BUILD/);
  assert.match(p, new RegExp(`Freeze ${ts(t.freeze)}.*Deadline ${ts(t.until)}.*stopped at ${ts(at(23, 30))}`));
  const idx = ['COMMON-RULES', 'LANE-BRIEF', 'no "done" tonight', 'your memory is your JOURNAL.md (in the lane cwd) and git log; read them first'].map((s) => p.toLowerCase().indexOf(s.toLowerCase()));
  assert.ok(idx.every((i) => i >= 0), `all sections present: ${idx}`);
  assert.deepEqual([...idx].sort((a, b) => a - b), idx);
  assert.match(p, /Commit as you go/);
});

test('prompt: STABILIZE and REPORT instructions; empty common is omitted', () => {
  const t = planTimes({}, at(22, 0));
  const base = { laneId: 'a', n: 1, t, capAt: at(8, 0, 3), now: at(7, 40, 3), brief: 'B' };
  assert.match(buildPrompt({ ...base, phase: 'STABILIZE' }), /no new features.*keep the build green.*refresh the evidence/s);
  const rep = buildPrompt({ ...base, phase: 'REPORT' });
  assert.match(rep, /Write REPORT\.md in the lane cwd/);
  assert.doesNotMatch(rep, /Common rules/);
});

// ---------------------------------------------------------------- billing
const mkBilling = (o = {}) => { let now = o.now ?? at(22, 0).getTime(); const dir = tmp(); const b = createBilling({ file: path.join(dir, 'billing.json'), key: 'sk-test', now: () => now, ...o.opts }); return { b, dir, tick: (ms) => { now += ms; }, now: () => now }; };

test('billing: api-first picks api, then the subscription when api is blocked, then nothing', () => {
  const { b, tick } = mkBilling();
  assert.equal(b.pick(), 'api');
  b.block('api', at(22, 45).getTime(), 'credit balance is too low');
  assert.equal(b.pick(), 'subscription');
  b.block('subscription', at(23, 0).getTime(), 'usage limit');
  assert.equal(b.pick(), null);
  assert.equal(b.nextFree(), at(22, 45).getTime());
  tick(46 * 60_000); // past the api re-probe
  assert.equal(b.pick(), 'api');
});

test('billing: blocks persist in billing.json and are re-read (a --reset in another process unblocks)', () => {
  const { b, dir, now } = mkBilling();
  b.block('api', now() + 3_600_000, 'invalid x-api-key');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'billing.json'), 'utf8'));
  assert.equal(saved.blocked.api, now() + 3_600_000);
  assert.match(saved.reasons.api, /invalid x-api-key/);
  const other = createBilling({ file: path.join(dir, 'billing.json'), key: 'sk-test', now });
  other.sync(); other.blocked.api = 0; other.save();
  assert.equal(b.pick(), 'api');
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'billing.json'), 'utf8'), /sk-test/, 'the key is never written');
});

test('billing: no key or --billing subscription means subscription only; env never leaks a shell key', () => {
  const { b } = mkBilling({ opts: { key: null } });
  assert.equal(b.pick(), 'subscription');
  const { b: s } = mkBilling({ opts: { want: 'subscription' } });
  assert.deepEqual(s.order(), ['subscription']);
  const e = s.env({ ANTHROPIC_API_KEY: 'shell', ANTHROPIC_AUTH_TOKEN: 't', PATH: 'p' }, 'subscription');
  assert.deepEqual(e, { PATH: 'p' });
  assert.equal(s.env({}, 'api').ANTHROPIC_API_KEY, 'sk-test');
});

test('billing: the legacy {exhausted, at} file blocks api for the re-probe window', () => {
  const { b, dir, now } = mkBilling();
  fs.writeFileSync(path.join(dir, 'billing.json'), JSON.stringify({ exhausted: true, at: new Date(now()).toISOString() }));
  assert.equal(b.pick(), 'subscription');
});

test('billing: failure classification uses the error surface; drained only on api; resets are honoured', () => {
  const now = at(22, 0).getTime();
  assert.equal(classifyFailure({ mode: 'api', timedOut: false, errSurface: 'API Error: credit balance is too low', nowMs: now }).drained, true);
  assert.equal(classifyFailure({ mode: 'subscription', timedOut: false, errSurface: 'credit balance is too low' }).drained, false);
  const lim = classifyFailure({ mode: 'subscription', timedOut: false, errSurface: 'You hit your limit, resets 3am', nowMs: now });
  assert.equal(lim.limited, true);
  assert.equal(lim.resetAt, at(3, 0, 3).getTime() + 60_000);
  assert.equal(classifyFailure({ mode: 'api', timedOut: true, errSurface: '429 rate limit' }).limited, false, 'a timeout is not a limit');
  assert.equal(resetAt('Claude AI usage limit reached|1793000000', now), 1793000000 * 1000 + 60_000);
  assert.equal(resetAt('overloaded', now), now + 15 * 60_000);
});

test('billing: .env key spellings', () => {
  assert.equal(apiKeyFromText('X=1\nANTHROPIC_API_KEY="sk-a"\n'), 'sk-a');
  assert.equal(apiKeyFromText('ANTRHOPIC_API_KEY=sk-b\r\n'), 'sk-b');
  assert.equal(apiKeyFromText('OTHER=1'), null);
});

// ---------------------------------------------------------------- smoke (no claude session is launched)
test('smoke: init into a temp root, status with no lanes, run refuses with exit 2, init is re-runnable', () => {
  const root = tmp();
  const node = (...a) => spawnSync(process.execPath, [path.join(HERE, 'night.mjs'), ...a, '--root', root, '--dotenv', path.join(root, 'no.env')], { encoding: 'utf8' });
  const i = node('init');
  assert.equal(i.status, 0, i.stderr);
  for (const f of ['night.json', 'billing.json', 'briefs', 'briefs/common.md', 'logs']) assert.ok(fs.existsSync(path.join(root, f)), f);
  const s = node('status');
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /0 lane\(s\)/);
  assert.match(s.stdout, /subscription free/);
  const r = node('run');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no lanes to run/);
  fs.writeFileSync(path.join(root, 'night.json'), JSON.stringify({ common: 'briefs/common.md', lanes: [{ id: 'ghost', cwd: path.join(root, 'nope'), brief: 'briefs/common.md' }] }));
  const g = node('run');
  assert.equal(g.status, 2);
  assert.match(g.stderr, /lane "ghost": cwd does not exist/);
  assert.match(node('init').stdout, /nothing overwritten/);
  assert.equal(node('report').status, 0);
  assert.match(fs.readFileSync(path.join(root, 'SCOREBOARD.md'), 'utf8'), /\| ghost \| 0 \|/);
});

test('the 5-hour subscription limit is a LIMIT that waits for its reset (2026-11-03: 2.5 h of 2-minute retries)', () => {
  const now = new Date(2026, 10, 3, 13, 12).getTime();
  const r = classifyFailure({ mode: 'subscription', timedOut: false, errSurface: "You've hit your 5-hour limit · resets 3:40pm (Europe/Prague)", nowMs: now });
  assert.equal(r.limited, true);
  assert.equal(new Date(r.resetAt).getHours(), 15);
  assert.equal(new Date(r.resetAt).getMinutes(), 41);
  assert.equal(classifyFailure({ mode: 'subscription', timedOut: false, errSurface: '"api_error":"usage_limit_reached"', nowMs: now }).limited, true);
});

test('billing: the backup key (ANTHROPIC_API_KEY_BACKUP) is a second paid path between the primary key and the subscription', () => {
  const { b, tick } = mkBilling({ opts: { key2: 'sk-backup' } });
  assert.deepEqual(b.order(), ['api', 'api2', 'api3', 'subscription']);
  assert.equal(b.usable('api3'), false, 'no third key: its path is skipped');
  assert.equal(b.pick(), 'api');
  b.block('api', at(22, 45).getTime(), 'credit balance is too low');
  assert.equal(b.pick(), 'api2', 'the backup key takes over when the primary drains');
  assert.equal(b.env({ ANTHROPIC_API_KEY: 'sk-shell' }, 'api2').ANTHROPIC_API_KEY, 'sk-backup');
  assert.equal(b.env({}, 'api').ANTHROPIC_API_KEY, 'sk-test');
  assert.equal(b.env({ ANTHROPIC_API_KEY: 'sk-shell' }, 'subscription').ANTHROPIC_API_KEY, undefined);
  b.block('api2', at(22, 50).getTime(), 'credit balance is too low');
  assert.equal(b.pick(), 'subscription');
  assert.equal(classifyFailure({ mode: 'api2', timedOut: false, errSurface: 'credit balance is too low' }).drained, true);
  tick(46 * 60_000);
  assert.equal(b.pick(), 'api', 'the primary is re-probed first');
  const { b: none } = mkBilling();
  assert.equal(none.usable('api2'), false, 'no backup key: the path is skipped');
});

test('billing: backup key spellings and that the primary never matches the backup line', () => {
  assert.equal(backupKeyFromText('ANTHROPIC_API_KEY_BACKUP=sk-c\n'), 'sk-c');
  assert.equal(backupKeyFromText('ANTRHOPIC_API_KEY_BACKUP="sk-d"'), 'sk-d');
  assert.equal(apiKeyFromText('ANTHROPIC_API_KEY_BACKUP=sk-c\n'), null);
  assert.equal(backupKeyFromText('ANTHROPIC_API_KEY=sk-a'), null);
});

test('billing: the third key (ANTHROPIC_API_KEY_BACKUP_2) is spent after the backup key and before the subscription', () => {
  const { b } = mkBilling({ opts: { key2: 'sk-backup', key3: 'sk-backup2' } });
  b.block('api', at(22, 45).getTime(), 'credit balance is too low');
  b.block('api2', at(22, 45).getTime(), 'credit balance is too low');
  assert.equal(b.pick(), 'api3');
  assert.equal(b.env({ ANTHROPIC_API_KEY: 'sk-shell' }, 'api3').ANTHROPIC_API_KEY, 'sk-backup2');
  assert.equal(classifyFailure({ mode: 'api3', timedOut: false, errSurface: 'credit balance is too low' }).drained, true);
  b.block('api3', at(22, 50).getTime(), 'credit balance is too low');
  assert.equal(b.pick(), 'subscription');
  assert.match(b.line(), /backup key 2 blocked until/);
  const env = ['ANTHROPIC_API_KEY=sk-a', 'ANTHROPIC_API_KEY_BACKUP=sk-b', 'ANTHROPIC_API_KEY_BACKUP_2=sk-c', ''].join(String.fromCharCode(10));
  assert.equal(apiKeyFromText(env), 'sk-a');
  assert.equal(backupKeyFromText(env), 'sk-b', 'the backup line never takes the _2 line');
  assert.equal(backupKey2FromText(env), 'sk-c');
  assert.equal(backupKey2FromText('ANTHROPIC_API_KEY_BACKUP=sk-b'), null);
});

// ---------------------------------------------------------------- queue-empty pause
test('queueEmpty reads only the newest entry', () => {
  assert.equal(queueEmpty('old\nQUEUE EMPTY stands\nNEXT: nothing'), true);
  const buried = ['QUEUE EMPTY', ...Array.from({ length: 20 }, (_, i) => `line ${i}`)].join('\n');
  assert.equal(queueEmpty(buried), false, 'an old entry does not pause the lane');
  assert.equal(queueEmpty(''), false);
});

test('requestsFor counts only requests naming this lane', () => {
  const j = 'REQUEST 3 -> assets: the dead\nREQUEST 1 to world: walls\nno request here for assets';
  assert.equal(requestsFor('assets', j), 1);
  assert.equal(requestsFor('world', j), 1);
  assert.equal(requestsFor('perf', j), 0);
});
