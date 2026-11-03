/**
 * Server-only (fs): records the owner's answer in `<root>/answers.json`, safely for several reader lanes.
 *
 *  - Atomic: the whole document goes to a unique temp file in the same folder, then is renamed over `answers.json`
 *    (a few retries: Windows refuses a rename while a reader holds the target open). A reader sees the old file or
 *    the new one, never half of one.
 *  - Additive: every earlier answer and every unknown key stays. One entry per ask id, so a lane that takes the
 *    first match and one that takes the last read the same thing; a changed mind replaces that id's entry, and the
 *    entry it replaced is appended to `answers.history.jsonl` (nothing is lost).
 *  - Never repairs: an unreadable `answers.json` is refused, not overwritten. Ask files are never opened for write.
 *  - Serialised in this process, so two quick clicks cannot both read the same base.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ANSWER_NOTE_MAX } from './decisionTypes';
import { readAnswers, readAsks, type RawAnswer } from './readDecisions';

export type WriteResult =
  | { ok: true; answer: RawAnswer; replaced: boolean }
  | { ok: false; status: 400 | 404 | 409 | 500; reason: string };

let chain: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let i = 0; ; i++) {
    try { fs.renameSync(from, to); return; } catch (e) {
      if (i >= 8) throw e;
      await sleep(25 * (i + 1));
    }
  }
}

async function write(root: string, input: { id: string; choice: string; note: string }, now: Date): Promise<WriteResult> {
  const ask = readAsks(root).asks.find((a) => a.id === input.id);
  if (!ask) return { ok: false, status: 404, reason: `no ask ${input.id}` };
  if (!ask.options.some((o) => o.key === input.choice)) {
    return { ok: false, status: 400, reason: `choice must be one of: ${ask.options.map((o) => o.key).join(', ')}` };
  }
  const cur = readAnswers(root);
  if (!cur.ok) return { ok: false, status: 409, reason: `${cur.reason}; not overwriting it` };
  const answer: RawAnswer = { id: input.id, choice: input.choice, note: input.note, at: now.toISOString() };
  const previous = cur.answers.find((a) => a.id === input.id);
  const file = path.join(root, 'answers.json');
  // Re-read the raw entries from the document so unknown per-entry fields of other answers survive untouched.
  const rawEntries = cur.doc.answers as unknown[];
  const kept = rawEntries.filter((e) => (e as { id?: unknown } | null)?.id !== input.id);
  const next = previous ? rawEntries.map((e) => ((e as { id?: unknown } | null)?.id === input.id ? answer : e)) : [...kept, answer];
  const tmp = path.join(root, `.answers.${process.pid}.${randomUUID()}.tmp`);
  try {
    if (previous) fs.appendFileSync(path.join(root, 'answers.history.jsonl'), `${JSON.stringify({ replacedAt: answer.at, was: previous })}\n`);
    fs.writeFileSync(tmp, `${JSON.stringify({ ...cur.doc, answers: next }, null, 2)}\n`);
    await renameWithRetry(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
    return { ok: false, status: 500, reason: `could not write answers.json: ${e instanceof Error ? e.message : 'write failed'}` };
  }
  return { ok: true, answer, replaced: previous !== undefined };
}

export function writeAnswer(root: string, input: { id: string; choice: string; note?: string }, now = new Date()): Promise<WriteResult> {
  const note = (input.note ?? '').trim().slice(0, ANSWER_NOTE_MAX);
  const run = chain.then(() => write(root, { id: input.id, choice: input.choice, note }, now));
  chain = run.catch(() => undefined);
  return run;
}
