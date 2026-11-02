/**
 * Pure parsers for the files a `contracts` row reads (client-safe; the fs reads live in `contractsRead.ts`).
 *
 * `parseQuestPackage` is the Plan step's own criterion "the package parses as `gtai.quest/1`": the fields
 * the guards and the steps dereference must be present with their wire types. It is deliberately NOT
 * stricter than `types.ts` (e.g. a line's `audio` key is the Package step's criterion, not a parse error),
 * and it never repairs a value — a wrong type is an error naming the path.
 */
import { ACT_IDS, LINE_JUDGE_SCHEMA, QUEST_SCHEMA } from '@/lib/games/gtai-quest/types';
import type { LineJudgeReport, QuestPackage } from '@/lib/games/gtai-quest/types';
import type { Result } from '@/types/result';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** First failing check as `path: expected`, or null when every check holds. */
function firstError(checks: readonly [boolean, string][]): string | null {
  const bad = checks.find(([ok]) => !ok);
  return bad ? bad[1] : null;
}

function arrayOf(v: unknown, path: string, item: (x: unknown, p: string) => string | null): string | null {
  if (!Array.isArray(v)) return `${path}: expected an array`;
  for (let i = 0; i < v.length; i++) {
    const e = item(v[i], `${path}[${i}]`);
    if (e) return e;
  }
  return null;
}

const strFields = (o: unknown, path: string, keys: readonly string[]): string | null => {
  if (!isObj(o)) return `${path}: expected an object`;
  const k = keys.find((key) => !isStr(o[key]));
  return k ? `${path}.${k}: expected a string` : null;
};

/** Parse one `quest.json`. `folderId` is the folder it was read from; the package id must equal it. */
export function parseQuestPackage(raw: unknown, folderId: string): Result<QuestPackage, string> {
  if (!isObj(raw)) return { ok: false, error: 'quest.json: expected a JSON object' };
  const p = raw;
  const reward = p.reward, diff = p.difficulty, story = p.story, prov = p.provenance;
  const head = firstError([
    [p.schema === QUEST_SCHEMA, `schema: expected "${QUEST_SCHEMA}", got ${JSON.stringify(p.schema)}`],
    [isStr(p.id) && p.id === folderId, `id: expected "${folderId}" (the folder name), got ${JSON.stringify(p.id)}`],
    [isStr(p.act) && (ACT_IDS as readonly string[]).includes(p.act), `act: expected one of ${ACT_IDS.join(', ')}`],
    [isStr(p.status), 'status: expected a string'],
    [isStr(p.title) && p.title.trim().length > 0, 'title: expected a non-empty string'],
    [isStr(p.logline) && isStr(p.goal) && isStr(p.whyNotFiller), 'logline/goal/whyNotFiller: expected strings'],
    [isObj(reward) && isNum(reward.cash) && Array.isArray(reward.unlocks), 'reward: expected { cash: number, unlocks: [] }'],
    [isObj(diff) && isNum(diff.heatPeak) && isNum(diff.enemyCount) && isNum(diff.enemyWaves) && isNum(diff.minutes)
      && (diff.timeLimitS === null || isNum(diff.timeLimitS)) && Array.isArray(diff.failStates),
      'difficulty: expected { heatPeak, enemyCount, enemyWaves, minutes: number, timeLimitS: number|null, failStates: [] }'],
    [isObj(story) && Array.isArray(story.reads) && Array.isArray(story.writes), 'story: expected { reads: [], writes: [] }'],
    [isObj(prov) && Array.isArray(prov.sources) && isStr(prov.ownerNotes) && isStr(prov.fusedAt),
      'provenance: expected { sources: [], ownerNotes: string, fusedAt: string }'],
    [Array.isArray(p.overrides), 'overrides: expected an array'],
  ]);
  if (head) return { ok: false, error: head };
  const nested =
    strFields(p.fingerprint, 'fingerprint', ['giver', 'coreVerb', 'location', 'payoffKind'])
    ?? arrayOf(p.characters, 'characters', (c, at) => strFields(c, at, ['id', 'name', 'status', 'role']))
    ?? arrayOf(p.beats, 'beats', (b, at) => strFields(b, at, ['id', 'title', 'summary'])
      ?? (isObj(b) && isObj(b.objective) && isStr(b.objective.verb) ? null : `${at}.objective.verb: expected a string`)
      ?? (isObj(b) && Array.isArray(b.lineIds) ? null : `${at}.lineIds: expected an array`))
    ?? arrayOf(p.lines, 'lines', (l, at) => strFields(l, at, ['id', 'speaker', 'text'])
      ?? (isObj(l) && Array.isArray(l.purpose) ? null : `${at}.purpose: expected an array`))
    ?? arrayOf(p.mechanics, 'mechanics', (m, at) => strFields(m, at, ['id', 'name', 'status', 'home', 'summary']))
    ?? arrayOf((prov as Obj).sources, 'provenance.sources', (s, at) => strFields(s, at, ['pathId'])
      ?? (isObj(s) && Array.isArray(s.elements) ? null : `${at}.elements: expected an array`))
    ?? arrayOf(p.overrides, 'overrides', (o, at) => strFields(o, at, ['guard', 'reason', 'at']));
  if (nested) return { ok: false, error: nested };
  return { ok: true, data: raw as unknown as QuestPackage };
}

