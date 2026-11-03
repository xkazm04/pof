/**
 * Server-only (fs): reads a decision folder (`asks/*.json`, `answers.json`) into the board, and resolves the ONE
 * thing the media door may serve: a path an ask file lists for one of its options. Read-only; the lanes own both
 * file shapes (see `decisionTypes.ts`), so a malformed ask is reported as a problem and never repaired.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readLaneJsonFile } from '@/lib/games/laneJson';
import type {
  DecisionMedia, DecisionOption, DecisionProblem, DecisionsBoard, DecisionView, MediaKind,
} from './decisionTypes';

export const ASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MEDIA_TYPES: Record<string, { kind: MediaKind; mime: string }> = {
  '.png': { kind: 'image', mime: 'image/png' }, '.jpg': { kind: 'image', mime: 'image/jpeg' },
  '.jpeg': { kind: 'image', mime: 'image/jpeg' }, '.webp': { kind: 'image', mime: 'image/webp' },
  '.gif': { kind: 'image', mime: 'image/gif' }, '.mp4': { kind: 'video', mime: 'video/mp4' },
  '.webm': { kind: 'video', mime: 'video/webm' },
  // A lane's evidence is sometimes a table (gunplay's ttk.md): served as plain text, shown in a <pre>.
  '.md': { kind: 'text', mime: 'text/plain; charset=utf-8' }, '.txt': { kind: 'text', mime: 'text/plain; charset=utf-8' },
  '.csv': { kind: 'text', mime: 'text/plain; charset=utf-8' }, '.log': { kind: 'text', mime: 'text/plain; charset=utf-8' },
};
/** A text frame is read into the page, so it is capped far lower than a clip. */
export const MAX_TEXT_BYTES = 1_000_000;
/** The door reads a file whole to honour ranges, so a clip beyond this is listed but not served. */
export const MAX_MEDIA_BYTES = 200_000_000;
export const mediaTypeOf = (file: string) => MEDIA_TYPES[path.extname(file).toLowerCase()];

