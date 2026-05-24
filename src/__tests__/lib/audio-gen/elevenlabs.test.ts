import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElevenLabsProvider } from '@/lib/audio-gen/providers/elevenlabs';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ELEVENLABS_API_KEY;
});

describe('ElevenLabsProvider.generate', () => {
  it('throws when ELEVENLABS_API_KEY is missing', async () => {
    await expect(
      ElevenLabsProvider.generate({ kind: 'sfx', prompt: 'footstep' }),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });

  it('POSTs sound-generation with text + duration + output_format=mp3', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    const audio = new Uint8Array([0x49, 0x44, 0x33]); // mp3 header bytes
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(audio, { status: 200 }),
    );

    const res = await ElevenLabsProvider.generate({
      kind: 'sfx',
      prompt: 'footstep on stone',
      durationSeconds: 1.5,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/v1/sound-generation');
    expect(url).toContain('output_format=mp3_44100_128');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['xi-api-key']).toBe('sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe('footstep on stone');
    expect(body.duration_seconds).toBe(1.5);

    expect(res.format).toBe('mp3');
    expect(res.bytes.length).toBe(3);
    expect(res.durationMs).toBe(1500);
  });

  it('surfaces non-OK responses as Error', async () => {
    process.env.ELEVENLABS_API_KEY = 'sk-test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited', { status: 429 }),
    );
    await expect(
      ElevenLabsProvider.generate({ kind: 'sfx', prompt: 'x' }),
    ).rejects.toThrow(/429/);
  });
});
