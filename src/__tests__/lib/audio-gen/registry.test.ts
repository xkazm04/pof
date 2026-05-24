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

  it('elevenlabs declares sfx + ambient + tts as commercially licensed and music as extra-license', () => {
    const p = getAudioProvider('elevenlabs')!;
    expect(p.commercialLicense.sfx).toBe('yes');
    expect(p.commercialLicense.ambient).toBe('yes');
    expect(p.commercialLicense.tts).toBe('yes');
    expect(p.commercialLicense.music).toBe('extra-license');
  });
});
