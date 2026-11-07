/**
 * The line queue: every line of every ledger quest, in chronological PLAY order.
 *
 * Source of truth is the quest package (`games/gtai/quests/<id>/quest.json`, read by `loadLedger`); the
 * `voice_lines` rows are a mirror re-synced on every queue read, so a text edit in the package shows up
 * at once and makes the older takes stale (a take carries the hash of the text it spoke).
 *
 * Play order: the act (`act1` < `act2` …), then the ledger's own order within the act — the package's
 * `provenance.fusedAt` (when the owner fused it, i.e. the order quests were written into the campaign),
 * then the id. Within a quest, the order of `lines[]`.
 */
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { loadLedger } from '@/lib/games/gtai-quest/loadContext';
import type { QuestPackage } from '@/lib/games/gtai-quest/types';
import { profileMatches } from '@/lib/voice/takeProfile';
import { listLines, listTakes, listVoices, markAbsentExcept, upsertLine } from '@/lib/voice/voice-db';
import { READBACK_FLAG_WER, SILENCE_FLAG_MS, type LineState, type QueueEntry, type QueueLine, type SpeakerDemand, type StaleReason, type TakeRow, type VoiceRow, type VoiceStatusView } from '@/lib/voice/types';

export const hashText = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);

const actNumber = (act: unknown): number => {
  const m = /(\d+)/.exec(String(act ?? ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/** The ledger quests sorted into play order. Exported for tests. */
export function playOrder(ledger: readonly QuestPackage[]): QuestPackage[] {
  const fused = (q: QuestPackage) => String((q.provenance as { fusedAt?: string } | undefined)?.fusedAt ?? '');
  return [...ledger].sort((a, b) =>
    actNumber(a.act) - actNumber(b.act) || fused(a).localeCompare(fused(b)) || a.id.localeCompare(b.id));
}

interface BeatRef { id: string; title: string | null; summary: string | null }

/** line id -> the first beat that lists it in `lineIds` (the scene the line is directed for). */
function beatIndex(q: QuestPackage): Map<string, BeatRef> {
  const out = new Map<string, BeatRef>();
  const beats = Array.isArray(q.beats) ? q.beats : [];
  for (const b of beats) {
    const ref: BeatRef = { id: String(b.id), title: b.title ? String(b.title) : null, summary: b.summary ? String(b.summary) : null };
    for (const id of Array.isArray(b.lineIds) ? b.lineIds : []) if (!out.has(id)) out.set(id, ref);
  }
  return out;
}

/** db -> `${gameId}|${root}` -> hash of the packages last mirrored. The room polls every few seconds and
 *  each read syncs, so an unchanged ledger must not rewrite every queue row each time. */
const lastSynced = new WeakMap<Database.Database, Map<string, string>>();

/** Re-read the packages under `root` and mirror their lines into `voice_lines`. Returns the queue.
 *  The packages are always re-read (they are the source of truth); the rows are rewritten only when the
 *  packages' content changed since this connection last mirrored them. */
export function syncQueue(db: Database.Database, gameId: string, root: string, at = Date.now()): QueueLine[] {
  const quests = playOrder(loadLedger(root));
  const stamp = hashText(JSON.stringify(quests));
  const seen = lastSynced.get(db) ?? new Map<string, string>();
  lastSynced.set(db, seen);
  if (seen.get(`${gameId}|${root}`) === stamp) return listLines(db, gameId);
  const keep = new Set<string>();
  db.transaction(() => {
    quests.forEach((q, qi) => {
      const beatOf = beatIndex(q);
      (q.lines ?? []).forEach((l, li) => {
        keep.add(`${q.id}/${l.id}`);
        const when = Array.isArray(l.when) ? l.when.map(String) : [];
        const beat = beatOf.get(l.id) ?? null;
        upsertLine(db, {
          gameId, questId: q.id, lineId: l.id, speaker: l.speaker, text: l.text, textHash: hashText(l.text),
          purpose: Array.isArray(l.purpose) ? l.purpose.map(String) : [], lineClass: when.length > 0 ? 'bark' : 'story', when,
          beatId: beat?.id ?? null, beatTitle: beat?.title ?? null, beatSummary: beat?.summary ?? null,
          questOrder: qi, lineOrder: li, present: true, syncedAt: at,
        });
      });
    });
    markAbsentExcept(db, gameId, keep, at);
  })();
  seen.set(`${gameId}|${root}`, stamp);
  return listLines(db, gameId);
}

/** What `staleReason` needs to know about the voices: every voice row, and the cast voice per speaker. */
export interface VoiceCtx { voices: ReadonlyMap<string, VoiceRow>; cast: ReadonlyMap<string, string> }

export function voiceCtx(db: Database.Database, gameId: string): VoiceCtx {
  const all = listVoices(db, gameId);
  return { voices: new Map(all.map((v) => [v.id, v])), cast: new Map(all.filter((v) => v.status === 'cast').map((v) => [v.characterId, v.id])) };
}

/**
 * THE definition of "current take": null when `t` counts for `line`, else why not. The queue, the line view,
 * export and `voice.mjs` all read this, so a take is never proven in one place and stale in another. A take
 * counts only for the text it spoke, only in a voice that belongs to the line's speaker (`pickVoice` checks
 * that at generation; a package that reassigns the line afterwards is caught here), and only in the speaker's
 * CAST voice (re-casting is a re-cast event; a speaker with no cast voice yields auditions, never proof;
 * registry `game-dialogue-voice-pipeline`), and, when that voice carries a take profile, only rendered with it
 * (a render change invalidates the lines whose sound changed).
 */
export function staleReason(t: TakeRow, line: QueueLine, ctx: VoiceCtx): StaleReason | null {
  if (t.textHash !== line.textHash) return 'text-edited';
  if (ctx.voices.get(t.voiceId)?.characterId !== line.speaker) return 'wrong-speaker';
  const cast = ctx.cast.get(line.speaker) ?? null;
  if (cast === null) return 'audition';
  if (t.voiceId !== cast) return 'recast';
  const profile = ctx.voices.get(t.voiceId)?.takeProfile;
  if (profile && !profileMatches(t.settings, profile)) return 'profile-changed';
  return null;
}

export const isCurrent = (t: TakeRow, line: QueueLine, ctx: VoiceCtx): boolean => staleReason(t, line, ctx) === null;

/** speaker -> cast voice row id. */
export function castMap(db: Database.Database, gameId: string): Map<string, string> {
  return new Map(voiceCtx(db, gameId).cast);
}

/** `takes` = every take of the line; only the current ones decide its state. */
export function lineState(line: QueueLine, takes: readonly TakeRow[], ctx: VoiceCtx): { state: LineState; approvedTakeId: string | null; pending: number } {
  const current = takes.filter((t) => isCurrent(t, line, ctx));
  const approved = current.find((t) => t.verdict === 'approved') ?? null;
  const pending = current.filter((t) => t.verdict === 'pending').length;
  if (approved) return { state: 'proven', approvedTakeId: approved.id, pending };
  if (current.length === 0) return { state: 'no-takes', approvedTakeId: null, pending };
  return { state: pending > 0 ? 'awaiting-verdict' : 'all-rejected', approvedTakeId: null, pending };
}

/** Why a line is not proven although takes exist: the stale reason of its approved take(s), in words; else null. */
export function whyNotProven(line: QueueLine, takes: readonly TakeRow[], ctx: VoiceCtx): string | null {
  const why = takes.filter((t) => t.verdict === 'approved').flatMap((t) => { const r = staleReason(t, line, ctx); return r ? [`approved take ${t.id.slice(0, 8)} is stale: ${r}`] : []; });
  if (why.length > 0) return why.join('; ');
  return ctx.cast.has(line.speaker) ? null : `${line.speaker} has no cast voice: cast ${line.speaker} first`;
}

/** A take one of the automatic screens flags (the owner still decides; this only says where to listen). */
export const isFlagged = (t: TakeRow): boolean =>
  (t.readbackWer !== null && t.readbackWer > READBACK_FLAG_WER) || (t.maxSilenceMs !== null && t.maxSilenceMs > SILENCE_FLAG_MS);

export function queueEntries(db: Database.Database, gameId: string, lines: readonly QueueLine[]): QueueEntry[] {
  const byLine = new Map<string, TakeRow[]>();
  for (const t of listTakes(db, gameId)) {
    const k = `${t.questId}/${t.lineId}`;
    byLine.set(k, [...(byLine.get(k) ?? []), t]);
  }
  const ctx = voiceCtx(db, gameId);
  return lines.map((l) => {
    const all = byLine.get(`${l.questId}/${l.lineId}`) ?? [];
    const current = all.filter((t) => isCurrent(t, l, ctx));
    return { ...l, ...lineState(l, all, ctx), takes: current.length, auditions: all.filter((t) => staleReason(t, l, ctx) === 'audition').length, flagged: current.filter(isFlagged).length };
  });
}

export function statusView(entries: readonly QueueEntry[], titles: Readonly<Record<string, string>>, chars: number, nextN = 5, needsVoice: SpeakerDemand[] = []): VoiceStatusView {
  const quests = new Map<string, { questOrder: number; proven: number; total: number }>();
  for (const e of entries) {
    const q = quests.get(e.questId) ?? { questOrder: e.questOrder, proven: 0, total: 0 };
    q.total += 1;
    if (e.state === 'proven') q.proven += 1;
    quests.set(e.questId, q);
  }
  return {
    proven: entries.filter((e) => e.state === 'proven').length,
    total: entries.length,
    quests: [...quests.entries()].map(([questId, q]) => ({ questId, title: titles[questId] ?? questId, ...q })).sort((a, b) => a.questOrder - b.questOrder),
    next: entries.filter((e) => e.state !== 'proven').slice(0, nextN),
    chars,
    flaggedLines: entries.filter((e) => e.flagged > 0).length,
    needsVoice,
  };
}

export function questTitles(root: string): Record<string, string> {
  return Object.fromEntries(loadLedger(root).map((q) => [q.id, String(q.title ?? q.id)]));
}
