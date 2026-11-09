/**
 * Live control of a running night and the health flags that spot a dead loop. A supervisor holds its config in memory,
 * so a running night could not be stopped or re-timed without killing it; this is a small file it re-reads instead.
 * The runner's own PIDs are the only ones ever killed (repo law); `stop` without --now lets the session in flight end.
 * Pure except readControl/writeControl and lastActivity/runnerStart, which read files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { planTimes, ts } from './lib.mjs';

export const CONTROL_FILE = 'control.json';

/** {} when absent or unreadable: a damaged control file must never stop a night. */
export function readControl(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) ?? {}; } catch { return {}; }
}

/** Merges `patch` into the control file, stamping when. */
export function writeControl(file, patch) {
  const next = { ...readControl(file), ...patch, at: new Date().toISOString() };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

/** Should this lane stop? `stop: true` is the whole night; `stopLanes` names lanes. */
export const stopRequested = (control, laneId) => control.stop === true || (Array.isArray(control.stopLanes) && control.stopLanes.includes(laneId));

/** True when the running sessions must be killed rather than allowed to end. */
export const stopNow = (control) => control.now === true && (control.stop === true || (control.stopLanes?.length ?? 0) > 0);

/** The times with any control change applied: {t, changed} or {error}. A bad value leaves the night alone. */
export function scheduleWith(t, control, now = new Date()) {
  if (!control.until && !control.freeze && !control.reportAt) return { t, changed: false };
  try {
    const next = planTimes({ until: control.until ?? ts(t.until), freeze: control.freeze ?? ts(t.freeze), reportAt: control.reportAt ?? ts(t.report) }, now);
    for (const [name, value, when] of [['freeze', control.freeze, next.freeze], ['report-at', control.reportAt, next.report]]) {
      if (value && when <= now) return { error: `${name} ${value} has already passed` };
    }
    const changed = next.until.getTime() !== t.until.getTime() || next.freeze.getTime() !== t.freeze.getTime() || next.report.getTime() !== t.report.getTime();
    return { t: next, changed };
  } catch (e) { return { error: e.message }; }
}

/**
 * The reserve: within `reserveMin` of the freeze, a BUILD session may not take the last open billing path, so the
 * freeze and report sessions always have something to run on (open risk: every path ran out at 09:08 on 2026-11-08).
 */
export function holdForReserve({ phase, nowMs, freezeMs, reserveMin, open }) {
  return phase === 'BUILD' && reserveMin > 0 && open.length === 1 && nowMs >= freezeMs - reserveMin * 60_000;
}

const minutes = (ms) => Math.round(ms / 60_000);

/**
 * One lane's health. never-started and silent are what must be loud: a dead sibling otherwise goes unseen for hours
 * (the asset loop stopped at 17:55 on 2026-11-08 and art requests waited 5-9 hours).
 */
export function laneHealth({ nowMs, runnerStartMs, finished, reported, iterations, lastActivityMs, quietMin }) {
  if (reported) return { state: 'reported' };
  if (finished) return { state: 'finished' };
  if (runnerStartMs === null) return { state: 'never-started', why: 'no runner log: this launch never started' };
  if (!iterations) {
    const waited = nowMs - runnerStartMs;
    return waited > 15 * 60_000 ? { state: 'never-started', why: `the runner started ${minutes(waited)} min ago and this lane has run no iteration` } : { state: 'starting' };
  }
  const quiet = nowMs - lastActivityMs;
  if (quiet > quietMin * 60_000) return { state: 'silent', why: `nothing written for ${minutes(quiet)} min (limit ${quietMin})` };
  return { state: 'ok' };
}

/** The newest modification time under a lane's log dir, or 0. */
export function lastActivity(dir) {
  let newest = 0;
  try {
    for (const n of fs.readdirSync(dir)) newest = Math.max(newest, fs.statSync(path.join(dir, n)).mtimeMs);
  } catch { /* no dir yet */ }
  return newest;
}

/** {runnerStartMs, finished} from the newest `run:` block in logs/runner.log; null when it never ran. */
export function runnerStart(logText) {
  const lines = String(logText).split('\n').filter(Boolean);
  let start = -1;
  lines.forEach((l, i) => { if (/\] run: billing /.test(l)) start = i; });
  if (start < 0) return { runnerStartMs: null, finished: false };
  const iso = /^\[([^\]]+)\]/.exec(lines[start])?.[1];
  return { runnerStartMs: Date.parse(iso), finished: lines.slice(start).some((l) => /run: all lanes finished/.test(l)) };
}
