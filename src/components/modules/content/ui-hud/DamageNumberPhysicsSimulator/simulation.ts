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

  // DamageNumberWidget.cpp InitDamageNumber: "+%.0f" heal, "CRIT! %.0f" crit, "%.0f" normal
  const displayText = isHeal
    ? `+${amount}`
    : isCrit ? `CRIT! ${amount}` : `${amount}`;

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

  // Collision avoidance. The path above is recomputed from the spawn point every
  // frame, so the push must accumulate in offX/offY - applied once, it was undone
  // on the next frame and two numbers never separated beyond ~2px per neighbour.
  let offX = p.offX ?? 0;
  let offY = p.offY ?? 0;
  if (physics.collisionAvoidance) {
    for (const other of allParticles) {
      if (other.id === p.id || other.opacity <= 0) continue;
      const dx = x + offX - other.x;
      const dy = y + offY - other.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < physics.collisionRadius && dist > 0) {
        const pushStrength = (physics.collisionRadius - dist) / physics.collisionRadius * 2;
        offX += (dx / dist) * pushStrength;
        offY += (dy / dist) * pushStrength;
      }
    }
  }
  x += offX;
  y += offY;

  // Fade: full opacity for fadeStart%, then linear fade
  let opacity: number;
  if (alpha < physics.fadeStart) {
    opacity = 1;
  } else {
    opacity = 1 - ((alpha - physics.fadeStart) / (1 - physics.fadeStart));
  }

  // Merge-mode growth: +0.1 per merged hit, capped at 2x. Derived from stackCount
  // every frame so it survives the per-frame recompute below.
  const stackScale = physics.stackMode === 'merge' ? Math.min(1 + 0.1 * (p.stackCount - 1), 2) : 1;

  // Crit scale burst (decays over first 20% of lifetime)
  let scale = stackScale;
  if (p.isCrit && alpha < 0.2) {
    scale = stackScale * (1 + (physics.critScaleBurst - 1) * (1 - alpha / 0.2));
  }

  // Trail
  const trail = physics.trailEnabled
    ? [{ x: p.x, y: p.y, opacity: p.opacity * 0.5 }, ...p.trail.slice(0, physics.trailLength - 1).map(t => ({ ...t, opacity: t.opacity * 0.7 }))]
    : [];

  return { ...p, x, y, vx, vy, elapsed, opacity: Math.max(0, opacity), scale, trail, offX, offY };
}

/** Approximate rendered text box (monospace bold ~0.6em per glyph), scaled like the canvas does. */
function textBox(p: DmgParticle): { w: number; h: number } {
  return { w: p.displayText.length * p.fontSize * 0.6 * p.scale, h: p.fontSize * p.scale };
}

export function textBoxesOverlap(a: DmgParticle, b: DmgParticle): boolean {
  const ba = textBox(a);
  const bb = textBox(b);
  return Math.abs(a.x - b.x) < (ba.w + bb.w) / 2 && Math.abs(a.y - b.y) < (ba.h + bb.h) / 2;
}

/** Frames the windowed mean covers (about one second at 60fps). */
export const READABILITY_WINDOW = 60;

export interface ReadabilityRun {
  /** Highest simultaneous count seen since the run started. */
  peak: number;
  /** Per-frame samples, newest last, capped at READABILITY_WINDOW. */
  recent: { overlaps: number; simultaneous: number }[];
}

export function createReadabilityRun(): ReadabilityRun {
  return { peak: 0, recent: [] };
}

/**
 * Fold one frame's readability (from computeReadability, where avgOverlaps and
 * maxSimultaneous are that frame's pair count and visible count) into a run: the
 * returned metrics report the run peak and the windowed means, so the tiles stop
 * flickering with the current frame.
 */
export function foldReadability(
  run: ReadabilityRun,
  frame: ReadabilityMetrics,
): { run: ReadabilityRun; metrics: ReadabilityMetrics } {
  const recent = [...run.recent, { overlaps: frame.avgOverlaps, simultaneous: frame.maxSimultaneous }]
    .slice(-READABILITY_WINDOW);
  const mean = (pick: (s: { overlaps: number; simultaneous: number }) => number) =>
    Math.round((recent.reduce((t, s) => t + pick(s), 0) / recent.length) * 10) / 10;
  const peak = Math.max(run.peak, frame.maxSimultaneous);
  return {
    run: { peak, recent },
    metrics: {
      ...frame,
      maxSimultaneous: peak,
      avgOverlaps: mean(s => s.overlaps),
      avgSimultaneous: mean(s => s.simultaneous),
    },
  };
}

export function computeReadability(particles: DmgParticle[], physics: PhysicsConfig): ReadabilityMetrics {
  const visible = particles.filter(p => p.opacity > 0.3);
  if (visible.length === 0) return { avgOverlaps: 0, maxSimultaneous: 0, avgReadTime: 0, clutterScore: 0 };

  // Count overlapping pairs
  let overlaps = 0;
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (textBoxesOverlap(visible[i], visible[j])) overlaps++;
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