export interface RawAnswer { id: string; choice: string; note: string; at: string; [k: string]: unknown }
export interface Ask {
  id: string; lane: string; question: string; asked: string; default?: string;
  options: Array<{ key: string; label: string; tradeoff: string; frames: string[] }>;
  mtimeMs: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Parse one ask file's JSON; a string is the reason it cannot be used. */
export function parseAsk(raw: unknown, mtimeMs: number): Ask | string {
  if (!isObj(raw)) return 'not a JSON object';
  const id = text(raw.id);
  if (!ASK_ID.test(id)) return 'id is missing or has characters outside [A-Za-z0-9._-]';
  if (!text(raw.question).trim()) return 'question is missing';
  if (!Array.isArray(raw.options) || raw.options.length === 0) return 'options is missing or empty';
  const options: Ask['options'] = [];
  for (const o of raw.options) {
    if (!isObj(o) || !text(o.key).trim()) return 'an option has no key';
    if (options.some((x) => x.key === o.key)) return `option key ${String(o.key)} appears twice`;
    options.push({
      key: text(o.key), label: text(o.label).trim() || text(o.key), tradeoff: text(o.tradeoff),
      frames: Array.isArray(o.frames) ? o.frames.filter((f): f is string => typeof f === 'string' && f.trim() !== '') : [],
    });
  }
  const def = text(raw.default);
  return {
    id, lane: text(raw.lane) || id, question: text(raw.question), asked: text(raw.asked), mtimeMs, options,
    ...(def && options.some((x) => x.key === def) ? { default: def } : {}),
  };
}

export function readAsks(root: string): { asks: Ask[]; problems: DecisionProblem[] } {
  const dir = path.join(root, 'asks');
  const asks: Ask[] = [];
  const problems: DecisionProblem[] = [];
  let names: string[];
  try { names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json')).sort(); } catch { return { asks, problems }; }
  for (const name of names) {
    try {
      const file = path.join(dir, name);
      const parsed = parseAsk(readLaneJsonFile(file), fs.statSync(file).mtimeMs);
      if (typeof parsed === 'string') problems.push({ file: name, reason: parsed });
      else if (asks.some((a) => a.id === parsed.id)) problems.push({ file: name, reason: `id ${parsed.id} is already used by another ask` });
      else asks.push(parsed);
    } catch (e) {
      problems.push({ file: name, reason: `unreadable: ${e instanceof Error ? e.message : 'parse failed'}` });
    }
  }
  return { asks, problems };
}

/** `ok: false` = answers.json exists but cannot be used: the board says so and the writer refuses to touch it. */
export type AnswersRead = { ok: true; answers: RawAnswer[]; doc: Record<string, unknown> } | { ok: false; reason: string };

export function readAnswers(root: string): AnswersRead {
  const file = path.join(root, 'answers.json');
  if (!fs.existsSync(file)) return { ok: true, answers: [], doc: { answers: [] } };
  try {
    const doc: unknown = readLaneJsonFile(file);
    if (!isObj(doc) || !Array.isArray(doc.answers)) return { ok: false, reason: 'answers.json has no "answers" array' };
    const answers = doc.answers.filter(isObj).map((a) => ({ ...a, id: text(a.id), choice: text(a.choice), note: text(a.note), at: text(a.at) }));
    return { ok: true, answers, doc };
  } catch (e) {
    return { ok: false, reason: `answers.json is unreadable: ${e instanceof Error ? e.message : 'parse failed'}` };
  }
}

/** The media type of a listed path, or the reason it cannot be served. */
function inspectMedia(file: string): { kind: MediaKind; mime: string } | string {
  const type = mediaTypeOf(file);
  if (!type) return 'unsupported file type';
  if (!path.isAbsolute(file)) return 'not an absolute path';
  try {
    const st = fs.statSync(file);
    if (!st.isFile()) return 'not a file';
    const cap = type.kind === 'text' ? MAX_TEXT_BYTES : MAX_MEDIA_BYTES;
    return st.size > cap ? `larger than ${cap / 1_000_000} MB` : type;
  } catch { return 'file not found'; }
}

const mediaUrl = (base: string, askId: string, key: string, n: number) =>
  `${base}/media?ask=${encodeURIComponent(askId)}&opt=${encodeURIComponent(key)}&n=${n}`;

function viewOf(a: Ask, answers: RawAnswer[], base: string): DecisionView {
  const answer = [...answers].reverse().find((x) => x.id === a.id);
  const options: DecisionOption[] = a.options.map((o) => ({
    key: o.key, label: o.label, tradeoff: o.tradeoff,
    media: o.frames.map((f, n): DecisionMedia => {
      const found = inspectMedia(f);
      const name = path.basename(f);
      return typeof found === 'string'
        ? { kind: mediaTypeOf(f)?.kind ?? 'image', name, unservable: found }
        : { kind: found.kind, name, url: mediaUrl(base, a.id, o.key, n) };
    }),
  }));
  return {
    id: a.id, lane: a.lane, question: a.question, options, asked: a.asked,
    ...(a.default ? { default: a.default } : {}),
    ...(answer ? { answer: { choice: answer.choice, note: answer.note, at: answer.at } } : {}),
  };
}

const askedMs = (a: Ask) => { const t = Date.parse(a.asked); return Number.isFinite(t) ? t : a.mtimeMs; };

/** Whole board for one decision folder. `base` is the API prefix the media urls hang off. */
export function readDecisionsBoard(root: string, gameId: string, base: string, now = new Date()): DecisionsBoard {
  const { asks, problems } = readAsks(root);
  const ans = readAnswers(root);
  if (!ans.ok) problems.push({ file: 'answers.json', reason: ans.reason });
  const answers = ans.ok ? ans.answers : [];
  const views = [...asks].sort((x, y) => askedMs(y) - askedMs(x)).map((a) => viewOf(a, answers, base));
  const atMs = (v: DecisionView) => Date.parse(v.answer?.at ?? '') || 0;
  return {
    gameId, readAt: now.toISOString(), configured: true, root,
    open: views.filter((v) => !v.answer),
    answered: views.filter((v) => v.answer).sort((x, y) => atMs(y) - atMs(x)),
    problems,
  };
}

export type MediaRead = { ok: true; file: string; mime: string } | { ok: false; status: 400 | 404; reason: string };

/** The door: only entry `n` of option `opt` of ask `ask`, as that ask file lists it, and only when it is real media. */
export function resolveMedia(root: string, askId: string, optKey: string, n: number): MediaRead {
  if (!ASK_ID.test(askId) || !Number.isInteger(n) || n < 0) return { ok: false, status: 400, reason: 'bad ask or index' };
  const ask = readAsks(root).asks.find((a) => a.id === askId);
  const file = ask?.options.find((o) => o.key === optKey)?.frames[n];
  if (!file) return { ok: false, status: 404, reason: 'not listed in an ask file' };
  const found = inspectMedia(file);
  if (typeof found === 'string') return { ok: false, status: 404, reason: found };
  return { ok: true, file, mime: found.mime };
}
