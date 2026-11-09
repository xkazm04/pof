/**
 * Pure parts of the GTAI night runner (night.mjs): config parse + validate, the phase clock, prompt assembly,
 * billing pick/block and failure classification. No process spawning here; time is always injectable.
 */
import fs from 'node:fs';
import path from 'node:path';

export const ts = (d = new Date()) => new Date(d).toTimeString().slice(0, 5);

// ---------------------------------------------------------------- config
export const CONFIG_TEMPLATE = { common: 'briefs/common.md', lanes: [] };
const LANE_KEYS = new Set(['id', 'cwd', 'brief', 'model', 'effort', 'addDirs', 'writeClaudeMd', 'iterMin', 'evidence']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/** Validate a parsed night.json. Returns { common, lanes, errors }; paths come back absolute (relative = to root). */
export function validateConfig(raw, root) {
  const errors = [];
  const abs = (p) => path.resolve(root, String(p));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { common: null, lanes: [], errors: ['night.json must be a JSON object'] };
  for (const k of Object.keys(raw)) if (!['lanes', 'common'].includes(k) && !k.startsWith('_')) errors.push(`unknown top-level key "${k}"`);
  if (raw.common != null && typeof raw.common !== 'string') errors.push('"common" must be a path string');
  if (!Array.isArray(raw.lanes)) return { common: null, lanes: [], errors: [...errors, '"lanes" must be an array'] };
  const seen = new Set();
  const lanes = raw.lanes.map((l, i) => {
    const at = `lanes[${i}]${l?.id ? ` (${l.id})` : ''}`;
    if (!l || typeof l !== 'object') { errors.push(`${at} must be an object`); return null; }
    for (const k of Object.keys(l)) if (!LANE_KEYS.has(k) && !k.startsWith('_')) errors.push(`${at}: unknown key "${k}"`);
    if (typeof l.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(l.id)) errors.push(`${at}: "id" must match [a-z0-9-]+`);
    else if (seen.has(l.id)) errors.push(`${at}: duplicate id`); else seen.add(l.id);
    for (const k of ['cwd', 'brief']) if (typeof l[k] !== 'string' || !l[k]) errors.push(`${at}: "${k}" is required (a path string)`);
    for (const k of ['model', 'evidence']) if (l[k] != null && typeof l[k] !== 'string') errors.push(`${at}: "${k}" must be a string`);
    if (l.effort != null && !EFFORTS.has(l.effort)) errors.push(`${at}: "effort" must be one of ${[...EFFORTS].join('|')}`);
    if (l.addDirs != null && !(Array.isArray(l.addDirs) && l.addDirs.every((d) => typeof d === 'string'))) errors.push(`${at}: "addDirs" must be an array of path strings`);
    if (l.writeClaudeMd != null && typeof l.writeClaudeMd !== 'boolean') errors.push(`${at}: "writeClaudeMd" must be true or false`);
    if (l.iterMin != null && !(Number.isFinite(l.iterMin) && l.iterMin >= 5)) errors.push(`${at}: "iterMin" must be a number >= 5`);
    return {
      id: l.id, cwd: typeof l.cwd === 'string' ? abs(l.cwd) : null, brief: typeof l.brief === 'string' ? abs(l.brief) : null,
      model: l.model ?? null, effort: l.effort ?? null, iterMin: l.iterMin ?? null, writeClaudeMd: l.writeClaudeMd === true,
      addDirs: (Array.isArray(l.addDirs) ? l.addDirs : []).map(abs), evidence: String(l.evidence ?? 'evidence'),
    };
  }).filter(Boolean);
  return { common: typeof raw.common === 'string' ? abs(raw.common) : null, lanes, errors };
}

export function parseConfig(text, root) {
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { common: null, lanes: [], errors: [`night.json is not valid JSON: ${e.message}`] }; }
  return validateConfig(raw, root);
}

/** Things that only exist on disk: each lane's cwd and brief, and the common file. Returns error strings. */
export function checkPaths(cfg, exists = fs.existsSync) {
  const errs = [];
  if (cfg.common && !exists(cfg.common)) errs.push(`common brief not found: ${cfg.common}`);
  for (const l of cfg.lanes) {
    if (!exists(l.cwd)) errs.push(`lane "${l.id}": cwd does not exist: ${l.cwd} (create the worktree first, e.g. git worktree add)`);
    if (!exists(l.brief)) errs.push(`lane "${l.id}": brief not found: ${l.brief}`);
  }
  return errs;
}

// ---------------------------------------------------------------- phase clock
/** The next HH:MM strictly after `after`. */
export function nextAt(hhmm, after = new Date()) {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`bad time "${hhmm}" (HH:MM)`);
  const d = new Date(after);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d <= after) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * The deadline is the next --until; freeze and report-at are their last occurrences inside the 24 h before it, so a
 * supervisor restart at 07:45 with --freeze 07:30 resumes in STABILIZE instead of moving the freeze to tomorrow.
 */
