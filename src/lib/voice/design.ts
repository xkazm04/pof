/**
 * Voice design for a character, driven by its voice bible (`games/gtai/voices/<id>.md`), and stock
 * candidates. Both only ADD `candidate` voices; casting is the owner's click (`gate.ts`).
 * Never a clone and never an imitation of a real person: no reference audio is sent, and the description
 * carries an explicit "original voice" clause.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { designVoice } from '@/lib/audio-gen/providers/elevenlabs-speech';
import type { SpeechDesignRequest, SpeechDesignResult } from '@/lib/audio-gen/types';
import { insertVoice, listLines, listVoices } from '@/lib/voice/voice-db';
import { writeVoiceFile } from '@/lib/voice/storage';
import type { VoiceRow } from '@/lib/voice/types';
import type { Result } from '@/types/result';

export const ORIGINAL_VOICE_CLAUSE = 'An original fictional character voice; not an imitation of any real person.';
const MAX_DESCRIPTION = 1000;

export function readBible(root: string, characterId: string): string | null {
  if (!/^[a-z0-9-]+$/.test(characterId)) return null;
  try {
    return fs.readFileSync(path.join(root, 'games', 'gtai', 'voices', `${characterId}.md`), 'utf8');
  } catch {
    return null;
  }
}

/** The bible's title, rhythm and profanity sections, condensed into a design description. */
export function bibleDescription(bible: string): string {
  const title = /^#\s*Voice bible:\s*(.+)$/m.exec(bible)?.[1]?.trim() ?? '';
  const section = (name: string) => {
    const m = new RegExp(`^##\\s*${name}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'm').exec(bible);
    return m ? m[1].replace(/^[-*\d.]+\s*/gm, '').replace(/\s+/g, ' ').trim() : '';
  };
  const parts = [title, section('Want'), section('Rhythm'), section('Profanity register')].filter(Boolean);
  const body = parts.join('. ').slice(0, MAX_DESCRIPTION - ORIGINAL_VOICE_CLAUSE.length - 2);
  return `${body}. ${ORIGINAL_VOICE_CLAUSE}`;
}

/** 100-1000 chars for the previews to speak: the character's own queue lines, in play order. */
export function previewText(db: Database.Database, gameId: string, characterId: string): string | null {
  const own = listLines(db, gameId).filter((l) => l.speaker === characterId).map((l) => l.text);
  let text = '';
  for (const t of own) {
    if ((text + ' ' + t).length > 400) break;
    text = text ? `${text} ${t}` : t;
  }
  while (text && text.length < 100) text = `${text} ${own[0]}`;
  return text.length >= 100 ? text.slice(0, 1000) : null;
}

export interface DesignDeps { design: (req: SpeechDesignRequest) => Promise<SpeechDesignResult>; now: () => number }

export async function designForCharacter(
  db: Database.Database, root: string, gameId: string, characterId: string,
  opts: { n?: number; description?: string } = {}, deps: DesignDeps = { design: designVoice, now: Date.now },
): Promise<Result<{ voices: VoiceRow[]; chars: number }, string>> {
  const bible = readBible(root, characterId);
  if (!bible && !opts.description) return { ok: false, error: `no voice bible for ${characterId} (games/gtai/voices/${characterId}.md)` };
  const description = opts.description ? `${opts.description.trim().slice(0, 900)}. ${ORIGINAL_VOICE_CLAUSE}` : bibleDescription(bible!);
  const text = previewText(db, gameId, characterId);
  if (!text) return { ok: false, error: `${characterId} has no queue lines to preview (voice design needs 100+ chars)` };
  try {
    const r = await deps.design({ description, text });
    const n = Math.max(1, Math.min(3, opts.n ?? 3));
    const voices = r.previews.slice(0, n).map((p, i): VoiceRow => {
      const id = randomUUID();
      const file = writeVoiceFile(`${gameId}/previews/${characterId}/${id}.mp3`, p.bytes);
      const at = deps.now() + i;
      return {
        id, gameId, characterId, name: `designed ${new Date(at).toISOString().slice(0, 16)} #${i + 1}`, providerVoiceId: null,
        source: 'designed', designPrompt: description, previews: [{ generatedVoiceId: p.generatedVoiceId, file, durationMs: p.durationMs }],
        status: 'candidate', createdAt: at, updatedAt: at,
      };
    });
    for (const v of voices) insertVoice(db, v);
    return { ok: true, data: { voices, chars: r.chars } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** A stock (premade) provider voice as a candidate — e.g. the audio lane's casting.json picks (`voice.mjs stock --casting`). */
export function addStockCandidate(db: Database.Database, gameId: string, characterId: string, providerVoiceId: string, name: string, note: string | null, at = Date.now()): VoiceRow {
  // Idempotent: the same premade voice for the same character is one candidate, however often it is added.
  const existing = listVoices(db, gameId).find((v) => v.characterId === characterId && v.providerVoiceId === providerVoiceId);
  if (existing) return existing;
  const v: VoiceRow = {
    id: randomUUID(), gameId, characterId, name, providerVoiceId, source: 'stock', designPrompt: note, previews: [],
    status: 'candidate', createdAt: at, updatedAt: at,
  };
  insertVoice(db, v);
  return v;
}
