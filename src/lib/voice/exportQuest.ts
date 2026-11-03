/**
 * Export a quest's PROVEN lines into the game (lane pof-voice). Runs only on the owner's Export press or
 * `voice.mjs export`. Writes `<gameRoot>/project/assets/audio/voice/<quest>/<line>.ogg` and sets the line's
 * `audio` in `<gameRoot>/project/quests/<quest>/quest.json` to `{ path, takeId, voiceId, model }` (the model is
 * recorded per line: a model change is a re-cast event, registry `game-dialogue-voice-pipeline`).
 * Nothing unproven is ever written: a line without a current approved take is skipped and listed.
 */
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { listLines, listTakes } from '@/lib/voice/voice-db';
import { castMap, lineState } from '@/lib/voice/lineQueue';
import { convertToOgg } from '@/lib/voice/storage';
import type { Result } from '@/types/result';

export interface ExportReport {
  questId: string;
  written: Array<{ lineId: string; path: string; takeId: string }>;
  skipped: Array<{ lineId: string; reason: string }>;
  questFile: string;
}

export interface ExportDeps { convert: (src: string, dst: string) => Promise<string | null> }

export async function exportQuest(
  db: Database.Database, gameId: string, questId: string, gameRoot: string, deps: ExportDeps = { convert: convertToOgg },
): Promise<Result<ExportReport, string>> {
  if (!/^[a-z0-9-]+$/.test(questId)) return { ok: false, error: `bad quest id ${questId}` };
  const questFile = path.join(gameRoot, 'project', 'quests', questId, 'quest.json');
  if (!fs.existsSync(questFile)) return { ok: false, error: `the game has no ${path.relative(gameRoot, questFile)}` };
  const lines = listLines(db, gameId).filter((l) => l.questId === questId);
  if (lines.length === 0) return { ok: false, error: `no queue lines for quest ${questId}` };
  const takes = listTakes(db, gameId, questId);
  const report: ExportReport = { questId, written: [], skipped: [], questFile };
  const audioByLine = new Map<string, { path: string; takeId: string; voiceId: string; model: string }>();
  const cast = castMap(db, gameId);
  for (const line of lines) {
    const mine = takes.filter((t) => t.lineId === line.lineId);
    const st = lineState(line, mine, cast.get(line.speaker) ?? null);
    const take = st.approvedTakeId ? mine.find((t) => t.id === st.approvedTakeId) : undefined;
    if (!take) { report.skipped.push({ lineId: line.lineId, reason: `not proven (${st.state})` }); continue; }
    const rel = `assets/audio/voice/${questId}/${line.lineId}.ogg`;
    const err = await deps.convert(take.file, path.join(gameRoot, 'project', ...rel.split('/')));
    if (err) { report.skipped.push({ lineId: line.lineId, reason: err }); continue; }
    audioByLine.set(line.lineId, { path: `res://${rel}`, takeId: take.id, voiceId: take.providerVoiceId, model: take.settings.model });
    report.written.push({ lineId: line.lineId, path: `res://${rel}`, takeId: take.id });
  }
  if (audioByLine.size > 0) {
    const raw = fs.readFileSync(questFile, 'utf8');
    const q = JSON.parse(raw) as { lines?: Array<{ id: string; audio?: unknown }> };
    for (const l of q.lines ?? []) {
      const a = audioByLine.get(l.id);
      if (a) l.audio = a;
    }
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(questFile, JSON.stringify(q, null, 2).replace(/\n/g, eol) + eol);
  }
  return { ok: true, data: report };
}
