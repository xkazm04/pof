// Run with: node --test games/gtai/night/control.break.test.mjs
// Contract tests deliberately remain red when the implementation violates a promise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readControl, writeControl, stopRequested, stopNow, scheduleWith,
  holdForReserve, laneHealth, runnerStart, lastActivity, lanesToKill, readTimes, writeTimes,
} from './control.mjs';
import { planTimes, ts } from './lib.mjs';

// Local calendar times match planTimes/ts without assuming the host timezone.
const at = (day, h, m = 0) => new Date(2026, 10, day, h, m, 0, 0);
const minute = 60_000;
const attack = (name, fn) => test(name, { timeout: 60_000 }, fn);
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'night-control-break-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

attack('readControl returns {} for an absent file and an unreadable directory path', (t) => {
  const dir = temp(t);
  assert.deepEqual(readControl(path.join(dir, 'absent.json')), {});
  // Portable read failure; chmod does not reliably deny access on Windows or as root.
  assert.deepEqual(readControl(dir), {});
});

for (const text of ['null', '{"stop":true,', '', '{"stopLanes":["assets"]']) {
  attack(`readControl makes damaged content ${JSON.stringify(text)} inert instead of stopping a night`, (t) => {
    const file = path.join(temp(t), 'control.json');
    fs.writeFileSync(file, text);
    const control = readControl(file);
    assert.deepEqual(control, {});
    assert.equal(stopRequested(control, 'assets'), false);
    assert.equal(stopNow(control), false);
  });
}

for (const text of ['[]', '[{"stop":true,"now":true}]', '42']) {
  attack(`readControl keeps readable non-object JSON ${text} harmless to live consumers`, (t) => {
    const file = path.join(temp(t), 'control.json');
    fs.writeFileSync(file, text);
    const control = readControl(file);
    // The comment does not explicitly require normalizing readable arrays/numbers to {}.
    assert.equal(stopRequested(control, 'assets'), false);
    assert.equal(stopNow(control), false);
    const now = at(10, 20);
    const times = planTimes({}, now);
    assert.deepEqual(scheduleWith(times, control, now), { t: times, changed: false });
  });
}

attack('writeControl merges without losing unrelated fields and stamps at instead of trusting a supplied stamp', (t) => {
  const file = path.join(temp(t), 'control.json');
  fs.writeFileSync(file, JSON.stringify({ until: '09:00', stopLanes: ['assets'], now: true, at: 'old' }));
  const fixed = Date.parse('2026-11-10T20:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now: fixed });
  const patch = Object.freeze({ stopLanes: ['world'], now: false, at: 'forged' });
  const expected = { until: '09:00', stopLanes: ['world'], now: false, at: new Date(fixed).toISOString() };
  assert.deepEqual(writeControl(file, patch), expected);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected);
  assert.equal(patch.at, 'forged');
});

for (const text of [null, 'null', '{"stop":true,']) {
  attack(`writeControl merges into ${text === null ? 'an absent file' : JSON.stringify(text)} and stamps the recovered file`, (t) => {
    const file = path.join(temp(t), 'control.json');
    if (text !== null) fs.writeFileSync(file, text);
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-10T20:00:00.000Z') });
    const result = writeControl(file, { freeze: '07:30' });
    assert.deepEqual(result, { freeze: '07:30', at: '2026-11-10T20:00:00.000Z' });
    assert.deepEqual(readControl(file), result);
  });
}

for (const stopLanes of ['assets', { length: 1, 0: 'assets' }, 1, null, []]) {
  attack(`stopRequested ignores non-lists or empty stopLanes ${JSON.stringify(stopLanes)} and string stop`, () => {
    assert.equal(stopRequested({ stop: 'true', stopLanes }, 'assets'), false);
    assert.equal(stopRequested({ stop: true, stopLanes }, 'other'), true);
  });
  attack(`stopNow requires a real stop rather than stopLanes ${JSON.stringify(stopLanes)} with now true`, () => {
    assert.equal(stopNow({ stop: 'true', now: true, stopLanes }), false);
  });
}

