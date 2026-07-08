import {
  Zap, Flame, Snowflake, Heart, Swords,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import type { DamageElement, PhysicsConfig, CombatConfig } from './types';

export const ACCENT = MODULE_COLORS.content;

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTS — mirrors UDamageNumberWidget.h exactly
   ══════════════════════════════════════════════════════════════════════════ */

export const ELEMENT_COLORS: Record<DamageElement, string> = {
  physical: 'rgba(255,255,255,1)',
  fire: 'rgba(255,77,26,1)',
  ice: 'rgba(77,153,255,1)',
  lightning: 'rgba(255,255,51,1)',
  heal: 'rgba(51,255,77,1)',
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
  normalFontSize: 18,
  critFontSize: 26,
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
