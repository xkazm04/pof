'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, Settings2,
  Zap, Flame, Snowflake, Heart, Swords,
  AlertTriangle, TrendingUp, ChevronDown, ChevronRight,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE,
  MODULE_COLORS, OPACITY_20,
} from '@/lib/chart-colors';

const ACCENT = MODULE_COLORS.content;

/* ══════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS — mirrors UDamageNumberWidget.h exactly
   ══════════════════════════════════════════════════════════════════════════ */

type DamageElement = 'physical' | 'fire' | 'ice' | 'lightning' | 'heal';

const ELEMENT_COLORS: Record<DamageElement, string> = {
  physical: 'rgba(255,255,255,1)',
  fire: 'rgba(255,77,26,1)',
  ice: 'rgba(77,153,255,1)',
  lightning: 'rgba(255,255,51,1)',
  heal: 'rgba(51,255,77,1)',
};

const ELEMENT_ICONS: Record<DamageElement, typeof Swords> = {
  physical: Swords,
  fire: Flame,
  ice: Snowflake,
  lightning: Zap,
  heal: Heart,
};

type PhysicsMode = 'linear' | 'gravity' | 'fountain' | 'directional';
type StackMode = 'none' | 'accumulate' | 'merge';

interface PhysicsConfig {
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

interface CombatConfig {
  dps: number;
  critRate: number;          // 0-1
  critMultiplier: number;
  attacksPerSecond: number;
  mobCount: number;
  elementWeights: Record<DamageElement, number>;
  healPercent: number;       // 0-1 chance of heal instead of damage
}

// Single damage number particle in the simulation
interface DmgParticle {
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

interface ReadabilityMetrics {
  avgOverlaps: number;
  maxSimultaneous: number;
  avgReadTime: number; // how long a number is readable (opacity > 0.5)
  clutterScore: number; // 0-100, higher = worse
}

const DEFAULT_PHYSICS: PhysicsConfig = {
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

const DEFAULT_COMBAT: CombatConfig = {
  dps: 500,
  critRate: 0.15,
  critMultiplier: 2.0,
  attacksPerSecond: 3,
  mobCount: 1,
  elementWeights: { physical: 0.5, fire: 0.2, ice: 0.1, lightning: 0.1, heal: 0.1 },
  healPercent: 0,
};

const PRESETS: { id: string; name: string; physics: Partial<PhysicsConfig>; combat: Partial<CombatConfig> }[] = [
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

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION ENGINE
   ══════════════════════════════════════════════════════════════════════════ */

let nextParticleId = 0;

function pickElement(weights: Record<DamageElement, number>, healPercent: number): { element: DamageElement; isHeal: boolean } {
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

function spawnParticle(
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

function updateParticle(p: DmgParticle, dt: number, physics: PhysicsConfig, allParticles: DmgParticle[]): DmgParticle {
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

function computeReadability(particles: DmgParticle[], physics: PhysicsConfig): ReadabilityMetrics {
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

/* ══════════════════════════════════════════════════════════════════════════
   UI HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

function SliderParam({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-24 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${ACCENT} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
      <span className="text-2xs font-mono text-text w-14 text-right">{value}{unit ?? ''}</span>
    </div>
  );
}

function ClutterBadge({ score }: { score: number }) {
  const color = score < 30 ? STATUS_SUCCESS : score < 60 ? STATUS_WARNING : STATUS_ERROR;
  const label = score < 30 ? 'Clear' : score < 60 ? 'Busy' : 'Cluttered';
  return (
    <span className="flex items-center gap-1 text-2xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
      {score >= 60 && <AlertTriangle className="w-2.5 h-2.5" />}
      {label} ({score})
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export function DamageNumberPhysicsSimulator() {
  const [physics, setPhysics] = useState<PhysicsConfig>({ ...DEFAULT_PHYSICS });
  const [combat, setCombat] = useState<CombatConfig>({ ...DEFAULT_COMBAT });
  const [isRunning, setIsRunning] = useState(false);
  const [particles, setParticles] = useState<DmgParticle[]>([]);
  const [metrics, setMetrics] = useState<ReadabilityMetrics>({ avgOverlaps: 0, maxSimultaneous: 0, avgReadTime: 0, clutterScore: 0 });
  const [totalSpawned, setTotalSpawned] = useState(0);
  const [showPhysics, setShowPhysics] = useState(true);
  const [showCombat, setShowCombat] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const spawnAccRef = useRef<number>(0);
  const particlesRef = useRef<DmgParticle[]>([]);

  // Keep ref in sync
  particlesRef.current = particles;

  const canvasW = 520;
  const canvasH = 300;

  const updatePhysics = useCallback((updates: Partial<PhysicsConfig>) => {
    setPhysics(prev => ({ ...prev, ...updates }));
  }, []);

  const updateCombat = useCallback((updates: Partial<CombatConfig>) => {
    setCombat(prev => ({ ...prev, ...updates }));
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setPhysics(prev => ({ ...prev, ...preset.physics }));
    setCombat(prev => ({ ...prev, ...preset.combat }));
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setParticles([]);
    setTotalSpawned(0);
    setMetrics({ avgOverlaps: 0, maxSimultaneous: 0, avgReadTime: 0, clutterScore: 0 });
    spawnAccRef.current = 0;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Main simulation loop
  const tick = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05); // cap at 50ms
    lastTimeRef.current = timestamp;

    // Spawn new particles
    spawnAccRef.current += dt;
    const spawnInterval = 1 / combat.attacksPerSecond;
    let spawned = 0;

    while (spawnAccRef.current >= spawnInterval) {
      spawnAccRef.current -= spawnInterval;
      for (let m = 0; m < combat.mobCount; m++) {
        const newP = spawnParticle(physics, combat, canvasW, canvasH, m);

        // Stack/merge logic
        if (physics.stackMode !== 'none') {
          const existing = particlesRef.current.find(p =>
            p.opacity > 0.5 &&
            p.mobIndex === m &&
            p.elapsed * 1000 < physics.stackWindowMs &&
            p.element === newP.element &&
            p.isCrit === newP.isCrit
          );
          if (existing && physics.stackMode === 'accumulate') {
            existing.amount += newP.amount;
            existing.stackCount++;
            existing.displayText = `${existing.stackCount}x ${Math.round(existing.amount / existing.stackCount)} = ${existing.amount}`;
            continue;
          }
          if (existing && physics.stackMode === 'merge') {
            existing.amount += newP.amount;
            existing.stackCount++;
            existing.displayText = existing.isHeal ? `+${existing.amount}` : `${existing.amount}`;
            existing.scale = Math.min(existing.scale + 0.1, 2.0);
            continue;
          }
        }

        particlesRef.current = [...particlesRef.current, newP];
        spawned++;
      }
    }
    if (spawned > 0) setTotalSpawned(prev => prev + spawned);

    // Update all particles
    const updated = particlesRef.current
      .map(p => updateParticle(p, dt, physics, particlesRef.current))
      .filter(p => p.opacity > 0);

    particlesRef.current = updated;
    setParticles(updated);
    setMetrics(computeReadability(updated, physics));

    animFrameRef.current = requestAnimationFrame(tick);
  }, [physics, combat, canvasW, canvasH]);

  const toggleRunning = useCallback(() => {
    setIsRunning(prev => {
      if (!prev) {
        lastTimeRef.current = 0;
        spawnAccRef.current = 0;
        animFrameRef.current = requestAnimationFrame(tick);
        return true;
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return false;
    });
  }, [tick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Mob position markers
  const mobMarkers = useMemo(() => {
    const markers: { x: number; y: number; index: number }[] = [];
    const spacing = canvasW / (combat.mobCount + 1);
    for (let i = 0; i < combat.mobCount; i++) {
      markers.push({ x: spacing * (i + 1), y: canvasH * 0.65, index: i });
    }
    return markers;
  }, [combat.mobCount, canvasW, canvasH]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg relative overflow-hidden" style={{ backgroundColor: `${ACCENT}${OPACITY_20}` }}>
          <TrendingUp className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text">Damage Number Physics Simulator</h3>
          <p className="text-2xs text-text-muted">Real-time sandbox matching UDamageNumberWidget — experiment with advanced physics modes</p>
        </div>
        <ClutterBadge score={metrics.clutterScore} />
      </div>

      {/* Preset bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className="px-2.5 py-1 rounded text-2xs font-medium transition-all"
            style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}25` }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3">
        {/* ── Left: Simulation canvas ── */}
        <SurfaceCard level={2} className="p-3 space-y-2">
          {/* Controls bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRunning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: isRunning ? `${STATUS_ERROR}20` : `${STATUS_SUCCESS}20`,
                  color: isRunning ? STATUS_ERROR : STATUS_SUCCESS,
                  border: `1px solid ${isRunning ? STATUS_ERROR : STATUS_SUCCESS}`,
                }}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isRunning ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
            <div className="flex items-center gap-3 text-2xs font-mono text-text-muted">
              <span>Active: <span className="text-text font-bold">{particles.length}</span></span>
              <span>Total: <span className="text-text font-bold">{totalSpawned}</span></span>
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative overflow-hidden rounded-lg border border-border/30"
            style={{
              width: '100%',
              height: canvasH,
              backgroundColor: 'var(--surface-deep, rgb(8,8,15))',
              backgroundImage: 'radial-gradient(circle at 50% 65%, rgba(255,255,255,0.03) 0%, transparent 60%)',
            }}
          >
            {/* Mob position markers */}
            {mobMarkers.map((m) => (
              <div
                key={m.index}
                className="absolute flex flex-col items-center"
                style={{ left: m.x, top: m.y, transform: 'translate(-50%, 0)' }}
              >
                <div
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: `${ACCENT_VIOLET}50`, backgroundColor: `${ACCENT_VIOLET}10` }}
                >
                  <Swords className="w-3.5 h-3.5" style={{ color: ACCENT_VIOLET }} />
                </div>
                <span className="text-[8px] font-mono text-text-muted mt-0.5">Mob {m.index + 1}</span>
              </div>
            ))}

            {/* Damage number particles */}
            {particles.map((p) => (
              <div key={p.id} className="absolute pointer-events-none" style={{ willChange: 'transform, opacity' }}>
                {/* Trail particles */}
                {p.trail.map((t, i) => (
                  <div
                    key={i}
                    className="absolute font-bold font-mono"
                    style={{
                      left: t.x,
                      top: t.y,
                      transform: 'translate(-50%, -50%)',
                      opacity: t.opacity * 0.3,
                      fontSize: p.fontSize * 0.7,
                      color: p.color,
                      filter: 'blur(1px)',
                    }}
                  >
                    {p.displayText}
                  </div>
                ))}
                {/* Main number */}
                <div
                  className="absolute font-bold font-mono whitespace-nowrap"
                  style={{
                    left: p.x,
                    top: p.y,
                    transform: `translate(-50%, -50%) scale(${p.scale})`,
                    opacity: p.opacity,
                    fontSize: p.fontSize,
                    color: p.color,
                    textShadow: `0 0 6px ${p.color}, 0 1px 2px rgba(0,0,0,0.8)`,
                    transition: 'none',
                  }}
                >
                  {p.displayText}
                </div>
              </div>
            ))}

            {/* Fade curve visualization (bottom-right mini chart) */}
            <svg
              className="absolute bottom-1 right-1 pointer-events-none"
              width={60} height={30} viewBox="0 0 60 30"
            >
              <text x={1} y={7} fill="rgba(255,255,255,0.2)" fontSize={5} fontFamily="monospace">fade</text>
              <polyline
                points={Array.from({ length: 20 }, (_, i) => {
                  const t = i / 19;
                  const alpha = t < physics.fadeStart ? 1 : 1 - ((t - physics.fadeStart) / (1 - physics.fadeStart));
                  return `${5 + t * 50},${28 - alpha * 20}`;
                }).join(' ')}
                fill="none" stroke={ACCENT} strokeWidth={1} opacity={0.4}
              />
            </svg>
          </div>

          {/* Readability metrics */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Overlaps', value: metrics.avgOverlaps, color: metrics.avgOverlaps > 3 ? STATUS_ERROR : STATUS_SUCCESS },
              { label: 'Simultaneous', value: metrics.maxSimultaneous, color: metrics.maxSimultaneous > 6 ? STATUS_WARNING : STATUS_SUCCESS },
              { label: 'Read Time', value: `${metrics.avgReadTime}s`, color: metrics.avgReadTime < 0.3 ? STATUS_ERROR : STATUS_SUCCESS },
              { label: 'Clutter', value: metrics.clutterScore, color: metrics.clutterScore > 50 ? STATUS_ERROR : metrics.clutterScore > 25 ? STATUS_WARNING : STATUS_SUCCESS },
            ].map((m) => (
              <div key={m.label} className="rounded-md border border-border/30 bg-surface-deep/50 px-2 py-1.5 text-center">
                <div className="text-xs font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[9px] text-text-muted uppercase tracking-wider">{m.label}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>

        {/* ── Right: Parameter panels ── */}
        <div className="space-y-2">
          {/* Physics parameters */}
          <SurfaceCard level={2} className="p-2.5 space-y-2">
            <button
              onClick={() => setShowPhysics(prev => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" style={{ color: ACCENT_CYAN }} />
                <span className="text-xs font-bold text-text uppercase tracking-wider">Physics</span>
              </div>
              {showPhysics ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
            </button>

            {showPhysics && (
              <div className="space-y-1.5">
                <SliderParam label="Lifetime" value={physics.lifetime} min={0.3} max={3} step={0.1} onChange={v => updatePhysics({ lifetime: v })} unit="s" />
                <SliderParam label="Float Dist" value={physics.floatDistance} min={20} max={200} step={5} onChange={v => updatePhysics({ floatDistance: v })} unit="px" />
                <SliderParam label="H-Spread" value={physics.horizontalSpread} min={0} max={80} step={5} onChange={v => updatePhysics({ horizontalSpread: v })} unit="px" />
                <SliderParam label="Fade Start" value={physics.fadeStart} min={0} max={0.9} step={0.05} onChange={v => updatePhysics({ fadeStart: v })} />
                <SliderParam label="Crit Scale" value={physics.critScaleBurst} min={1} max={2.5} step={0.1} onChange={v => updatePhysics({ critScaleBurst: v })} unit="x" />

                {/* Physics mode selector */}
                <div className="space-y-1">
                  <span className="text-2xs text-text-muted">Mode</span>
                  <div className="grid grid-cols-2 gap-1">
                    {(['linear', 'gravity', 'fountain', 'directional'] as PhysicsMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => updatePhysics({ physicsMode: mode })}
                        className="px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all"
                        style={{
                          backgroundColor: physics.physicsMode === mode ? `${ACCENT_CYAN}20` : 'transparent',
                          color: physics.physicsMode === mode ? ACCENT_CYAN : 'var(--text-muted)',
                          border: `1px solid ${physics.physicsMode === mode ? `${ACCENT_CYAN}50` : 'transparent'}`,
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {(physics.physicsMode === 'gravity' || physics.physicsMode === 'fountain' || physics.physicsMode === 'directional') && (
                  <SliderParam label="Gravity" value={physics.gravity} min={0} max={500} step={10} onChange={v => updatePhysics({ gravity: v })} unit="px/s²" />
                )}

                {/* Toggles */}
                <div className="space-y-1 pt-1">
                  <label className="flex items-center gap-2 text-2xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={physics.collisionAvoidance} onChange={(e) => updatePhysics({ collisionAvoidance: e.target.checked })} className="rounded" />
                    Collision Avoidance
                  </label>
                  {physics.collisionAvoidance && (
                    <SliderParam label="Coll Radius" value={physics.collisionRadius} min={8} max={50} step={2} onChange={v => updatePhysics({ collisionRadius: v })} unit="px" />
                  )}
                  <label className="flex items-center gap-2 text-2xs text-text-muted cursor-pointer">
                    <input type="checkbox" checked={physics.trailEnabled} onChange={(e) => updatePhysics({ trailEnabled: e.target.checked })} className="rounded" />
                    Particle Trail
                  </label>
                  {physics.trailEnabled && (
                    <SliderParam label="Trail Len" value={physics.trailLength} min={2} max={8} step={1} onChange={v => updatePhysics({ trailLength: v })} />
                  )}
                </div>

                {/* Stack mode */}
                <div className="space-y-1">
                  <span className="text-2xs text-text-muted">Stacking</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['none', 'accumulate', 'merge'] as StackMode[]).map(mode => (
                      <button
                        key={mode}
                        onClick={() => updatePhysics({ stackMode: mode })}
                        className="px-1.5 py-1 rounded text-[10px] font-mono font-bold transition-all"
                        style={{
                          backgroundColor: physics.stackMode === mode ? `${ACCENT_ORANGE}20` : 'transparent',
                          color: physics.stackMode === mode ? ACCENT_ORANGE : 'var(--text-muted)',
                          border: `1px solid ${physics.stackMode === mode ? `${ACCENT_ORANGE}50` : 'transparent'}`,
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {physics.stackMode !== 'none' && (
                  <SliderParam label="Stack Win" value={physics.stackWindowMs} min={50} max={500} step={25} onChange={v => updatePhysics({ stackWindowMs: v })} unit="ms" />
                )}
              </div>
            )}
          </SurfaceCard>

          {/* Combat parameters */}
          <SurfaceCard level={2} className="p-2.5 space-y-2">
            <button
              onClick={() => setShowCombat(prev => !prev)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" style={{ color: ACCENT_ORANGE }} />
                <span className="text-xs font-bold text-text uppercase tracking-wider">Combat</span>
              </div>
              {showCombat ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
            </button>

            {showCombat && (
              <div className="space-y-1.5">
                <SliderParam label="DPS" value={combat.dps} min={100} max={10000} step={100} onChange={v => updateCombat({ dps: v })} />
                <SliderParam label="Atk/sec" value={combat.attacksPerSecond} min={0.5} max={15} step={0.5} onChange={v => updateCombat({ attacksPerSecond: v })} />
                <SliderParam label="Crit Rate" value={combat.critRate} min={0} max={1} step={0.05} onChange={v => updateCombat({ critRate: v })} />
                <SliderParam label="Crit Mult" value={combat.critMultiplier} min={1} max={5} step={0.25} onChange={v => updateCombat({ critMultiplier: v })} unit="x" />
                <SliderParam label="Mobs" value={combat.mobCount} min={1} max={8} step={1} onChange={v => updateCombat({ mobCount: v })} />
                <SliderParam label="Heal %" value={combat.healPercent} min={0} max={0.5} step={0.05} onChange={v => updateCombat({ healPercent: v })} />

                {/* Element mix */}
                <div className="space-y-1 pt-1">
                  <span className="text-2xs text-text-muted font-bold uppercase tracking-wider">Element Mix</span>
                  {(['physical', 'fire', 'ice', 'lightning'] as DamageElement[]).map(el => {
                    const Icon = ELEMENT_ICONS[el];
                    return (
                      <div key={el} className="flex items-center gap-1.5">
                        <Icon className="w-2.5 h-2.5 shrink-0" style={{ color: ELEMENT_COLORS[el] }} />
                        <span className="text-[10px] text-text-muted w-14 shrink-0">{el}</span>
                        <input
                          type="range" min={0} max={1} step={0.1} value={combat.elementWeights[el]}
                          onChange={(e) => updateCombat({
                            elementWeights: { ...combat.elementWeights, [el]: Number(e.target.value) },
                          })}
                          className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, ${ELEMENT_COLORS[el]} ${combat.elementWeights[el] * 100}%, rgba(255,255,255,0.1) ${combat.elementWeights[el] * 100}%)`,
                          }}
                        />
                        <span className="text-[10px] font-mono text-text-muted w-6 text-right">{(combat.elementWeights[el] * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SurfaceCard>

          {/* C++ reference */}
          <div className="text-[9px] text-text-muted font-mono leading-relaxed px-1">
            Matching: DamageNumberWidget.h<br />
            Lifetime={physics.lifetime}s Float={physics.floatDistance}px<br />
            Fade: 100% → {(physics.fadeStart * 100).toFixed(0)}% → 0%
          </div>
        </div>
      </div>
    </div>
  );
}
