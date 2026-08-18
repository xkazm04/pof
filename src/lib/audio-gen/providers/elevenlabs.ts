import type {
  AudioGenRequest,
  AudioGenResult,
  AudioProvider,
} from '@/lib/audio-gen/types';
import { refusalMessage, supportsKind } from '@/lib/audio-gen/capabilities';
import { logger } from '@/lib/logger';

const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation';

/** Re-checks the key each call so the no-key path is reliable (mirrors verify/visual). */
function getKey(): string | null {
  return process.env.ELEVENLABS_API_KEY ?? null;
}

/**
 * ElevenLabs, as PoF actually calls it: ONE endpoint, `/v1/sound-generation`.
 *
 * `capabilities` used to claim `tts` and the licence map used to price `music`,
 * but neither has an endpoint here — both requests were POSTed to
 * sound-generation and returned an SFX clip under the wrong label. The claims
 * are removed rather than half-kept:
 *
 * - **tts** needs `/v1/text-to-speech/{voice_id}` plus a chosen voice, a voice
 *   catalogue to choose it from, and its own settings block. That is a second
 *   integration, not a flag — so PoF does not claim text-to-speech.
 * - **music** is ElevenLabs' separate music product with its own endpoint and
 *   its own licence terms; PoF calls neither, so it prices neither.
 *
 * `sfx` and `ambient` are both honestly served by sound-generation — ambient is
 * the same synthesis with a longer prompt and duration.
 */
export const ElevenLabsProvider: AudioProvider = {
  id: 'elevenlabs',
  label: 'ElevenLabs',
  capabilities: ['sfx', 'ambient'],
  commercialLicense: {
    sfx: 'yes',
    ambient: 'yes',
  },
  unsupported: {
    music: 'PoF only calls /v1/sound-generation, which synthesises sound effects. '
      + 'ElevenLabs music is a separate product and endpoint that PoF does not integrate, '
      + 'so a music request here would return an SFX clip filed as music.',
    tts: 'Text-to-speech needs /v1/text-to-speech/{voice_id} and a chosen voice; '
      + 'PoF integrates neither, so speech cannot be produced here.',
  },

  async generate(req: AudioGenRequest): Promise<AudioGenResult> {
    // Defence in depth: the route refuses first, but a direct caller must not be
    // able to slip an unserved kind into the one endpoint this provider has.
    if (!supportsKind(ElevenLabsProvider, req.kind)) {
      throw new Error(refusalMessage(ElevenLabsProvider, req.kind));
    }

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
