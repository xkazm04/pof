import { describe, it, expect } from 'vitest';
import { AUDIO_PROVIDERS, getAudioProvider } from '@/lib/audio-gen/registry';

describe('audio-gen registry', () => {
  it('exposes elevenlabs as a registered provider', () => {
    expect(AUDIO_PROVIDERS.elevenlabs).toBeDefined();
    expect(getAudioProvider('elevenlabs')?.id).toBe('elevenlabs');
  });

  it('returns undefined for unknown providers', () => {
    expect(getAudioProvider('nope')).toBeUndefined();
  });

  it('elevenlabs licenses exactly the kinds it serves — and nothing it does not', () => {
    const p = getAudioProvider('elevenlabs')!;
    expect(p.capabilities.sort()).toEqual(['ambient', 'sfx']);
    expect(p.commercialLicense.sfx).toBe('yes');
    expect(p.commercialLicense.ambient).toBe('yes');
    // A licence badge for a kind the single `/v1/sound-generation` endpoint
    // cannot produce prices audio that will never exist. Both claims are gone,
    // replaced by a stated reason.
    expect(p.commercialLicense.tts).toBeUndefined();
    expect(p.commercialLicense.music).toBeUndefined();
    expect(p.unsupported.tts).toMatch(/text-to-speech/i);
    expect(p.unsupported.music).toMatch(/separate product/i);
  });
});
