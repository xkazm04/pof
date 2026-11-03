/**
 * Voice room persistence (pure: every function takes the `db`, so tests run on `:memory:`).
 * Tables: `voice_voices`, `voice_lines` (the queue), `voice_takes`, `voice_verdicts` (history).
 */
import type Database from 'better-sqlite3';
import type { QueueLine, TakeRow, VerdictEvent, VoiceRow } from '@/lib/voice/types';

type Db = Database.Database;
type Raw = Record<string, unknown>;

export function createVoiceDb(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_voices (
      id TEXT PRIMARY KEY, gameId TEXT NOT NULL, characterId TEXT NOT NULL, name TEXT NOT NULL,
      providerVoiceId TEXT, source TEXT NOT NULL, designPrompt TEXT, previews TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'candidate', createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_voice_voices_char ON voice_voices(gameId, characterId);
    CREATE TABLE IF NOT EXISTS voice_lines (
      gameId TEXT NOT NULL, questId TEXT NOT NULL, lineId TEXT NOT NULL, speaker TEXT NOT NULL,
      text TEXT NOT NULL, textHash TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT '[]',
      questOrder INTEGER NOT NULL, lineOrder INTEGER NOT NULL, present INTEGER NOT NULL DEFAULT 1,
      syncedAt INTEGER NOT NULL, PRIMARY KEY (gameId, questId, lineId)
    );
    CREATE TABLE IF NOT EXISTS voice_takes (
      id TEXT PRIMARY KEY, gameId TEXT NOT NULL, questId TEXT NOT NULL, lineId TEXT NOT NULL,
      voiceId TEXT NOT NULL, providerVoiceId TEXT NOT NULL, textHash TEXT NOT NULL, direction TEXT NOT NULL,
      sentText TEXT NOT NULL, settings TEXT NOT NULL, file TEXT NOT NULL, durationMs INTEGER,
      loudnessLufs REAL, maxSilenceMs INTEGER, chars INTEGER NOT NULL, verdict TEXT NOT NULL DEFAULT 'pending',
      verdictNote TEXT, verdictAt INTEGER, createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_voice_takes_line ON voice_takes(gameId, questId, lineId);
    CREATE TABLE IF NOT EXISTS voice_verdicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, takeId TEXT NOT NULL, verdict TEXT NOT NULL, note TEXT, at INTEGER NOT NULL
    );
  `);
  // A DB created before the silence screen lacks the column; add it once.
  const cols = db.prepare('PRAGMA table_info(voice_takes)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'maxSilenceMs')) db.exec('ALTER TABLE voice_takes ADD COLUMN maxSilenceMs INTEGER');
}

const voiceOf = (r: Raw): VoiceRow => ({ ...(r as unknown as VoiceRow), previews: JSON.parse(String(r.previews)) });
const lineOf = (r: Raw): QueueLine => ({ ...(r as unknown as QueueLine), purpose: JSON.parse(String(r.purpose)), present: r.present === 1 });
const takeOf = (r: Raw): TakeRow => ({ ...(r as unknown as TakeRow), settings: JSON.parse(String(r.settings)) });

// ── voices ──
export function insertVoice(db: Db, v: VoiceRow): void {
  db.prepare(`INSERT INTO voice_voices VALUES (@id,@gameId,@characterId,@name,@providerVoiceId,@source,@designPrompt,@previews,@status,@createdAt,@updatedAt)`)
    .run({ ...v, previews: JSON.stringify(v.previews) });
}
export function listVoices(db: Db, gameId: string): VoiceRow[] {
  return (db.prepare('SELECT * FROM voice_voices WHERE gameId=? ORDER BY characterId, createdAt').all(gameId) as Raw[]).map(voiceOf);
}
export function getVoice(db: Db, id: string): VoiceRow | null {
  const r = db.prepare('SELECT * FROM voice_voices WHERE id=?').get(id) as Raw | undefined;
  return r ? voiceOf(r) : null;
}
export function setProviderVoiceId(db: Db, id: string, providerVoiceId: string, at = Date.now()): void {
  db.prepare('UPDATE voice_voices SET providerVoiceId=?, updatedAt=? WHERE id=?').run(providerVoiceId, at, id);
}
/** Cast `id` for its character; a previously cast voice of that character returns to candidate. */
export function castVoice(db: Db, id: string, at = Date.now()): VoiceRow | null {
  const v = getVoice(db, id);
  if (!v) return null;
  db.transaction(() => {
    db.prepare("UPDATE voice_voices SET status='candidate', updatedAt=? WHERE gameId=? AND characterId=? AND status='cast'").run(at, v.gameId, v.characterId);
    db.prepare("UPDATE voice_voices SET status='cast', updatedAt=? WHERE id=?").run(at, id);
  })();
  return getVoice(db, id);
}

// ── line queue ──
export function upsertLine(db: Db, l: QueueLine): void {
  db.prepare(`INSERT INTO voice_lines VALUES (@gameId,@questId,@lineId,@speaker,@text,@textHash,@purpose,@questOrder,@lineOrder,@present,@syncedAt)
    ON CONFLICT(gameId,questId,lineId) DO UPDATE SET speaker=excluded.speaker, text=excluded.text, textHash=excluded.textHash,
    purpose=excluded.purpose, questOrder=excluded.questOrder, lineOrder=excluded.lineOrder, present=excluded.present, syncedAt=excluded.syncedAt`)
    .run({ ...l, purpose: JSON.stringify(l.purpose), present: l.present ? 1 : 0 });
}
/** Lines no longer in any package stay (their takes keep history) but leave the queue. */
export function markAbsentExcept(db: Db, gameId: string, keep: ReadonlySet<string>, at: number): void {
  const rows = db.prepare('SELECT questId, lineId FROM voice_lines WHERE gameId=? AND present=1').all(gameId) as Raw[];
  const upd = db.prepare('UPDATE voice_lines SET present=0, syncedAt=? WHERE gameId=? AND questId=? AND lineId=?');
  for (const r of rows) if (!keep.has(`${r.questId}/${r.lineId}`)) upd.run(at, gameId, r.questId, r.lineId);
}
export function listLines(db: Db, gameId: string): QueueLine[] {
  return (db.prepare('SELECT * FROM voice_lines WHERE gameId=? AND present=1 ORDER BY questOrder, lineOrder').all(gameId) as Raw[]).map(lineOf);
}
export function getLine(db: Db, gameId: string, questId: string, lineId: string): QueueLine | null {
  const r = db.prepare('SELECT * FROM voice_lines WHERE gameId=? AND questId=? AND lineId=?').get(gameId, questId, lineId) as Raw | undefined;
  return r ? lineOf(r) : null;
}

// ── takes ──
export function insertTake(db: Db, t: TakeRow): void {
  db.prepare(`INSERT INTO voice_takes (id,gameId,questId,lineId,voiceId,providerVoiceId,textHash,direction,sentText,settings,file,durationMs,loudnessLufs,maxSilenceMs,chars,verdict,verdictNote,verdictAt,createdAt)
    VALUES (@id,@gameId,@questId,@lineId,@voiceId,@providerVoiceId,@textHash,@direction,@sentText,@settings,@file,@durationMs,@loudnessLufs,@maxSilenceMs,@chars,@verdict,@verdictNote,@verdictAt,@createdAt)`)
    .run({ ...t, settings: JSON.stringify(t.settings) });
}
export function getTake(db: Db, id: string): TakeRow | null {
  const r = db.prepare('SELECT * FROM voice_takes WHERE id=?').get(id) as Raw | undefined;
  return r ? takeOf(r) : null;
}
export function listTakes(db: Db, gameId: string, questId?: string, lineId?: string): TakeRow[] {
  const where = ['gameId=?'];
  const args: string[] = [gameId];
  if (questId) { where.push('questId=?'); args.push(questId); }
  if (lineId) { where.push('lineId=?'); args.push(lineId); }
  return (db.prepare(`SELECT * FROM voice_takes WHERE ${where.join(' AND ')} ORDER BY createdAt, id`).all(...args) as Raw[]).map(takeOf);
}

/**
 * Record a verdict (the caller has already passed the human gate). Approving supersedes the line's
 * previous approved take, so a line holds at most one approved take; every change lands in history.
 */
export function setVerdict(db: Db, takeId: string, verdict: 'approved' | 'rejected', note: string | null, at = Date.now()): TakeRow | null {
  const t = getTake(db, takeId);
  if (!t) return null;
  const log = db.prepare('INSERT INTO voice_verdicts (takeId, verdict, note, at) VALUES (?,?,?,?)');
  db.transaction(() => {
    if (verdict === 'approved') {
      const prev = db.prepare("SELECT id FROM voice_takes WHERE gameId=? AND questId=? AND lineId=? AND verdict='approved' AND id<>?")
        .all(t.gameId, t.questId, t.lineId, takeId) as Raw[];
      for (const p of prev) {
        db.prepare("UPDATE voice_takes SET verdict='superseded', verdictAt=? WHERE id=?").run(at, p.id);
        log.run(p.id, 'superseded', `replaced by ${takeId}`, at);
      }
    }
    db.prepare('UPDATE voice_takes SET verdict=?, verdictNote=?, verdictAt=? WHERE id=?').run(verdict, note, at, takeId);
    log.run(takeId, verdict, note, at);
  })();
  return getTake(db, takeId);
}
export function verdictHistory(db: Db, takeIds: readonly string[]): VerdictEvent[] {
  if (takeIds.length === 0) return [];
  return db.prepare(`SELECT takeId, verdict, note, at FROM voice_verdicts WHERE takeId IN (${takeIds.map(() => '?').join(',')}) ORDER BY id`)
    .all(...takeIds) as VerdictEvent[];
}
export function totalChars(db: Db, gameId: string): number {
  return (db.prepare('SELECT COALESCE(SUM(chars),0) AS n FROM voice_takes WHERE gameId=?').get(gameId) as { n: number }).n;
}