attack('stopRequested matches whole lane names and stopNow requires boolean now as well as a stop', () => {
  const control = { stopLanes: ['assets'], now: true };
  assert.equal(stopRequested(control, 'assets'), true);
  for (const lane of ['asset', 'Assets', 'world']) assert.equal(stopRequested(control, lane), false);
  assert.equal(stopNow(control), true);
  assert.equal(stopNow({ stop: true, now: true }), true);
  for (const now of [undefined, false, 'true', 1]) {
    assert.equal(stopNow({ stop: true, now }), false);
    assert.equal(stopNow({ stopLanes: ['assets'], now }), false);
  }
});

function scheduleAttack(name, control, now, check) {
  attack(name, () => {
    const times = planTimes({}, now);
    const original = structuredClone(times);
    const input = structuredClone(control);
    const result = scheduleWith(times, control, now);
    assert.deepEqual(times, original, 'the existing night must not be mutated');
    assert.deepEqual(control, input, 'reading control must not mutate it');
    check(result, times);
  });
}
const rejects = (result) => {
  assert.equal(typeof result.error, 'string', 'invalid schedule must return an error');
  assert.ok(result.error.length > 0);
  assert.equal(result.t, undefined, 'an error must not supply a replacement schedule');
};

scheduleAttack('scheduleWith returns the same t and changed false when no time is named',
  { stop: true, now: true, at: 'ignored' }, at(10, 20), (r, t) => {
    assert.deepEqual(r, { t, changed: false });
    assert.equal(r.t, t);
  });
scheduleAttack('scheduleWith reports unchanged when explicitly supplied times equal the current schedule',
  { until: '09:00', freeze: '07:30', reportAt: '08:15' }, at(10, 20), (r, t) => {
    assert.deepEqual(r, { t, changed: false });
  });
scheduleAttack('scheduleWith changes only until when extending the current deadline',
  { until: '10:00' }, at(10, 20), (r, t) => {
    assert.equal(r.changed, true);
    assert.notEqual(r.t, t);
    assert.equal(r.t.until.getTime(), at(11, 10).getTime());
    assert.equal(r.t.freeze.getTime(), t.freeze.getTime());
    assert.equal(r.t.report.getTime(), t.report.getTime());
  });
scheduleAttack('scheduleWith rejects an until-only change before the existing freeze and report instead of moving unnamed times back a day',
  { until: '07:00' }, at(10, 20), rejects);

for (const key of ['until', 'freeze', 'reportAt']) {
  for (const value of ['', 0, false, 'soon', '24:00', '07:60', [], {}]) {
    scheduleAttack(`scheduleWith rejects bad ${key} value ${JSON.stringify(value)} and leaves the night alone`,
      { [key]: value }, at(10, 20), rejects);
  }
}
scheduleAttack('scheduleWith rejects a freeze after report-at',
  { freeze: '08:30', reportAt: '08:00' }, at(10, 20), rejects);
scheduleAttack('scheduleWith rejects report-at equal to until',
  { reportAt: '09:00' }, at(10, 20), rejects);
scheduleAttack('scheduleWith permits freeze equal to report-at when both are still in the future',
  { freeze: '08:00', reportAt: '08:00' }, at(10, 20), (r) => {
    assert.equal(r.changed, true);
    assert.equal(r.t.freeze.getTime(), r.t.report.getTime());
  });
scheduleAttack('scheduleWith rejects a freeze exactly equal to now',
  { freeze: '07:30' }, at(11, 7, 30), rejects);
scheduleAttack('scheduleWith rejects a freeze that already passed',
  { freeze: '07:30' }, at(11, 7, 31), rejects);
scheduleAttack('scheduleWith rejects report-at that already passed',
  { reportAt: '08:15' }, at(11, 8, 16), rejects);
