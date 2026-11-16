/**
 * Server-side reads shared by the voice routes: the synced queue, its status, one line's detail.
 * Every read re-syncs the queue from the quest packages first (the package is the source of truth).
 */
import type Database from 'better-sqlite3';
import { listTakes, listVoices, totalChars, verdictHistory, getLine } from '@/lib/voice/voice-db';
import { queueEntries, questTitles, statusView, staleReason, syncQueue, voiceCtx } from '@/lib/voice/lineQueue';
import { castingDemand } from '@/lib/voice/castingDemand';
import { readBible } from '@/lib/voice/design';
import type { QueueEntry, StaleReason, TakeRow, VerdictEvent, VoiceRow, VoiceStatusView } from '@/lib/voice/types';

export interface RoomState { status: VoiceStatusView; queue: QueueEntry[]; voices: VoiceRow[] }

export function roomState(db: Database.Database, gameId: string, root: string, nextN = 5): RoomState {
  const queue = queueEntries(db, gameId, syncQueue(db, gameId, root));
  return { status: statusView(queue, questTitles(root), totalChars(db, gameId), nextN, castingDemand(db, gameId).needsVoice), queue, voices: listVoices(db, gameId) };
}

/** A take as the client sees it: no absolute file path, plus `reason` (why it is not the line's current take,
 *  null when it is) and `stale` (= reason !== null). */
export type TakeView = Omit<TakeRow, 'file'> & { stale: boolean; reason: StaleReason | null };

export interface LineDetail {
  line: QueueEntry;
  bible: string | null;
  takes: TakeView[];
  history: VerdictEvent[];
  voices: VoiceRow[];
}

export const takeView = (t: TakeRow, reason: StaleReason | null): TakeView => {
  const { file: _file, ...rest } = t;
  void _file;
  return { ...rest, stale: reason !== null, reason };
};

export function lineDetail(db: Database.Database, gameId: string, root: string, questId: string, lineId: string): LineDetail | null {
  const queue = queueEntries(db, gameId, syncQueue(db, gameId, root));
  const entry = queue.find((e) => e.questId === questId && e.lineId === lineId);
  const line = getLine(db, gameId, questId, lineId);
  if (!entry || !line) return null;
  const takes = listTakes(db, gameId, questId, lineId);
  const ctx = voiceCtx(db, gameId);
  return {
    line: entry,
    bible: readBible(root, line.speaker),
    takes: takes.map((t) => takeView(t, staleReason(t, line, ctx))).reverse(),
    history: verdictHistory(db, takes.map((t) => t.id)),
    voices: listVoices(db, gameId).filter((v) => v.characterId === line.speaker),
  };
}
