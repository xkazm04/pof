'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { DEFAULT_PHYSICS, DEFAULT_COMBAT, PRESETS } from './constants';
import { spawnParticle, updateParticle, computeReadability } from './simulation';
import type { PhysicsConfig, CombatConfig, DmgParticle, ReadabilityMetrics } from './types';

export function useDamageNumberPhysicsSimulator() {
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

  // The loop reads the config captured when the run started (unchanged from
  // when `toggleRunning` owned the rAF chain), so keep the latest `tick` in a
  // ref and snapshot it at run start rather than restarting on every edit.
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const toggleRunning = useCallback(() => {
    setIsRunning(prev => {
      if (!prev) {
        spawnAccRef.current = 0;
        return true;
      }
      return false;
    });
  }, []);

  /* Suspend-gated (see `useSuspend.ts`). This is an UNBOUNDED 60fps physics
     simulation: it spawns, integrates and re-renders particles every frame for
     as long as `isRunning`. The module LRU keeps the pane MOUNTED while hidden
     (`display:none`) and the browser only throttles rAF for a hidden TAB, so
     before this gate a forgotten "Running" simulator burned a full frame budget
     in a pane nobody could see. Ownership of the rAF chain moved out of
     `toggleRunning` into this effect precisely so the suspend signal can reach
     it — while visible the lifecycle is identical (start on true, cancel on
     false/unmount).

     Pausing is lossless because every piece of simulation state is already
     out-of-frame: particles live in `particlesRef`, the spawn debt in
     `spawnAccRef`, and the frame clock is a `lastTimeRef` delta that is zeroed
     on resume so the hidden span is never integrated as one giant dt (which
     would teleport every particle). The resumed frame is the frame that would
     have come next, drawn from the same particle set. */
  useSuspendableEffect(() => {
    if (!isRunning) return;
    lastTimeRef.current = 0;
    const step = tickRef.current;
    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRunning]);

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

  return {
    physics, combat, isRunning, particles, metrics, totalSpawned,
    showPhysics, setShowPhysics, showCombat, setShowCombat,
    canvasRef, canvasW, canvasH,
    updatePhysics, updateCombat, applyPreset, reset, toggleRunning, mobMarkers,
  };
}
