/**
 * Set or clear a CAST voice's take profile (the gated route calls this after `gateRefusal`). Reports how many
 * lines the edit un-proved: a line is proven by an approved take rendered with the voice's profile, so a
 * recipe change invalidates the lines whose sound changed (registry `line-id-catalog-and-revision-diff`).
 */
import type Database from 'better-sqlite3';
import { queueEntries, syncQueue } from '@/lib/voice/lineQueue';
import { parseProfile } from '@/lib/voice/takeProfile';
import { getVoice, setTakeProfile } from '@/lib/voice/voice-db';
import type { VoiceRow } from '@/lib/voice/types';

export type ProfileEditResult = { ok: true; voice: VoiceRow; unproven: number } | { ok: false; error: string; status: number };

export function editTakeProfile(db: Database.Database, gameId: string, root: string, voiceId: string, raw: unknown, at = Date.now()): ProfileEditResult {
  const voice = getVoice(db, voiceId);
  if (!voice || voice.gameId !== gameId) return { ok: false, error: `no voice ${voiceId}`, status: 404 };
  if (voice.status !== 'cast') return { ok: false, error: 'Only a cast voice carries a take profile: cast this voice first.', status: 409 };
  const parsed = parseProfile(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  const proven = () => new Set(queueEntries(db, gameId, syncQueue(db, gameId, root)).filter((e) => e.state === 'proven').map((e) => `${e.questId}/${e.lineId}`));
  const before = proven();
  setTakeProfile(db, voiceId, parsed.data, at);
  const after = proven();
  return { ok: true, voice: getVoice(db, voiceId)!, unproven: [...before].filter((k) => !after.has(k)).length };
}
