/**
 * Casting rounds (the Voice room's Casting page): a character's voice is found over ROUNDS of up to 5
 * designed candidates. The owner gives every candidate a verdict (cast / iterate / decline) and closes a round
 * with a comment the next round is written from. Pure persistence: every function takes the `db`.
 *
 * A candidate IS a `voice_voices` row (so takes, previews and the audio route keep working); this table adds
 * its round, label, design seed and lineage (`parentVoiceId` = the iterated voice it was derived from).
 */
import type Database from 'better-sqlite3';
import { castVoice, getVoice, listVoices } from '@/lib/voice/voice-db';
import type { VoiceRow } from '@/lib/voice/types';

type Db = Database.Database;
type Raw = Record<string, unknown>;

export type CastVerdict = 'pending' | 'cast' | 'iterate' | 'decline';
export type RoundStatus = 'open' | 'closed' | 'cast';
export const MAX_CANDIDATES_PER_ROUND = 5;

export interface CastRound {
  id: string;
  gameId: string;
  characterId: string;
  roundNo: number;
  /** What this round tries, in words (written by whoever composed it: Claude or the owner). */
  brief: string;
  /** The line(s) every candidate speaks, so the round compares like with like. */
  sampleText: string;
  model: string;
  status: RoundStatus;
  /** The owner's comment when closing the round: what the next round should change. */
  ownerNote: string | null;
  createdAt: number;
  closedAt: number | null;
}

export interface CastCandidate {
  voiceId: string;
  roundId: string;
  label: string;
  seed: number | null;
  parentVoiceId: string | null;
  verdict: CastVerdict;
  note: string | null;
  verdictAt: number | null;
}

export interface CandidateView { voice: VoiceRow; candidate: CastCandidate }
export interface RoundView { round: CastRound; candidates: CandidateView[] }

