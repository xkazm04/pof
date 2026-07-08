// ── Types ──────────────────────────────────────────────────────────────────

export interface RGBA { r: number; g: number; b: number; a: number }

export interface HudTheme {
  // Health bar
  healthyColor: RGBA;
  dangerColor: RGBA;
  manaColor: RGBA;
  lowHealthThreshold: number;   // 0-1
  lowHealthPulseSpeed: number;  // Hz
  barInterpSpeed: number;       // units/s

  // Damage numbers
  elementColors: Record<string, RGBA>;
  normalFontSize: number;       // pt
  critFontSize: number;         // pt
  floatDistance: number;         // px
  horizontalSpread: number;     // px
  damageLifetime: number;       // seconds

  // Enemy health bar
  fadeInDuration: number;       // seconds
  fadeOutDuration: number;      // seconds
  fadeOutDelay: number;         // seconds
  enemyBarColor: RGBA;
}

// ── Damage number data for the combat sim ──────────────────────────────────

export interface DamageEvent {
  id: number;
  amount: number;
  element: string;
  isCrit: boolean;
  isHeal: boolean;
  spawnTime: number;
  offsetX: number; // random horizontal offset
}
