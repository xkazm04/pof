/**
 * ElevenLabs SPEECH (the `tts` kind) and VOICE DESIGN — the voice room's provider (lane pof-voice).
 *
 * Separate from `elevenlabs.ts` (sound-generation) because speech needs a voice: the Sound Forge has no voice
 * picker, so it still refuses `tts` and points at the Voice room.
 *
 * Delivery direction, per model (ElevenLabs docs, read 2026-11-03):
 *  - `eleven_v3`: direction becomes inline AUDIO TAGS before the line (`[whispers] [panicking] text`); the
 *    voice settings still apply (stability is the main lever). This is the default model.
 *  - `eleven_multilingual_v2` / flash / turbo: tags would be SPOKEN, so the direction is recorded on the take
 *    but not sent; only `voice_settings` (stability, style, speed) carry the delivery.
 * Voice design: `POST /v1/text-to-voice/design` (description in, previews out), then `POST /v1/text-to-voice`
 * creates the chosen preview as a voice. Never a clone: no reference audio is ever sent.
 */
import type { SpeechDesignRequest, SpeechDesignResult, SpeechRequest, SpeechResult } from '@/lib/audio-gen/types';
import { logger } from '@/lib/logger';
import { ProviderNotConfiguredError } from '@/lib/audio-gen/errors';

const API = 'https://api.elevenlabs.io';
export const DEFAULT_SPEECH_MODEL = 'eleven_v3';
export const SPEECH_MODELS = ['eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'] as const;
export const DESIGN_MODEL = 'eleven_multilingual_ttv_v2';
/** The v3 design model (accepted by the live API 2026-11-06), used by casting rounds. */
export const DESIGN_MODEL_V3 = 'eleven_ttv_v3';

export const supportsAudioTags = (model: string): boolean => model === 'eleven_v3';

/** The direction words as v3 audio tags: "whispered, panicking, fast" → "[whispered] [panicking] [fast]". */
export function directionTags(direction: string): string {
  return direction.split(/[,;\n]/).map((s) => s.trim().replace(/[[\]]/g, '')).filter(Boolean).map((s) => `[${s}]`).join(' ');
}

/** Exactly what is sent (and billed) for a line under a model + direction. */
export function speechText(text: string, direction: string, model: string): string {
  const tags = supportsAudioTags(model) ? directionTags(direction) : '';
  return tags ? `${tags} ${text}` : text;
}

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new ProviderNotConfiguredError('ELEVENLABS_API_KEY not configured');
  return k;
}

async function post(pathAndQuery: string, body: unknown): Promise<Response> {
  const res = await fetch(`${API}${pathAndQuery}`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.warn('elevenlabs speech call failed', { path: pathAndQuery.split('?')[0], status: res.status });
    throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export async function synthesizeSpeech(req: SpeechRequest): Promise<SpeechResult> {
  const sentText = speechText(req.text, req.direction, req.settings.model);
  const res = await post(`/v1/text-to-speech/${encodeURIComponent(req.providerVoiceId)}?output_format=mp3_44100_128`, {
    text: sentText,
    model_id: req.settings.model,
    voice_settings: {
      stability: req.settings.stability,
      similarity_boost: req.settings.similarityBoost,
      style: req.settings.style,
      use_speaker_boost: true,
      speed: req.settings.speed,
    },
  });
  return { bytes: Buffer.from(await res.arrayBuffer()), format: 'mp3', sentText, chars: sentText.length };
}

export async function designVoice(req: SpeechDesignRequest): Promise<SpeechDesignResult> {
  const res = await post('/v1/text-to-voice/design?output_format=mp3_44100_128', {
    voice_description: req.description,
    model_id: req.model ?? DESIGN_MODEL,
    text: req.text,
    auto_generate_text: false,
    ...(typeof req.seed === 'number' ? { seed: req.seed } : {}),
  });
  const json = (await res.json()) as { text?: string; previews?: Array<{ audio_base_64: string; generated_voice_id: string; duration_secs?: number }> };
  const previews = (json.previews ?? []).map((p) => ({
    generatedVoiceId: p.generated_voice_id,
    bytes: Buffer.from(p.audio_base_64, 'base64'),
    durationMs: typeof p.duration_secs === 'number' ? Math.round(p.duration_secs * 1000) : null,
  }));
  const text = json.text ?? req.text;
  return { previews, text, chars: text.length };
}

export async function createDesignedVoice(name: string, description: string, generatedVoiceId: string): Promise<string> {
  const res = await post('/v1/text-to-voice', { voice_name: name, voice_description: description, generated_voice_id: generatedVoiceId });
  const json = (await res.json()) as { voice_id?: string };
  if (!json.voice_id) throw new Error('ElevenLabs created no voice_id');
  return json.voice_id;
}
