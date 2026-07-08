import { ELEMENT_COLORS } from './constants';
import type {
  DamageElement, PhysicsConfig, CombatConfig, DmgParticle, ReadabilityMetrics,
} from './types';

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION ENGINE
   ══════════════════════════════════════════════════════════════════════════ */

let nextParticleId = 0;

export function pickElement(weights: Record<DamageElement, number>, healPercent: number): { element: DamageElement; isHeal: boolean } {
  if (Math.random() < healPercent) return { element: 'heal', isHeal: true };
  const entries = Object.entries(weights).filter(([k]) => k !== 'heal') as [DamageElement, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [el, w] of entries) {
    r -= w;
    if (r <= 0) return { element: el, isHeal: false };
  }
  return { element: 'physical', isHeal: false };
}

export function spawnParticle(
  physics: PhysicsConfig,
  combat: CombatConfig,
  canvasW: number,
  canvasH: number,
  mobIndex: number,
): DmgParticle {
  const isCrit = Math.random() < combat.critRate;
  const { element, isHeal } = pickElement(combat.elementWeights, combat.healPercent);

  const baseDmg = combat.dps / combat.attacksPerSecond;
  const variance = 0.8 + Math.random() * 0.4; // ±20% variance
  const amount = Math.round(baseDmg * variance * (isCrit ? combat.critMultiplier : 1) * (isHeal ? 0.3 : 1));

  // Spawn position — spread mobs horizontally
  const mobSpacing = canvasW / (combat.mobCount + 1);
  const baseX = mobSpacing * (mobIndex + 1);
  const baseY = canvasH * 0.65;

  const spreadX = (Math.random() - 0.5) * 2 * physics.horizontalSpread;

  let vx = 0;
  let vy = 0;

  switch (physics.physicsMode) {
    case 'linear':
      vx = 0;
      vy = -physics.floatDistance / physics.lifetime;
      break;
    case 'gravity':
      vx = spreadX * 2;
      vy = -(physics.floatDistance * 2) / physics.lifetime;
      break;
    case 'fountain':
      vx = (Math.random() - 0.5) * physics.horizontalSpread * 3;
      vy = -(physics.floatDistance * 2.5) / physics.lifetime;
      break;
    case 'directional': {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
      const speed = physics.floatDistance / physics.lifetime * 1.5;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
      break;
    }
  }

  const displayText = isHeal
    ? `+${amount}`
    : isCrit ? `${amount}!` : `${amount}`;

  return {
    id: nextParticleId++,
    amount,
    isCrit,
    isHeal,
    element,
    x: baseX + spreadX,
    y: baseY,
    vx,
    vy,
    startX: baseX + spreadX,
    startY: baseY,
    elapsed: 0,
    opacity: 1,
    scale: isCrit ? physics.critScaleBurst : 1,
    fontSize: isCrit ? physics.critFontSize : physics.normalFontSize,
    displayText,
    color: ELEMENT_COLORS[element],
    stackCount: 1,
    trail: [],
    mobIndex,
  };
}

export function updateParticle(p: DmgParticle, dt: number, physics: PhysicsConfig, allParticles: DmgParticle[]): DmgParticle {
  const elapsed = p.elapsed + dt;
  const alpha = elapsed / physics.lifetime;

  if (alpha >= 1) return { ...p, elapsed, opacity: 0 };

  let { x, y, vx, vy } = p;

  // Apply physics
  switch (physics.physicsMode) {
    case 'linear':
      y = p.startY + vy * elapsed;
      x = p.startX;
      break;
    case 'gravity':
    case 'fountain':
    case 'directional':
      vx = p.vx;
      vy = p.vy + physics.gravity * elapsed;
      x = p.startX + p.vx * elapsed;
      y = p.startY + p.vy * elapsed + 0.5 * physics.gravity * elapsed * elapsed;
      break;
  }

  // Collision avoidance
  if (physics.collisionAvoidance) {
    for (const other of allParticles) {
      if (other.id === p.id || other.opacity <= 0) continue;
      const dx = x - other.x;
      const dy = y - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < physics.collisionRadius && dist > 0) {
        const pushStrength = (physics.collisionRadius - dist) / physics.collisionRadius * 2;
        x += (dx / dist) * pushStrength;
        y += (dy / dist) * pushStrength;
      }
    }
  }

  // Fade: full opacity for fadeStart%, then linear fade
  let opacity: number;
  if (alpha < physics.fadeStart) {
    opacity = 1;
  } else {
    opacity = 1 - ((alpha - physics.fadeStart) / (1 - physics.fadeStart));
  }

  // Crit scale burst (decays over first 20% of lifetime)
  let scale = 1;
  if (p.isCrit && alpha < 0.2) {
    scale = 1 + (physics.critScaleBurst - 1) * (1 - alpha / 0.2);
  }

  // Trail
  const trail = physics.trailEnabled
    ? [{ x: p.x, y: p.y, opacity: p.opacity * 0.5 }, ...p.trail.slice(0, physics.trailLength - 1).map(t => ({ ...t, opacity: t.opacity * 0.7 }))]
    : [];

  return { ...p, x, y, vx, vy, elapsed, opacity: Math.max(0, opacity), scale, trail };
}

export function computeReadability(particles: DmgParticle[], physics: PhysicsConfig): ReadabilityMetrics {
  const visible = particles.filter(p => p.opacity > 0.3);
  if (visible.length === 0) return { avgOverlaps: 0, maxSimultaneous: 0, avgReadTime: 0, clutterScore: 0 };

  // Count overlapping pairs
  let overlaps = 0;
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const dx = visible[i].x - visible[j].x;
      const dy = visible[i].y - visible[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) overlaps++;
    }
  }

  const maxSimultaneous = visible.length;
  const avgReadTime = physics.lifetime * physics.fadeStart + physics.lifetime * (1 - physics.fadeStart) * 0.5;

  // Clutter score: 0-100 based on density and overlap
  const densityFactor = Math.min(maxSimultaneous / 8, 1);
  const overlapFactor = Math.min(overlaps / 5, 1);
  const clutterScore = Math.round((densityFactor * 60 + overlapFactor * 40));

  return {
    avgOverlaps: overlaps,
    maxSimultaneous,
    avgReadTime: Math.round(avgReadTime * 100) / 100,
    clutterScore,
  };
}