export function createCastingDb(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_cast_rounds (
      id TEXT PRIMARY KEY, gameId TEXT NOT NULL, characterId TEXT NOT NULL, roundNo INTEGER NOT NULL,
      brief TEXT NOT NULL, sampleText TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      ownerNote TEXT, createdAt INTEGER NOT NULL, closedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_voice_cast_rounds_char ON voice_cast_rounds(gameId, characterId, roundNo);
    CREATE TABLE IF NOT EXISTS voice_cast_candidates (
      voiceId TEXT PRIMARY KEY, roundId TEXT NOT NULL, label TEXT NOT NULL, seed INTEGER, parentVoiceId TEXT,
      verdict TEXT NOT NULL DEFAULT 'pending', note TEXT, verdictAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_voice_cast_candidates_round ON voice_cast_candidates(roundId);
  `);
}

export function insertRound(db: Db, r: CastRound): void {
  db.prepare(`INSERT INTO voice_cast_rounds (id,gameId,characterId,roundNo,brief,sampleText,model,status,ownerNote,createdAt,closedAt)
    VALUES (@id,@gameId,@characterId,@roundNo,@brief,@sampleText,@model,@status,@ownerNote,@createdAt,@closedAt)`).run(r);
}
export function insertCandidate(db: Db, c: CastCandidate): void {
  db.prepare(`INSERT INTO voice_cast_candidates (voiceId,roundId,label,seed,parentVoiceId,verdict,note,verdictAt)
    VALUES (@voiceId,@roundId,@label,@seed,@parentVoiceId,@verdict,@note,@verdictAt)`).run(c);
}

export function getRound(db: Db, id: string): CastRound | null {
  return (db.prepare('SELECT * FROM voice_cast_rounds WHERE id=?').get(id) as CastRound | undefined) ?? null;
}
export function listRounds(db: Db, gameId: string, characterId: string): CastRound[] {
  return db.prepare('SELECT * FROM voice_cast_rounds WHERE gameId=? AND characterId=? ORDER BY roundNo').all(gameId, characterId) as CastRound[];
}
export function openRound(db: Db, gameId: string, characterId: string): CastRound | null {
  return listRounds(db, gameId, characterId).find((r) => r.status === 'open') ?? null;
}
export function nextRoundNo(db: Db, gameId: string, characterId: string): number {
  const r = db.prepare('SELECT MAX(roundNo) AS n FROM voice_cast_rounds WHERE gameId=? AND characterId=?').get(gameId, characterId) as { n: number | null };
  return (r.n ?? 0) + 1;
}
export function getCandidate(db: Db, voiceId: string): CastCandidate | null {
  return (db.prepare('SELECT * FROM voice_cast_candidates WHERE voiceId=?').get(voiceId) as CastCandidate | undefined) ?? null;
}

/** Every round of a character with its candidates (and their voice rows), oldest round first. */
export function roundViews(db: Db, gameId: string, characterId: string): RoundView[] {
  const voices = new Map(listVoices(db, gameId).map((v) => [v.id, v]));
  return listRounds(db, gameId, characterId).map((round) => {
    const rows = db.prepare('SELECT * FROM voice_cast_candidates WHERE roundId=? ORDER BY rowid').all(round.id) as Raw[];
    const candidates = rows.flatMap((c) => {
      const voice = voices.get(String(c.voiceId));
      return voice ? [{ voice, candidate: c as unknown as CastCandidate }] : [];
    });
    return { round, candidates };
  });
}

export type VerdictResult = { ok: true; round: CastRound } | { ok: false; error: string; status: number };

/**
 * The owner's verdict on one candidate (the caller has passed the human gate). `cast` also casts the voice for
 * its character (`castVoice`: a prior cast returns to candidate) and closes the round as `cast`.
 */
export function setCastVerdict(db: Db, voiceId: string, verdict: CastVerdict, note: string | null, at = Date.now()): VerdictResult {
  const c = getCandidate(db, voiceId);
  if (!c) return { ok: false, error: `voice ${voiceId} is not a casting candidate`, status: 404 };
  const round = getRound(db, c.roundId);
  if (!round) return { ok: false, error: `round ${c.roundId} is gone`, status: 404 };
  if (round.status !== 'open') return { ok: false, error: `round ${round.roundNo} is already ${round.status}; verdicts are closed`, status: 409 };
  db.transaction(() => {
    db.prepare('UPDATE voice_cast_candidates SET verdict=?, note=?, verdictAt=? WHERE voiceId=?').run(verdict, note, verdict === 'pending' ? null : at, voiceId);
    if (verdict === 'cast') {
      castVoice(db, voiceId, at);
      db.prepare("UPDATE voice_cast_rounds SET status='cast', closedAt=?, ownerNote=COALESCE(?, ownerNote) WHERE id=?").run(at, note, round.id);
    }
  })();
  return { ok: true, round: getRound(db, round.id)! };
}

/** Close an open round without a cast; every candidate needs a verdict first (unheard = no feedback). */
export function closeRound(db: Db, roundId: string, note: string | null, at = Date.now()): VerdictResult {
  const round = getRound(db, roundId);
  if (!round) return { ok: false, error: `no round ${roundId}`, status: 404 };
  if (round.status !== 'open') return { ok: false, error: `round ${round.roundNo} is already ${round.status}`, status: 409 };
  const pending = (db.prepare("SELECT COUNT(*) AS n FROM voice_cast_candidates WHERE roundId=? AND verdict='pending'").get(roundId) as { n: number }).n;
  if (pending > 0) return { ok: false, error: `${pending} candidate${pending === 1 ? '' : 's'} still without a verdict (cast, iterate or decline each one first)`, status: 409 };
  db.prepare("UPDATE voice_cast_rounds SET status='closed', ownerNote=?, closedAt=? WHERE id=?").run(note, at, roundId);
  return { ok: true, round: getRound(db, roundId)! };
}

/** The voice a candidate was iterated from, if it still exists. */
export const parentOf = (db: Db, c: CastCandidate): VoiceRow | null => (c.parentVoiceId ? getVoice(db, c.parentVoiceId) : null);
