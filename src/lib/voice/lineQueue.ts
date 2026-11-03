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
import { listLines, listTakes, listVoices, markAbsentExcept, upsertLine } from '@/lib/voice/voice-db';
import type { LineState, QueueEntry, QueueLine, TakeRow, VoiceStatusView } from '@/lib/voice/types';

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

/** Re-read the packages under `root` and mirror their lines into `voice_lines`. Returns the queue. */
export function syncQueue(db: Database.Database, gameId: string, root: string, at = Date.now()): QueueLine[] {
  const quests = playOrder(loadLedger(root));
  const keep = new Set<string>();
  db.transaction(() => {
    quests.forEach((q, qi) => {
      (q.lines ?? []).forEach((l, li) => {
        keep.add(`${q.id}/${l.id}`);
        upsertLine(db, {
          gameId, questId: q.id, lineId: l.id, speaker: l.speaker, text: l.text, textHash: hashText(l.text),
          purpose: Array.isArray(l.purpose) ? l.purpose.map(String) : [], questOrder: qi, lineOrder: li, present: true, syncedAt: at,
        });
      });
    });
    markAbsentExcept(db, gameId, keep, at);
  })();
  return listLines(db, gameId);
}

/**
 * A take counts only for the text it spoke (a package edit makes it stale) and, once the speaker has a
 * cast voice, only in that voice: re-casting is a re-cast event (registry `game-dialogue-voice-pipeline`).
 */
export const isCurrent = (t: TakeRow, line: QueueLine, castVoiceId: string | null = null): boolean =>
  t.textHash === line.textHash && (castVoiceId === null || t.voiceId === castVoiceId);

/** speaker -> cast voice row id. */
export function castMap(db: Database.Database, gameId: string): Map<string, string> {
  return new Map(listVoices(db, gameId).filter((v) => v.status === 'cast').map((v) => [v.characterId, v.id]));
}

export function lineState(line: QueueLine, takes: readonly TakeRow[], castVoiceId: string | null = null): { state: LineState; approvedTakeId: string | null; pending: number } {
  const current = takes.filter((t) => isCurrent(t, line, castVoiceId));
  const approved = current.find((t) => t.verdict === 'approved') ?? null;
  const pending = current.filter((t) => t.verdict === 'pending').length;
  if (approved) return { state: 'proven', approvedTakeId: approved.id, pending };
  if (current.length === 0) return { state: 'no-takes', approvedTakeId: null, pending };
  return { state: pending > 0 ? 'awaiting-verdict' : 'all-rejected', approvedTakeId: null, pending };
}

export function queueEntries(db: Database.Database, gameId: string, lines: readonly QueueLine[]): QueueEntry[] {
  const byLine = new Map<string, TakeRow[]>();
  for (const t of listTakes(db, gameId)) {
    const k = `${t.questId}/${t.lineId}`;
    byLine.set(k, [...(byLine.get(k) ?? []), t]);
  }
  const cast = castMap(db, gameId);
  return lines.map((l) => {
    const c = cast.get(l.speaker) ?? null;
    const takes = (byLine.get(`${l.questId}/${l.lineId}`) ?? []).filter((t) => isCurrent(t, l, c));
    return { ...l, ...lineState(l, takes, c), takes: takes.length };
  });
}

export function statusView(entries: readonly QueueEntry[], titles: Readonly<Record<string, string>>, chars: number, nextN = 5): VoiceStatusView {
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
  };
}

export function questTitles(root: string): Record<string, string> {
  return Object.fromEntries(loadLedger(root).map((q) => [q.id, String(q.title ?? q.id)]));
}