/** `provenance.runId` when a package records it. Not in `gtai.quest/1` yet — read leniently, never required. */
export function declaredRunId(raw: unknown): string | null {
  const prov = isObj(raw) ? raw.provenance : null;
  const id = isObj(prov) ? prov.runId : null;
  return isStr(id) && id.trim() ? id.trim() : null;
}

/** Parse `verdicts/lines.judge.json` as a `gtai.lineJudge/1` report. */
export function parseLineJudge(raw: unknown): Result<LineJudgeReport, string> {
  if (!isObj(raw)) return { ok: false, error: 'expected a JSON object' };
  const err = firstError([
    [raw.schema === LINE_JUDGE_SCHEMA, `schema: expected "${LINE_JUDGE_SCHEMA}"`],
    [raw.judgeSeat === 'claude' || raw.judgeSeat === 'grok', 'judgeSeat: expected "claude" or "grok"'],
    [raw.authorSeat === 'claude' || raw.authorSeat === 'grok', 'authorSeat: expected "claude" or "grok"'],
    [isStr(raw.judgedAt), 'judgedAt: expected a string'],
    [Array.isArray(raw.lines) && raw.lines.every((l) => isObj(l) && isStr(l.lineId) && isNum(l.earned) && isNum(l.voiceFit)),
      'lines: expected [{ lineId, earned, voiceFit, note }]'],
  ]);
  return err ? { ok: false, error: err } : { ok: true, data: raw as unknown as LineJudgeReport };
}

/** `evidence/selftest.json` → its `state` (and an optional `frame` file name it names). */
export function parseSelftest(raw: unknown): Result<{ state: string; frame?: string }, string> {
  if (!isObj(raw) || !isStr(raw.state)) return { ok: false, error: 'expected { state: string, frame?: string }' };
  return { ok: true, data: { state: raw.state, ...(isStr(raw.frame) ? { frame: raw.frame } : {}) } };
}

/** `seats.json` in either shape (`{ claude: {status, reason} }` or `[{ seat, status, reason }]`), never throwing. */
export function parseSeats(raw: unknown): { seat: string; state: string; reason?: string }[] {
  const one = (seat: string, v: unknown) => {
    const o = isObj(v) ? v : {};
    const state = isStr(o.status) ? o.status : isStr(o.state) ? o.state : 'unrecorded';
    return { seat, state, ...(isStr(o.reason) && o.reason ? { reason: o.reason } : {}) };
  };
  if (Array.isArray(raw)) return raw.filter((s) => isObj(s) && isStr(s.seat)).map((s) => one((s as Obj).seat as string, s));
  const seats = isObj(raw) && isObj(raw.seats) ? raw.seats : raw;
  if (!isObj(seats)) return [];
  return Object.entries(seats).filter(([, v]) => isObj(v)).map(([k, v]) => one(k, v));
}