scheduleAttack('scheduleWith rejects report-at exactly equal to now',
  { reportAt: '08:15' }, at(11, 8, 15), rejects);
scheduleAttack('scheduleWith resolves report-at across midnight relative to the deadline with a 07:30 freeze',
  { reportAt: '08:30' }, at(10, 23, 50), (r, t) => {
    assert.equal(r.changed, true);
    assert.equal(r.t.report.getTime(), at(11, 8, 30).getTime());
    assert.equal(r.t.freeze.getTime(), at(11, 7, 30).getTime());
    assert.equal(ts(r.t.freeze), '07:30');
    assert.equal(r.t.until.getTime(), t.until.getTime());
  });

const reserve = {
  phase: 'BUILD', freezeMs: at(11, 7, 30).getTime(),
  nowMs: at(11, 6).getTime(), reserveMin: 90, open: ['subscription'],
};
attack('holdForReserve includes the exact reserve boundary and excludes one millisecond before it', () => {
  assert.equal(holdForReserve(reserve), true);
  assert.equal(holdForReserve({ ...reserve, nowMs: reserve.nowMs - 1 }), false);
  assert.equal(holdForReserve({ ...reserve, nowMs: reserve.nowMs + 1 }), true);
});
for (const [field, value] of [
  ['phase', 'STABILIZE'], ['phase', 'REPORT'], ['phase', 'build'],
  ['reserveMin', 0], ['reserveMin', -1], ['open', []], ['open', ['api', 'subscription']],
]) {
  attack(`holdForReserve requires every gate even at the boundary: ${field}=${JSON.stringify(value)}`, () => {
    assert.equal(holdForReserve({ ...reserve, [field]: value }), false);
  });
}

const health = {
  nowMs: at(11, 8).getTime(), runnerStartMs: at(11, 6).getTime(),
  finished: false, reported: false, iterations: 1,
  lastActivityMs: at(11, 7, 30).getTime(), quietMin: 30,
};
for (const [promise, patch, expected] of [
  ['reported precedes finished, missing runner, no iterations and silence', { reported: true, finished: true, runnerStartMs: null, iterations: 0, lastActivityMs: 0 }, 'reported'],
  ['finished precedes missing runner, no iterations and silence', { finished: true, runnerStartMs: null, iterations: 0, lastActivityMs: 0 }, 'finished'],
  ['missing runner precedes even a recent iteration', { runnerStartMs: null, lastActivityMs: health.nowMs }, 'never-started'],
  ['no iteration after fifteen minutes precedes recent activity', { iterations: 0, lastActivityMs: health.nowMs }, 'never-started'],
  ['exactly fifteen minutes without an iteration is starting', { iterations: 0, runnerStartMs: health.nowMs - 15 * minute, lastActivityMs: 0 }, 'starting'],
  ['one millisecond beyond fifteen minutes without an iteration is never-started', { iterations: 0, runnerStartMs: health.nowMs - 15 * minute - 1 }, 'never-started'],
  ['starting precedes silence', { iterations: 0, runnerStartMs: health.nowMs - minute, lastActivityMs: 0 }, 'starting'],
  ['exact quietMin boundary is ok', {}, 'ok'],
  ['one millisecond beyond quietMin is silent', { lastActivityMs: health.lastActivityMs - 1 }, 'silent'],
  ['one millisecond before quietMin is ok', { lastActivityMs: health.lastActivityMs + 1 }, 'ok'],
]) {
  attack(`laneHealth promise: ${promise}`, () => {
    assert.equal(laneHealth({ ...health, ...patch }).state, expected);
  });
}

