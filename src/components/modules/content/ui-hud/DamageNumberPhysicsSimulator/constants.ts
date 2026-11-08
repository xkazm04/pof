import {
  Zap, Flame, Snowflake, Heart, Swords,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { DamageElement, PhysicsConfig, CombatConfig } from './types';

export const ACCENT = MODULE_COLORS.content;

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS — mirrors UDamageNumberWidget.h exactly
   ══════════════════════════════════════════════════════════════════════════ */

/** FLinearColor values from UDamageNumberWidget.h - the one source for every damage-number tool. */
export const ELEMENT_RGBA: Record<DamageElement, [number, number, number, number]> = {
  physical: [1.0, 1.0, 1.0, 1.0],
  fire: [1.0, 0.3, 0.1, 1.0],
  ice: [0.3, 0.6, 1.0, 1.0],
  lightning: [1.0, 1.0, 0.2, 1.0],
  heal: [0.2, 1.0, 0.3, 1.0],
};

/** Header default font sizes (px): normal and crit. */
export const NORMAL_FONT_SIZE = 18;
export const CRIT_FONT_SIZE = 26;

export function rgbaToCss([r, g, b, a]: [number, number, number, number]): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}

export const ELEMENT_COLORS: Record<DamageElement, string> = {
  physical: rgbaToCss(ELEMENT_RGBA.physical),
  fire: rgbaToCss(ELEMENT_RGBA.fire),
  ice: rgbaToCss(ELEMENT_RGBA.ice),
  lightning: rgbaToCss(ELEMENT_RGBA.lightning),
  heal: rgbaToCss(ELEMENT_RGBA.heal),
};

export const ELEMENT_ICONS: Record<DamageElement, typeof Swords> = {
  physical: Swords,
  fire: Flame,
  ice: Snowflake,
  lightning: Zap,
  heal: Heart,
};

export const DEFAULT_PHYSICS: PhysicsConfig = {
  lifetime: 1.0,
  floatDistance: 80,
  horizontalSpread: 30,
  normalFontSize: NORMAL_FONT_SIZE,
  critFontSize: CRIT_FONT_SIZE,
  fadeStart: 0.4,
  physicsMode: 'linear',
  gravity: 200,
  collisionAvoidance: false,
  collisionRadius: 20,
  stackMode: 'none',
  stackWindowMs: 150,
  trailEnabled: false,
  trailLength: 4,
  critScaleBurst: 1.5,
};

export const DEFAULT_COMBAT: CombatConfig = {
  dps: 500,
  critRate: 0.15,
  critMultiplier: 2.0,
  attacksPerSecond: 3,
  mobCount: 1,
  elementWeights: { physical: 0.5, fire: 0.2, ice: 0.1, lightning: 0.1, heal: 0.1 },
  healPercent: 0,
};

export const PRESETS: { id: string; name: string; physics: Partial<PhysicsConfig>; combat: Partial<CombatConfig> }[] = [
  {
    id: 'default', name: 'UE5 Default',
    physics: { physicsMode: 'linear', collisionAvoidance: false, stackMode: 'none', trailEnabled: false },
    combat: { dps: 500, attacksPerSecond: 3, mobCount: 1, critRate: 0.15 },
  },
  {
    id: 'diablo', name: 'Diablo-style',
    physics: { physicsMode: 'fountain', collisionAvoidance: true, stackMode: 'accumulate', stackWindowMs: 200, trailEnabled: false, floatDistance: 100, lifetime: 1.2 },
    combat: { dps: 2000, attacksPerSecond: 8, mobCount: 3, critRate: 0.25 },
  },
  {
    id: 'soulslike', name: 'Souls-like',
    physics: { physicsMode: 'gravity', gravity: 250, collisionAvoidance: false, stackMode: 'none', trailEnabled: true, trailLength: 3, floatDistance: 60, lifetime: 0.8 },
    combat: { dps: 800, attacksPerSecond: 1.5, mobCount: 1, critRate: 0.1 },
  },
  {
    id: 'clutter', name: 'AoE Stress Test',
    physics: { physicsMode: 'directional', collisionAvoidance: true, stackMode: 'merge', stackWindowMs: 100, trailEnabled: true, trailLength: 5, floatDistance: 120, lifetime: 1.5 },
    combat: { dps: 5000, attacksPerSecond: 12, mobCount: 5, critRate: 0.3 },
  },
];
