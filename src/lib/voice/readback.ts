/**
 * Read-back: an EAR PROXY for every take (server-only). A local Whisper model (`scripts/voice/readback.py`,
 * offline HF cache) transcribes the take and the word error rate against the line text says whether the
 * WORDS came out: a stray syllable, a dropped word, an audio tag read aloud. It never judges the acting;
 * the owner does (registry `hitl-approval`, oracle-before-gate: the reviewer gets something to check against).
 *
 * One Python process per batch (the model load is ~17 s, then ~4 s a take), run in the background after a
 * generate; the room's poll shows the result. A take that could not be read back stays `null` (shown as
 * "read-back pending"), and the reason is logged, never a made-up score.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { logger } from '@/lib/logger';
import { getLine, getTake, listTakes, setReadback } from '@/lib/voice/voice-db';
import type { Result } from '@/types/result';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..9999 as spoken words ("39" -> "thirty nine"); larger numbers stay digits. Whisper writes digits for
 *  spoken numbers, the script writes words, and neither is a speech error. */
export function numberWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberWords(n % 100)}` : ''}`;
  if (n < 10000) return `${ONES[Math.floor(n / 1000)]} thousand${n % 1000 ? ` ${numberWords(n % 1000)}` : ''}`;
  return String(n);
}

/** Lower-case words, punctuation dropped (apostrophes kept), digits spoken, so "Hands, stop" == "Hands. Stop"
 *  and "40" == "Forty". */
export function words(text: string): string[] {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\d+/g, (d) => ` ${numberWords(Number(d))} `).split(/\s+/).filter(Boolean);
}

/** Word-level Levenshtein distance / reference length (0 = every word heard; can exceed 1). */
export function wordErrorRate(reference: string, heard: string): number {
  const ref = words(reference);
  const hyp = words(heard);
  let row = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const next = [i];
    for (let j = 1; j <= hyp.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[hyp.length] / Math.max(ref.length, 1);
}

export interface ReadbackItem { id: string; file: string }
export interface ReadbackHeard { id: string; text: string | null; error: string | null }
export type Transcribe = (items: readonly ReadbackItem[]) => Promise<Result<ReadbackHeard[], string>>;

/** Spawn the Python worker once for the whole batch. `POF_PYTHON` picks the interpreter (default `python`). */
export const transcribeLocal: Transcribe = (items) => new Promise((resolve) => {
  const script = path.join(process.cwd(), 'scripts', 'voice', 'readback.py');
  const child = spawn(process.env.POF_PYTHON || 'python', [script], { windowsHide: true });
  let out = '';
  let err = '';
  const timer = setTimeout(() => child.kill(), 120_000 + items.length * 30_000);
  child.stdout.on('data', (d) => { out += String(d); });
  child.stderr.on('data', (d) => { err += String(d); });
  child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: `read-back worker did not start: ${e.message}` }); });
  child.on('close', (code) => {
    clearTimeout(timer);
    try {
      resolve({ ok: true, data: (JSON.parse(out) as { results: ReadbackHeard[] }).results });
    } catch {
      resolve({ ok: false, error: `read-back worker exit ${code}: ${err.trim().split('\n').pop() ?? 'no output'}` });
    }
  });
  child.stdin.end(JSON.stringify(items));
});

/** Read back `takeIds` and store text + WER per take. Returns how many were measured. */
export async function readbackTakes(db: Database.Database, takeIds: readonly string[], transcribe: Transcribe = transcribeLocal): Promise<Result<{ measured: number; failed: string[] }, string>> {
  const takes = takeIds.map((id) => getTake(db, id)).filter((t): t is NonNullable<typeof t> => t !== null);
  if (takes.length === 0) return { ok: true, data: { measured: 0, failed: [] } };
  const r = await transcribe(takes.map((t) => ({ id: t.id, file: t.file })));
  if (!r.ok) { logger.warn(`[voice] read-back failed: ${r.error}`); return r; }
  const failed: string[] = [];
  let measured = 0;
  for (const heard of r.data) {
    const take = takes.find((t) => t.id === heard.id);
    const line = take ? getLine(db, take.gameId, take.questId, take.lineId) : null;
    if (!take || !line || heard.text === null) { failed.push(`${heard.id}: ${heard.error ?? 'no line'}`); continue; }
    setReadback(db, take.id, heard.text, wordErrorRate(line.text, heard.text));
    measured++;
  }
  if (failed.length > 0) logger.warn(`[voice] read-back: ${failed.length} take(s) unmeasured`, { failed });
  return { ok: true, data: { measured, failed } };
}

/** Re-derive every stored WER from its stored transcript and the line's CURRENT text (after a normalization
 *  change or a line edit). Cheap and deterministic: no model run. Returns how many changed. */
export function rescoreReadbacks(db: Database.Database, gameId: string): number {
  let changed = 0;
  for (const t of listTakes(db, gameId)) {
    if (t.readbackText === null) continue;
    const line = getLine(db, gameId, t.questId, t.lineId);
    if (!line) continue;
    const wer = wordErrorRate(line.text, t.readbackText);
    if (wer !== t.readbackWer) { setReadback(db, t.id, t.readbackText, wer); changed++; }
  }
  return changed;
}
