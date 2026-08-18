import { AUDIO_KINDS, type AudioKind, type AudioProvider } from '@/lib/audio-gen/types';

/**
 * The provider capability contract, in one place.
 *
 * `AudioProvider.capabilities` used to be decoration: the route never consulted
 * it, so a `music` or `tts` request reached ElevenLabs' `/v1/sound-generation`
 * like any other and came back as an SFX clip — billed, cached, and filed under
 * the kind the user asked for. These helpers are the single gate; both the route
 * and the provider itself refuse through them, and the Forge disables what they
 * report as unserved.
 */

/** Narrow untrusted input (a request body) to the closed `AudioKind` list. */
export function isAudioKind(value: unknown): value is AudioKind {
  return typeof value === 'string' && (AUDIO_KINDS as readonly string[]).includes(value);
}

/** True when the provider's `generate` really serves this kind. */
export function supportsKind(provider: AudioProvider, kind: AudioKind): boolean {
  return provider.capabilities.includes(kind);
}

/**
 * Why this kind is not served, or `null` when it IS served. Falls back to a
 * plain statement rather than silence — an undeclared reason must still read as
 * a refusal, never as an unexplained absence.
 */
export function unsupportedReason(provider: AudioProvider, kind: AudioKind): string | null {
  if (supportsKind(provider, kind)) return null;
  return provider.unsupported[kind]
    ?? `${provider.label} does not generate ${kind} audio, and no reason was recorded.`;
}

/** Every unserved kind with its reason — what the Forge lists under the picker. */
export function unsupportedKinds(provider: AudioProvider): Array<{ kind: AudioKind; reason: string }> {
  return AUDIO_KINDS
    .filter((k) => !supportsKind(provider, k))
    .map((kind) => ({ kind, reason: unsupportedReason(provider, kind)! }));
}

/** The refusal sentence shared by the route envelope and the provider guard. */
export function refusalMessage(provider: AudioProvider, kind: AudioKind): string {
  const served = provider.capabilities.join(', ') || 'nothing';
  return `${provider.label} cannot generate ${kind}: ${unsupportedReason(provider, kind)} `
    + `It serves ${served}. Nothing was generated and nothing was billed.`;
}