export function planTimes({ until = '09:00', freeze = '07:30', reportAt = '08:15' } = {}, now = new Date()) {
  const u = nextAt(until, now);
  const anchor = new Date(u.getTime() - 24 * 3600_000);
  const t = { until: u, freeze: nextAt(freeze, anchor), report: nextAt(reportAt, anchor) };
  if (!(t.freeze <= t.report && t.report < t.until)) throw new Error('need freeze <= report-at < until');
  return t;
}

/** BUILD until freeze, STABILIZE until report-at, REPORT until the deadline (sessions end 2 min before it). */
export function phaseAt(nowMs, t) {
  if (nowMs < t.freeze.getTime()) return { phase: 'BUILD', boundary: t.freeze.getTime() };
  if (nowMs < t.report.getTime()) return { phase: 'STABILIZE', boundary: t.report.getTime() };
  return { phase: 'REPORT', boundary: t.until.getTime() - 2 * 60_000 };
}

// ---------------------------------------------------------------- prompt
export const PHASE_TEXT = {
  BUILD: 'BUILD phase: work the order in your brief, top to bottom. There is no "done" tonight: when an item is evidenced, start the next one; when the list is finished, raise the quality of the weakest item. Do not end the session early. Commit as you go (small commits, on this branch).',
  STABILIZE: 'STABILIZE phase (past freeze): no new features. Fix bugs, keep the build green, refresh the evidence so it matches the current build. Commit as you go.',
  REPORT: 'REPORT phase: build nothing new. Write REPORT.md in the lane cwd: what works (each claim with an evidence path or command), what does not, what blocked you and for how long, and the next steps. Check every evidence path you cite exists. Commit.',
};

export function buildPrompt({ laneId, n, phase, t, capAt, now = new Date(), common = '', brief = '', evidence = 'evidence' }) {
  const head = `GTAI night lane "${laneId}", iteration ${n}, phase ${phase}.
Now ${ts(now)}. Freeze ${ts(t.freeze)}. Report ${ts(t.report)}. Deadline ${ts(t.until)}. This session is stopped at ${ts(capAt)} at the latest.
Evidence goes under ${evidence}/ in the lane cwd.`;
  const parts = [head];
  if (common.trim()) parts.push(`## Common rules\n\n${common.trim()}`);
  if (brief.trim()) parts.push(`## Your brief\n\n${brief.trim()}`);
  parts.push(`## Phase\n\n${PHASE_TEXT[phase]}`);
  parts.push('Your memory is your JOURNAL.md (in the lane cwd) and git log; read them first (`git log --oneline -30`; create JOURNAL.md on iteration 1). Log MILESTONE / FRICTION / BLOCKED entries as you work, and before you stop append a NEXT: entry to JOURNAL.md.');
  return parts.join('\n\n---\n\n');
}

// ---------------------------------------------------------------- billing
// Owner rule (2026-11-01): spend the .env Anthropic key first, then fall back to the subscription. Never stop for
// billing: a drained or limited path is BLOCKED until a time, every iteration picks the first unblocked path, and a
// drained key is re-probed every API_REPROBE_MIN. billing.json is re-read before every pick, so `billing --reset`
// unblocks a path in a running night.
export const API_REPROBE_MIN = 45;
export const API_DRAINED = /credit balance is too low|insufficient[_ ]credit|specified API usage limits|API usage limits|billing|payment required|\b402\b|invalid x-api-key|invalid api key|authentication_error|permission_error/i;
export const LIMITED = /usage limit|usage_limit_reached|limit reached|hit your (?:[\w-]+ )?limit|rate.?limit|\b429\b|overloaded|quota/i;

