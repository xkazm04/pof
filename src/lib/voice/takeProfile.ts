/**
 * A cast voice's TAKE PROFILE: the render recipe the owner decided for it (model, pace, stability, style).
 * The profile lives on the voice row; a take records the recipe it was rendered with (`TakeSettings`), and an
 * approval is bound to it: a take whose recipe differs from its voice's CURRENT profile is not current
 * (`staleReason` 'profile-changed' in `lineQueue.ts`). A null profile means "no recipe decided": behaves
 * exactly as before (no profile staleness, provider defaults).
 */
import { SPEECH_MODELS } from '@/lib/audio-gen/providers/elevenlabs-speech';
import type { TakeProfile, TakeSettings } from '@/lib/voice/types';
import type { Result } from '@/types/result';

/** Numbers compare within this (a profile typed as 1.2 against a take stored as 1.2000000000000002). */
export const PROFILE_EPSILON = 0.001;

export const PROFILE_BOUNDS = { speed: [0.7, 1.2], stability: [0, 1], style: [0, 1] } as const;

/** True when a take's recipe is the profile: model exactly, speed/stability/style within PROFILE_EPSILON. */
export const profileMatches = (s: TakeSettings, p: TakeProfile): boolean =>
  s.model === p.model
  && Math.abs(s.speed - p.speed) <= PROFILE_EPSILON
  && Math.abs(s.stability - p.stability) <= PROFILE_EPSILON
  && Math.abs(s.style - p.style) <= PROFILE_EPSILON;

export const describeProfile = (p: TakeProfile | null | undefined): string =>
  p ? `${p.model}, speed ${p.speed}, stability ${p.stability}, style ${p.style}` : 'none';

/** Validate an owner-typed profile (`null` clears it). Out-of-range is refused, never silently clamped. */
export function parseProfile(raw: unknown): Result<TakeProfile | null, string> {
  if (raw === null) return { ok: true, data: null };
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'profile must be { model, speed, stability, style } or null' };
  const o = raw as Record<string, unknown>;
  if (typeof o.model !== 'string' || !(SPEECH_MODELS as readonly string[]).includes(o.model)) {
    return { ok: false, error: `model must be one of ${SPEECH_MODELS.join(', ')}` };
  }
  const num = (k: 'speed' | 'stability' | 'style'): number | string => {
    const v = o[k];
    const [lo, hi] = PROFILE_BOUNDS[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : `${k} must be a number from ${lo} to ${hi}`;
  };
  const speed = num('speed');
  const stability = num('stability');
  const style = num('style');
  const bad = [speed, stability, style].find((v) => typeof v === 'string');
  if (typeof bad === 'string') return { ok: false, error: bad };
  return { ok: true, data: { model: o.model, speed: speed as number, stability: stability as number, style: style as number } };
}

/** Request settings with the voice's profile as the default: only an explicitly given value overrides it. */
export function withProfile(profile: TakeProfile | null | undefined, over: Partial<TakeSettings> = {}): Partial<TakeSettings> {
  const given = Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined && v !== null)) as Partial<TakeSettings>;
  return profile ? { model: profile.model, speed: profile.speed, stability: profile.stability, style: profile.style, ...given } : given;
}
