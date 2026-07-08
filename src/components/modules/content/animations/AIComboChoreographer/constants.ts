import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { HitType, HitSpec } from './types';

export const HIT_TEMPLATES: Record<HitType, Omit<HitSpec, 'label'>> = {
  light:    { type: 'light',    baseDuration: 0.40, baseDamage: 20, rootMotion: 30,  hasMotionWarp: false, hitWindowStart: 0.20, hitWindowWidth: 0.20, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.20, vfxWindowWidth: 0.12 },
  medium:   { type: 'medium',   baseDuration: 0.50, baseDamage: 35, rootMotion: 50,  hasMotionWarp: false, hitWindowStart: 0.18, hitWindowWidth: 0.25, comboWindowStart: 0.50, comboWindowWidth: 0.35, vfxWindowStart: 0.18, vfxWindowWidth: 0.15 },
  heavy:    { type: 'heavy',    baseDuration: 0.70, baseDamage: 60, rootMotion: 85,  hasMotionWarp: true,  hitWindowStart: 0.15, hitWindowWidth: 0.30, comboWindowStart: 0.55, comboWindowWidth: 0.25, vfxWindowStart: 0.15, vfxWindowWidth: 0.20 },
  sweep:    { type: 'sweep',    baseDuration: 0.55, baseDamage: 30, rootMotion: 40,  hasMotionWarp: false, hitWindowStart: 0.15, hitWindowWidth: 0.35, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.15, vfxWindowWidth: 0.25 },
  thrust:   { type: 'thrust',   baseDuration: 0.45, baseDamage: 40, rootMotion: 100, hasMotionWarp: true,  hitWindowStart: 0.22, hitWindowWidth: 0.18, comboWindowStart: 0.50, comboWindowWidth: 0.30, vfxWindowStart: 0.22, vfxWindowWidth: 0.10 },
  slam:     { type: 'slam',     baseDuration: 0.80, baseDamage: 75, rootMotion: 60,  hasMotionWarp: true,  hitWindowStart: 0.30, hitWindowWidth: 0.25, comboWindowStart: 0.65, comboWindowWidth: 0.20, vfxWindowStart: 0.30, vfxWindowWidth: 0.30 },
  uppercut: { type: 'uppercut', baseDuration: 0.50, baseDamage: 45, rootMotion: 35,  hasMotionWarp: true,  hitWindowStart: 0.25, hitWindowWidth: 0.20, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.25, vfxWindowWidth: 0.15 },
  spin:     { type: 'spin',     baseDuration: 0.60, baseDamage: 40, rootMotion: 20,  hasMotionWarp: false, hitWindowStart: 0.10, hitWindowWidth: 0.40, comboWindowStart: 0.55, comboWindowWidth: 0.30, vfxWindowStart: 0.10, vfxWindowWidth: 0.30 },
};

export const HIT_LABELS: Record<HitType, string[]> = {
  light:    ['Quick Slash', 'Jab', 'Light Cut', 'Flick Strike'],
  medium:   ['Cross Cut', 'Diagonal Slash', 'Side Swipe', 'Mid Strike'],
  heavy:    ['Heavy Overhead', 'Crushing Blow', 'Power Strike', 'Execution Swing'],
  sweep:    ['Wide Sweep', 'Arc Slash', 'Cleaving Swing', 'Reaping Cut'],
  thrust:   ['Piercing Thrust', 'Lunge', 'Stab', 'Impale'],
  slam:     ['Ground Slam', 'Earthshatter', 'Crater Smash', 'Seismic Strike'],
  uppercut: ['Rising Slash', 'Uppercut', 'Skyward Cut', 'Launcher'],
  spin:     ['Whirlwind', 'Spinning Slash', 'Cyclone Cut', 'Tornado Strike'],
};

export const KEYWORD_MAP: Record<string, HitType> = {
  light: 'light', quick: 'light', fast: 'light', jab: 'light', flick: 'light', tap: 'light',
  medium: 'medium', cross: 'medium', diagonal: 'medium', mid: 'medium', standard: 'medium',
  heavy: 'heavy', overhead: 'heavy', power: 'heavy', crushing: 'heavy', strong: 'heavy',
  sweep: 'sweep', wide: 'sweep', arc: 'sweep', cleave: 'sweep', sweeping: 'sweep',
  thrust: 'thrust', lunge: 'thrust', stab: 'thrust', pierce: 'thrust', piercing: 'thrust',
  slam: 'slam', ground: 'slam', smash: 'slam', crater: 'slam', pound: 'slam',
  uppercut: 'uppercut', rising: 'uppercut', launch: 'uppercut', launcher: 'uppercut', skyward: 'uppercut',
  spin: 'spin', whirlwind: 'spin', spinning: 'spin', cyclone: 'spin', tornado: 'spin',
  finisher: 'heavy', finish: 'heavy', followup: 'medium', 'follow-up': 'medium',
};

/* ══════════════════════════════════════════════════════════════════════════
   PRESETS
   ══════════════════════════════════════════════════════════════════════════ */

export const COMBO_PRESETS = [
  { label: 'Basic 3-Hit', prompt: '3-hit combo with light slash, cross cut follow-up, and heavy overhead finisher' },
  { label: 'Sweep Finisher', prompt: '4-hit combo: quick jab, jab, diagonal slash, wide sweeping finisher' },
  { label: 'Thrust Combo', prompt: '3-hit combo with piercing thrust opener, spinning follow-up, heavy slam finisher with ground impact' },
  { label: 'Launcher', prompt: '2-hit combo: fast sweep into rising uppercut launcher' },
  { label: 'Whirlwind', prompt: '5-hit light spin spin spin spin heavy slam finisher' },
  { label: 'Boss Punish', prompt: '3-hit combo: quick thrust, thrust, ground slam with motion warp finisher' },
];

/* ══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

export const ACCENT = ACCENT_VIOLET;

export const WINDOW_ORDER = ['MotionWarp', 'ComboWindow', 'HitDetection', 'SpawnVFX'] as const;
