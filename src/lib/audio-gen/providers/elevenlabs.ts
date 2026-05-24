import type {
  AudioGenRequest,
  AudioGenResult,
  AudioProvider,
} from '@/lib/audio-gen/types';
import { logger } from '@/lib/logger';

const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

/** Re-checks the key each call so the no-key path is reliable (mirrors verify/visual). */
function getKey(): string | null {
  return process.env.ELEVENLABS_API_KEY ?? null;
}

export const ElevenLabsProvider: AudioProvider = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  capabilities: ['sfx', 'ambient', 'tts'],
  commercialLicense: {
    sfx: 'yes',
    ambient: 'yes',
    tts: 'yes',
    music: 'extra-license',
  },

  async generate(req: AudioGenRequest): Promise<AudioGenResult> {
    const key = getKey();
    if (!key) throw new Error('ELEVENLABS_API_KEY not configured');

    const format: 'mp3' | 'wav' = 'mp3'; // tier-safe default
    const outputFormatQuery = 'mp3_44100_128';
    const body: Record<string, unknown> = { text: req.prompt };
    if (req.durationSeconds !== undefined) body.duration_seconds = req.durationSeconds;
    body.prompt_influence = 0.3;

    const url = `${ENDPOINT}?output_format=${outputFormatQuery}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('elevenlabs sound-generation failed', { status: res.status, text });
      throw new Error(`ElevenLabs ${res.status}: ${text.slice(0, 200)}`);
    }

    const arr = await res.arrayBuffer();
    return {
      bytes: Buffer.from(arr),
      format,
      durationMs: req.durationSeconds ? Math.round(req.durationSeconds * 1000) : 0,
    };
  },
};
