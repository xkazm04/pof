/* ══════════════════════════════════════════════════════════════════════════
   TYPES — mirrors UDamageNumberWidget.h exactly
   ══════════════════════════════════════════════════════════════════════════ */

export type DamageElement = 'physical' | 'fire' | 'ice' | 'lightning' | 'heal';

export type PhysicsMode = 'linear' | 'gravity' | 'fountain' | 'directional';
export type StackMode = 'none' | 'accumulate' | 'merge';

export interface PhysicsConfig {
  lifetime: number;         // seconds (C++ default: 1.0)
  floatDistance: number;     // pixels (C++ default: 80)
  horizontalSpread: number;  // pixels (C++ default: 30)
  normalFontSize: number;    // px (C++ default: 18)
  critFontSize: number;      // px (C++ default: 26)
  fadeStart: number;         // 0-1 (C++ default: 0.4)
  physicsMode: PhysicsMode;
  gravity: number;           // px/s² for gravity mode
  collisionAvoidance: boolean;
  collisionRadius: number;   // px
  stackMode: StackMode;
  stackWindowMs: number;     // ms within which hits merge
  trailEnabled: boolean;
  trailLength: number;       // number of trail particles
  critScaleBurst: number;    // initial scale multiplier for crits
}

export interface CombatConfig {
  dps: number;
  critRate: number;          // 0-1
  critMultiplier: number;
  attacksPerSecond: number;
  mobCount: number;
  elementWeights: Record<DamageElement, number>;
  healPercent: number;       // 0-1 chance of heal instead of damage
}

// Single damage number particle in the simulation
export interface DmgParticle {
  id: number;
  amount: number;
  isCrit: boolean;
  isHeal: boolean;
  element: DamageElement;
  x: number;           // current position
  y: number;
  vx: number;          // velocity
  vy: number;
  startX: number;
  startY: number;
  elapsed: number;
  opacity: number;
  scale: number;
  fontSize: number;
  displayText: string;
  color: string;
  stackCount: number;  // for accumulate mode
  trail: { x: number; y: number; opacity: number }[];
  mobIndex: number;     // which mob spawned this
}

export interface ReadabilityMetrics {
  avgOverlaps: number;
  maxSimultaneous: number;
  avgReadTime: number; // how long a number is readable (opacity > 0.5)
  clutterScore: number; // 0-100, higher = worse
}
