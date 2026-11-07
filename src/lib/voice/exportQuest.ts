/**
 * Export a quest's PROVEN lines into the game (lane pof-voice). Runs only on the owner's Export press or
 * `voice.mjs export`. Writes `<gameRoot>/project/assets/audio/voice/<quest>/<line>.ogg` and, in
 * `<gameRoot>/project/quests/<quest>/quest.json`, sets the line's `audio` to the `res://` path — a STRING,
 * because the game's `quest_voice.gd` plays `audio` only when it is a String — and its `audioTake` to
 * `{ takeId, voiceId, model }` (the model is recorded per line so the game's record says what rendered it).
 * A line is proven only by a CURRENT approved take (`staleReason` in `lineQueue.ts`: the text it spoke, a voice
 * of the line's speaker, the speaker's cast voice); a take that went stale is skipped with its reason. Unproven lines are not touched (a temp voice the audio lane set stays).
 * Nothing unproven is ever written: a line without a current approved take is skipped and listed.
 * Every written file is MASTERED to the game's voice target (`mastering.ts`: mono, loudnorm to the
 * `audio_mix.json` loudness) and measured after, so the report shows each line's level against it. The file
 * is a copy of the room's as-game master (`asGame.ts`), so what ships is exactly what the owner heard.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { listLines, listTakes } from '@/lib/voice/voice-db';
import { lineState, staleReason, voiceCtx, whyNotProven } from '@/lib/voice/lineQueue';
import { convertToOgg, measureAudio } from '@/lib/voice/storage';
import { MASTER_TOLERANCE_LU, voiceMasterTarget, type VoiceMasterTarget } from '@/lib/voice/mastering';
import { asGameFile } from '@/lib/voice/asGame';
import type { Result } from '@/types/result';

export interface ExportReport {
  questId: string;
  /** `lufs`: the written file's measured level (null = unmeasured); `onLevel`: within MASTER_TOLERANCE_LU of the
   *  target; `treatment`: the filter chain the speaker is heard through in the game (`voice_treatments`), if any. */
  written: Array<{ lineId: string; path: string; takeId: string; lufs: number | null; onLevel: boolean | null; treatment?: string }>;
  /** The level every written file was mastered to, and where that target came from. */
  mastering: VoiceMasterTarget;
  skipped: Array<{ lineId: string; reason: string }>;
  /** Lines the game still plays from an earlier export whose take is no longer proven here (a text edit or
   *  a re-cast). Reported, never deleted: what the game plays is the owner's call. */
  stale: Array<{ lineId: string; takeId: string; reason: string }>;
  questFile: string;
}

export interface ExportDeps {
  convert: (src: string, dst: string, target: VoiceMasterTarget, treatment?: string) => Promise<string | null>;
  measureLufs: (abs: string) => Promise<number | null>;
}

const DEFAULT_DEPS: ExportDeps = { convert: convertToOgg, measureLufs: async (abs) => (await measureAudio(abs)).loudnessLufs };

export async function exportQuest(
  db: Database.Database, gameId: string, questId: string, gameRoot: string, deps: ExportDeps = DEFAULT_DEPS,
): Promise<Result<ExportReport, string>> {
  if (!/^[a-z0-9-]+$/.test(questId)) return { ok: false, error: `bad quest id ${questId}` };
  const questFile = path.join(gameRoot, 'project', 'quests', questId, 'quest.json');
  if (!fs.existsSync(questFile)) return { ok: false, error: `the game has no ${path.relative(gameRoot, questFile)}` };
  const lines = listLines(db, gameId).filter((l) => l.questId === questId);
  if (lines.length === 0) return { ok: false, error: `no queue lines for quest ${questId}` };
  const takes = listTakes(db, gameId, questId);
  const mastering = voiceMasterTarget(gameRoot);
  const report: ExportReport = { questId, written: [], skipped: [], stale: [], mastering, questFile };
  const inGame = exportedTakes(questFile);
  const audioByLine = new Map<string, { path: string; takeId: string; voiceId: string; model: string }>();
  const ctx = voiceCtx(db, gameId);
  for (const line of lines) {
    const mine = takes.filter((t) => t.lineId === line.lineId);
    const st = lineState(line, mine, ctx);
    const take = st.approvedTakeId ? mine.find((t) => t.id === st.approvedTakeId) : undefined;
    if (!take) {
      const why = whyNotProven(line, mine, ctx);
      report.skipped.push({ lineId: line.lineId, reason: `not proven (${st.state})${why ? `: ${why}` : ''}` });
      const played = inGame.get(line.lineId);
      const playedTake = played ? mine.find((t) => t.id === played) : undefined;
      const playedWhy = playedTake ? staleReason(playedTake, line, ctx) : null;
      if (played) report.stale.push({ lineId: line.lineId, takeId: played, reason: `the game still plays take ${played.slice(0, 8)}, no longer proven here (${st.state}${playedWhy ? `: ${playedWhy}` : ''})` });
      continue;
    }
    const rel = `assets/audio/voice/${questId}/${line.lineId}.ogg`;
    const dst = path.join(gameRoot, 'project', ...rel.split('/'));
    // The SAME master the room played (as=game cache): the game gets byte-for-byte what the owner approved.
    const m = await asGameFile(db, take.id, gameRoot, { convert: deps.convert });
    if (!m.ok) { report.skipped.push({ lineId: line.lineId, reason: m.error }); continue; }
    const treatment = m.data.treatment ?? undefined;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(m.data.file, dst);
    const lufs = await deps.measureLufs(dst);
    audioByLine.set(line.lineId, { path: `res://${rel}`, takeId: take.id, voiceId: take.providerVoiceId, model: take.settings.model });
    const onLevel = lufs === null ? null : Math.abs(lufs - mastering.lufs) <= MASTER_TOLERANCE_LU;
    report.written.push({ lineId: line.lineId, path: `res://${rel}`, takeId: take.id, lufs, onLevel, ...(treatment ? { treatment } : {}) });
  }
  if (audioByLine.size > 0) {
    const raw = fs.readFileSync(questFile, 'utf8');
    const q = JSON.parse(raw) as { lines?: Array<{ id: string; audio?: unknown; audioTake?: unknown }> };
    for (const l of q.lines ?? []) {
      const a = audioByLine.get(l.id);
      if (!a) continue;
      l.audio = a.path;
      l.audioTake = { takeId: a.takeId, voiceId: a.voiceId, model: a.model };
    }
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(questFile, JSON.stringify(q, null, 2).replace(/\n/g, eol) + eol);
  }
  return { ok: true, data: report };
}

/** line id -> the take id an earlier Voice-room export left in the game (`audioTake.takeId`). */
function exportedTakes(questFile: string): Map<string, string> {
  try {
    const q = JSON.parse(fs.readFileSync(questFile, 'utf8')) as { lines?: Array<{ id: string; audioTake?: { takeId?: unknown } }> };
    return new Map((q.lines ?? []).flatMap((l) => (typeof l.audioTake?.takeId === 'string' ? [[l.id, l.audioTake.takeId] as [string, string]] : [])));
  } catch {
    return new Map();
  }
}