const first = '2026-11-10T19:00:00.000Z';
const second = '2026-11-10T21:00:00.000Z';
for (const eol of ['\n', '\r\n']) {
  attack(`runnerStart reads the newest billing block and ignores an earlier finish with ${JSON.stringify(eol)} lines`, () => {
    const lines = [
      `[${first}] run: billing api`,
      '[2026-11-10T20:00:00.000Z] run: all lanes finished',
      `[${second}] run: billing subscription`,
      '[2026-11-10T21:01:00.000Z] assets: iteration 1',
    ];
    assert.deepEqual(runnerStart(lines.join(eol) + eol), { runnerStartMs: Date.parse(second), finished: false });
    assert.deepEqual(runnerStart([...lines, '[2026-11-10T22:00:00.000Z] run: all lanes finished'].join(eol)),
      { runnerStartMs: Date.parse(second), finished: true });
  });
}
attack('runnerStart returns null and not finished when there is no billing run block', () => {
  for (const text of ['', 'noise', '[2026-11-10T20:00:00.000Z] run: all lanes finished']) {
    assert.deepEqual(runnerStart(text), { runnerStartMs: null, finished: false });
  }
});
attack('runnerStart promises a usable start time or null rather than NaN for a non-date bracket stamp', () => {
  const result = runnerStart(`[${first}] run: billing api\n[not-a-date] run: billing subscription\n`);
  // No exact fallback is specified for a corrupt stamp. Either null or finite milliseconds
  // can represent the documented result; NaN cannot measure when the runner started.
  assert.ok(result.runnerStartMs === null || Number.isFinite(result.runnerStartMs),
    'a non-date stamp must not leak NaN into the health clock');
  assert.equal(result.finished, false);
});

attack('lastActivity returns 0 for missing and empty directories', (t) => {
  const dir = temp(t);
  assert.equal(lastActivity(path.join(dir, 'absent')), 0);
  assert.equal(lastActivity(dir), 0);
});
attack('lastActivity selects the newest mtime regardless of filename order, including a subdirectory entry', (t) => {
  const dir = temp(t);
  const entries = ['a-new.log', 'z-old.log', 'nested'].map((n) => path.join(dir, n));
  fs.writeFileSync(entries[0], 'new');
  fs.writeFileSync(entries[1], 'old');
  fs.mkdirSync(entries[2]);
  fs.writeFileSync(path.join(entries[2], 'child.log'), 'nested entry');
  const times = [at(11, 7), at(11, 5), at(11, 6)];
  // Pin all mtimes; directory creation must not introduce wall-clock expectations.
  fs.utimesSync(path.join(entries[2], 'child.log'), at(11, 4), at(11, 4));
  entries.forEach((entry, i) => fs.utimesSync(entry, times[i], times[i]));
  assert.equal(lastActivity(dir), fs.statSync(entries[0]).mtimeMs);
  fs.utimesSync(entries[2], at(11, 8), at(11, 8));
  assert.equal(lastActivity(dir), fs.statSync(entries[2]).mtimeMs);
});

// Found in review of this file, not by the tester: the --now poll killed every lane's session.
attack('stop --lane x --now kills only lane x, a whole-night --now kills all, a plain stop kills none', () => {
  const lanes = ['hero', 'combat', 'tools'];
  assert.deepEqual(lanesToKill({ stopLanes: ['hero'], now: true }, lanes), ['hero']);
  assert.deepEqual(lanesToKill({ stop: true, now: true }, lanes), lanes);
  assert.deepEqual(lanesToKill({ stopLanes: ['hero'] }, lanes), []);
  assert.deepEqual(lanesToKill({ stopLanes: 'hero', now: true }, lanes), []);
});

attack('published times round-trip, and absent, damaged or past-deadline times read as null', (t) => {
  const file = path.join(temp(t), 'times.json');
  const now = at(10, 0, 30);
  const night = planTimes({ until: '08:00', freeze: '07:30', reportAt: '07:40' }, now);
  assert.equal(readTimes(file, now), null);
  writeTimes(file, night);
  assert.deepEqual(readTimes(file, now), night);
  assert.equal(readTimes(file, at(10, 8, 1)), null, 'a finished night is no running night');
  fs.writeFileSync(file, '{"until":"x","freeze":"y","report":"z"}');
  assert.equal(readTimes(file, now), null);
});