export function apiKeyFromText(text) {
  const m = String(text ?? '').match(/^\s*(?:ANTHROPIC_API_KEY|ANTRHOPIC_API_KEY)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

/** The second paid key (owner, 2026-11-05): ANTHROPIC_API_KEY_BACKUP, used once the primary key is drained. Never printed. */
export function backupKeyFromText(text) {
  const m = String(text ?? '').match(/^\s*(?:ANTHROPIC_API_KEY_BACKUP|ANTRHOPIC_API_KEY_BACKUP)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

/** The third paid key (owner, 2026-11-07): ANTHROPIC_API_KEY_BACKUP_2, used once the first two are drained. Never printed. */
export function backupKey2FromText(text) {
  const m = String(text ?? '').match(/^\s*(?:ANTHROPIC_API_KEY_BACKUP_2|ANTRHOPIC_API_KEY_BACKUP_2)\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
  return m ? m[1].trim() : null;
}

/** 'api', 'api2' and 'api3' are the primary key and the two backup keys: paid paths that can drain, spent in that order. */
export const API_PATHS = ['api', 'api2', 'api3'];
export const isApi = (m) => API_PATHS.includes(m);

/** When a limit names its reset, wait exactly that long (+1 min); otherwise 15 min. */
export function resetAt(text, nowMs = Date.now()) {
  const epoch = text.match(/limit reached\|(\d{10})/);
  if (epoch) return Number(epoch[1]) * 1000 + 60_000;
  const clock = text.match(/resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (clock) {
    let h = Number(clock[1]) % 12; if (/pm/i.test(clock[3])) h += 12;
    return nextAt(`${h}:${clock[2] ?? '00'}`, new Date(nowMs)).getTime() + 60_000;
  }
  return nowMs + 15 * 60_000;
}

/** Judge drainage on error surfaces only, never on what the agent wrote (the game has a boss "Triage & Billing"). */
export function classifyFailure({ mode, timedOut, errSurface, nowMs = Date.now() }) {
  const drained = isApi(mode) &&!timedOut && API_DRAINED.test(errSurface);
  const limited = !drained && !timedOut && LIMITED.test(errSurface);
  return {
    drained, drainReason: drained ? `${errSurface.match(API_DRAINED)?.[0] ?? ''} ${errSurface.trim().slice(0, 200)}` : null,
    limited, limitReason: limited ? errSurface.trim().slice(0, 300) : null, resetAt: limited ? resetAt(errSurface, nowMs) : null,
  };
}

export function createBilling({ file, key = null, key2 = null, key3 = null, want = 'api-first', now = () => Date.now(), log = () => {} }) {
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8') || '{}'); } catch { return {}; } };
  return {
    mode: 'subscription', key, key2, key3, want, blocked: { api: 0, api2: 0, api3: 0, subscription: 0 }, reasons: {},
    sync() {
      const saved = read();
      if (saved.blocked) { this.blocked = { api: 0, api2: 0, api3: 0, subscription: 0, ...saved.blocked }; this.reasons = saved.reasons ?? {}; }
      else if (saved.exhausted) this.blocked.api = Date.parse(saved.at) + API_REPROBE_MIN * 60_000; // the pre-2026-11-01 shape
    },
    save() {
      const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
      fs.writeFileSync(file, JSON.stringify({ blocked: this.blocked, until: { api: iso(this.blocked.api), api2: iso(this.blocked.api2), api3: iso(this.blocked.api3), subscription: iso(this.blocked.subscription) }, reasons: this.reasons, updated: new Date(now()).toISOString() }, null, 2));
    },
    order() { return this.want === 'subscription' ? ['subscription'] : this.want === 'api' ? [...API_PATHS] : [...API_PATHS, 'subscription']; },
    keyFor(m) { return m === 'api' ? this.key : m === 'api2' ? this.key2 : m === 'api3' ? this.key3 : null; },
    usable(m) { return m === 'subscription' || !!this.keyFor(m); },
    pick() {
      this.sync();
      const m = this.order().find((x) => this.usable(x) && this.blocked[x] <= now()) ?? null;
      if (m) this.mode = m;
      return m;
    },
    nextFree() { return Math.min(...this.order().filter((x) => this.usable(x)).map((x) => this.blocked[x])); },
    block(m, untilMs, reason) {
      this.sync();
      this.blocked[m] = Math.max(this.blocked[m] ?? 0, untilMs);
      this.reasons[m] = `${new Date(now()).toISOString()} ${reason.slice(0, 240).replace(/\s+/g, ' ')}`;
      this.save();
      const next = this.order().find((x) => x !== m && this.usable(x) && this.blocked[x] <= now());
      log(`billing: ${m} blocked until ${ts(new Date(this.blocked[m]))} (${reason.slice(0, 100).replace(/\s+/g, ' ')}) - ${next ? `lanes continue on ${next}` : 'no path free: lanes wait'}`);
    },
    /** A child env for path m: never inherit a stray key from the shell; set the .env key only for an api path. */
    env(base, m = this.mode) {
      const e = { ...base };
      delete e.ANTHROPIC_API_KEY; delete e.ANTHROPIC_AUTH_TOKEN;
      if (isApi(m)) e.ANTHROPIC_API_KEY = this.keyFor(m);
      return e;
    },
    line() {
      this.sync();
      const bl = (m) => (this.blocked[m] > now() ? `blocked until ${ts(new Date(this.blocked[m]))}` : 'free');
      const next = this.order().find((x) => this.usable(x) && this.blocked[x] <= now()) ?? 'nothing (waiting)';
      return `API key ${this.key ? bl('api') : 'absent'}, backup key ${this.key2 ? bl('api2') : 'absent'}, backup key 2 ${this.key3 ? bl('api3') : 'absent'}, subscription ${bl('subscription')} -> next iteration uses ${next}`;
    },
  };
}

// ---------------------------------------------------------------- queue-empty pause
/** Does the lane's newest journal entry say it has nothing left to build? Only the tail counts: an old entry can say so too. */
export function queueEmpty(journal, tailLines = 15) {
  return /\bQUEUE EMPTY\b/.test(String(journal).split('\n').filter((l) => l.trim()).slice(-tailLines).join('\n'));
}

/** How many REQUEST lines in a sibling's journal name this lane: a new one ends the pause. */
export function requestsFor(laneId, text) {
  const pattern = new RegExp(String.raw`\bREQUEST\b.*(->|to)\s*${'`'}?${laneId.replace(/[^\w-]/g, '')}\b`);
  return String(text).split('\n').filter((l) => pattern.test(l)).length;
}
