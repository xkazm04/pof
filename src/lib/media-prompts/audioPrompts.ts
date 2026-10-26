/**
 * ElevenLabs audio prompt packs (mirrors `iconPrompts.ts`). Each pack is a subject-agnostic craft clause
 * expressing the dark-fantasy ARPG direction as SOUND — source material, space, transient and tail
 * character — plus one shared negative/quality tail. `audioPromptFor(kind, subject)` composes
 * subject → kind clause → shared tail.
 *
 * Packs exist only for the kinds the ElevenLabs provider declares in `capabilities` (sfx, ambient).
 * `music` and `tts` are refused by that provider, so they get no clause and pass through unchanged.
 *
 * Consumed by `src/app/api/audio-gen/route.ts`, which composes before calling the provider, so the
 * provider still receives a single prompt string.
 *
 * NOTE (not measured): unlike the icon packs, these clauses have NO measured ceiling. Nothing has
 * scored generated audio against them yet, so there is no evidence they lift output quality. They are
 * a first-draft craft direction, to be validated by listening/judging before being trusted.
 */
import type { AudioKind } from '@/lib/audio-gen/types';

/** Failure modes to steer sound-generation away from, appended to every packed prompt. */
export const AUDIO_NEG_TAIL =
  'No music, no melody, no vocals, no spoken words, no voice-over, no lyrics. ' +
  'No clipping, no distortion, no hiss, no digital artifacts. Clean, isolated, game-ready audio.';

interface AudioPack {
  /** Subject-agnostic source material + space + transient/tail direction. Composed after the subject. */
  clause: string;
}

/** One pack per kind ElevenLabs sound-generation really serves. */
export const AUDIO_PACKS: Partial<Record<AudioKind, AudioPack>> = {
  sfx: {
    clause:
      'Dark-fantasy action-RPG sound effect. Heavy, tactile source material: iron and steel, leather, ' +
      'wet flesh, splintering wood, cracking stone, layered with a low sub-body thud for weight. Sharp ' +
      'defined transient attack that reads instantly in a busy mix, then a short natural tail with a ' +
      'touch of cavernous stone-hall reverb that decays cleanly. Gritty, grounded and physical, not cartoonish.',
  },
  ambient: {
    clause:
      'Dark-fantasy action-RPG ambient bed. Sparse, grim environmental texture: low wind through ruins, ' +
      'distant dripping water, faint creaking timber, deep cavern or crypt room tone, with a slow sub-bass ' +
      'drone for dread. Large, enclosed, reverberant space. No sharp transients and no prominent events, ' +
      'a soft slow-evolving texture with a long smooth tail, even in level so it can loop under gameplay.',
  },
};

/**
 * Compose the prompt sent to the audio provider. Pure: never mutates its input. A kind with no pack
 * returns `subject` exactly as given (byte-identical).
 */
export function audioPromptFor(kind: AudioKind, subject: string): string {
  const pack = AUDIO_PACKS[kind];
  if (!pack) return subject;
  return `${subject.trim().replace(/\.$/, '')}. ${pack.clause} ${AUDIO_NEG_TAIL}`;
}
