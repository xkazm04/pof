/**
 * A take (or a voice's design preview) "as the game plays it" (lane pof-voice, server-only): the same master export writes (the game's
 * voice level, mono, and the speaker's device treatment when the game declares one), rendered once per take
 * and target into `<voiceDir>/as-game/` and streamed to the room's player. So the owner judges what the
 * player will hear, and takes are compared at matched loudness (a louder take otherwise sounds better).
 * Read-only toward the game: it only reads the mix table; nothing is written in the game root.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { getTake, getVoice } from '@/lib/voice/voice-db';
import { convertToOgg, isInVoiceDir, voiceDir } from '@/lib/voice/storage';
import { DEFAULT_VOICE_TARGET, voiceMasterTarget, type VoiceMasterTarget } from '@/lib/voice/mastering';
import type { Result } from '@/types/result';

type Env = Readonly<Record<string, string | undefined>>;

export interface AsGameDeps {
  convert: (src: string, dst: string, target: VoiceMasterTarget, treatment?: string) => Promise<string | null>;
  env?: Env;
}

export interface AsGameFile { file: string; target: VoiceMasterTarget; treatment: string | null }

/** The mastered file for a take, rendered on first ask; a later ask with the same target reuses it. */
export async function asGameFile(
  db: Database.Database, takeId: string, gameRoot: string | null, deps: AsGameDeps = { convert: convertToOgg },
): Promise<Result<AsGameFile, string>> {
  const take = getTake(db, takeId);
  if (!take) return { ok: false, error: 'no such take audio' };
  return masterOnce(take.file, `take-${take.id}`, getVoice(db, take.voiceId)?.characterId, gameRoot, deps);
}

/** A voice's design preview at the game's level: casting compares candidates at matched loudness too. */
export async function asGamePreview(
  db: Database.Database, voiceId: string, gameRoot: string | null, deps: AsGameDeps = { convert: convertToOgg },
): Promise<Result<AsGameFile, string>> {
  const voice = getVoice(db, voiceId);
  const file = voice?.previews[0]?.file;
  if (!voice || !file) return { ok: false, error: 'no such preview audio' };
  return masterOnce(file, `preview-${voice.id}`, voice.characterId, gameRoot, deps);
}

async function masterOnce(
  src: string, name: string, speaker: string | undefined, gameRoot: string | null, deps: AsGameDeps,
): Promise<Result<AsGameFile, string>> {
  if (!isInVoiceDir(src, deps.env) || !fs.existsSync(src)) return { ok: false, error: `no such ${name.split('-')[0]} audio` };
  const target = gameRoot ? voiceMasterTarget(gameRoot) : DEFAULT_VOICE_TARGET;
  const treatment = (speaker && target.treatments?.[speaker]) || null;
  const key = createHash('sha256').update(JSON.stringify([target.lufs, target.truePeakDb, treatment])).digest('hex').slice(0, 10);
  const file = path.join(voiceDir(deps.env), 'as-game', `${name}-${key}.ogg`);
  if (!fs.existsSync(file)) {
    // Render beside the final name and rename: two players asking at once never stream a half-written file.
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp.ogg`;
    const err = await deps.convert(src, tmp, target, treatment ?? undefined);
    if (err) { fs.rmSync(tmp, { force: true }); return { ok: false, error: err }; }
    fs.renameSync(tmp, file);
  }
  return { ok: true, data: { file, target, treatment } };
}
