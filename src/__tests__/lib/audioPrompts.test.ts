import { describe, it, expect } from 'vitest';
import { AUDIO_NEG_TAIL, AUDIO_PACKS, audioPromptFor } from '@/lib/media-prompts/audioPrompts';
import { ElevenLabsProvider } from '@/lib/audio-gen/providers/elevenlabs';
import { AUDIO_KINDS, type AudioKind } from '@/lib/audio-gen/types';

const packed = ElevenLabsProvider.capabilities;
const unpacked = AUDIO_KINDS.filter((k: AudioKind) => !packed.includes(k));

describe('audioPromptFor', () => {
  it('has a pack for exactly the kinds ElevenLabs serves', () => {
    expect(Object.keys(AUDIO_PACKS).sort()).toEqual([...packed].sort());
  });

  it.each(packed)('composes the %s clause and shared tail after the subject', (kind) => {
    const out = audioPromptFor(kind, 'Sword hitting a shield.');
    expect(out.startsWith('Sword hitting a shield. ')).toBe(true);
    expect(out).toContain(AUDIO_PACKS[kind]!.clause);
    expect(out.endsWith(AUDIO_NEG_TAIL)).toBe(true);
  });

  it.each(unpacked)('returns the subject byte-identical for unpacked kind %s', (kind) => {
    const subject = '  Hello there.  ';
    expect(audioPromptFor(kind, subject)).toBe(subject);
  });

  it('is pure and deterministic', () => {
    const subject = 'Door creak';
    const packsBefore = JSON.stringify(AUDIO_PACKS);
    const a = audioPromptFor('sfx', subject);
    expect(audioPromptFor('sfx', subject)).toBe(a);
    expect(subject).toBe('Door creak');
    expect(JSON.stringify(AUDIO_PACKS)).toBe(packsBefore);
  });
});
