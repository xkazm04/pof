/**
 * Generate takes for a queue line (UI and headless share this). Generation is NOT gated — it only adds
 * `pending` takes for the owner to judge; verdicts are (see `gate.ts`).
 */
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createDesignedVoice, DEFAULT_SPEECH_MODEL, SPEECH_MODELS, synthesizeSpeech } from '@/lib/audio-gen/providers/elevenlabs-speech';
import type { SpeechRequest, SpeechResult } from '@/lib/audio-gen/types';
import { getLine, getVoice, insertTake, listVoices, setProviderVoiceId } from '@/lib/voice/voice-db';
import { measureAudio, writeVoiceFile, type AudioMeasure } from '@/lib/voice/storage';
import type { TakeRow, TakeSettings, VoiceRow } from '@/lib/voice/types';
import type { Result } from '@/types/result';

export const MAX_TAKES_PER_CALL = 5;

export interface TakeDeps {
  synth: (req: SpeechRequest) => Promise<SpeechResult>;
  createVoice: (name: string, description: string, generatedVoiceId: string) => Promise<string>;
  measure: (abs: string) => Promise<AudioMeasure>;
  now: () => number;
}
const DEFAULT_DEPS: TakeDeps = { synth: synthesizeSpeech, createVoice: createDesignedVoice, measure: measureAudio, now: Date.now };

export interface TakeRequest {
  gameId: string;
  questId: string;
  lineId: string;
  n: number;
  direction: string;
  /** A specific voice row; default = the speaker's cast voice, else its newest candidate. */
  voiceId?: string;
  settings?: Partial<TakeSettings>;
}

export function defaultSettings(over: Partial<TakeSettings> = {}): TakeSettings {
  const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const model = typeof over.model === 'string' && (SPEECH_MODELS as readonly string[]).includes(over.model) ? over.model : DEFAULT_SPEECH_MODEL;
  return {
    model,
    stability: clamp(over.stability, 0, 1, 0.5),
    similarityBoost: clamp(over.similarityBoost, 0, 1, 0.75),
    style: clamp(over.style, 0, 1, 0),
    speed: clamp(over.speed, 0.7, 1.2, 1),
  };
}

/** The voice a take for `speaker` uses: explicit, else cast, else the newest candidate. */
export function pickVoice(db: Database.Database, gameId: string, speaker: string, voiceId?: string): VoiceRow | null {
  if (voiceId) {
    const v = getVoice(db, voiceId);
    return v && v.gameId === gameId && v.characterId === speaker ? v : null;
  }
  const mine = listVoices(db, gameId).filter((v) => v.characterId === speaker);
  return mine.find((v) => v.status === 'cast') ?? mine.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

async function ensureProviderVoice(db: Database.Database, v: VoiceRow, deps: TakeDeps): Promise<string> {
  if (v.providerVoiceId) return v.providerVoiceId;
  const gen = v.previews.find((p) => p.generatedVoiceId)?.generatedVoiceId;
  if (!gen) throw new Error(`voice ${v.id} has neither a provider voice id nor a design preview`);
  const id = await deps.createVoice(`gtai ${v.characterId} ${v.name}`.slice(0, 60), v.designPrompt ?? v.characterId, gen);
  setProviderVoiceId(db, v.id, id, deps.now());
  return id;
}

export async function generateTakes(db: Database.Database, req: TakeRequest, deps: TakeDeps = DEFAULT_DEPS): Promise<Result<TakeRow[], string>> {
  const line = getLine(db, req.gameId, req.questId, req.lineId);
  if (!line || !line.present) return { ok: false, error: `no line ${req.questId}/${req.lineId} in the queue` };
  const n = Math.floor(req.n);
  if (!(n >= 1 && n <= MAX_TAKES_PER_CALL)) return { ok: false, error: `n must be 1-${MAX_TAKES_PER_CALL}` };
  const voice = pickVoice(db, req.gameId, line.speaker, req.voiceId);
  if (!voice) return { ok: false, error: `no voice for ${line.speaker}: design one or add a stock candidate first` };
  const settings = defaultSettings(req.settings);
  const direction = req.direction.trim();
  try {
    const providerVoiceId = await ensureProviderVoice(db, voice, deps);
    const out: TakeRow[] = [];
    for (let i = 0; i < n; i++) {
      const r = await deps.synth({ providerVoiceId, text: line.text, direction, settings });
      const id = randomUUID();
      const file = writeVoiceFile(`${req.gameId}/takes/${line.questId}/${line.lineId}/${id}.${r.format}`, r.bytes);
      const m = await deps.measure(file);
      const take: TakeRow = {
        id, gameId: req.gameId, questId: line.questId, lineId: line.lineId, voiceId: voice.id, providerVoiceId,
        textHash: line.textHash, direction, sentText: r.sentText, settings, file, durationMs: m.durationMs,
        loudnessLufs: m.loudnessLufs, maxSilenceMs: m.maxSilenceMs, chars: r.chars, verdict: 'pending', verdictNote: null, verdictAt: null, createdAt: deps.now() + i,
      };
      insertTake(db, take);
      out.push(take);
    }
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
