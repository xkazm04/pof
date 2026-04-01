'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import { DEFAULT_TUNING } from '@/lib/combat/definitions';
import { simulateEncounter } from '@/lib/combat/choreography-sim';
import type { PlacedEnemy, WaveDef } from '@/lib/combat/choreography-sim';
import type { TuningOverrides } from '@/types/combat-simulator';
import { BlueprintPanel, SectionHeader } from '../_design';
import { nextId, FEEDBACK_CHANNEL_COLORS } from './types';
import { generateUE5Export } from './ue5-export';
import { SpatialGrid } from './SpatialGrid';
import { BalanceAlertsPanel } from './BalanceAlertsPanel';
import {
  WaveManager, TimelineSection, TuningPanel, StatsPanel, ExportPanel,
  ArchetypePalette, GhostLegend,
} from './panels';

export function CombatChoreographyEditor() {
  const [enemies, setEnemies] = useState<PlacedEnemy[]>([
    { id: nextId(), archetypeId: 'melee-grunt', gridX: 1, gridY: 1, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'melee-grunt', gridX: 4, gridY: 1, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'ranged-caster', gridX: 3, gridY: 3, waveIndex: 0, level: 5 },
    { id: nextId(), archetypeId: 'brute', gridX: 2, gridY: 0, waveIndex: 1, level: 6 },
    { id: nextId(), archetypeId: 'elite-knight', gridX: 3, gridY: 1, waveIndex: 2, level: 7 },
  ]);

  const [waves, setWaves] = useState<WaveDef[]>([
    { spawnTimeSec: 0, label: 'Initial' },
    { spawnTimeSec: 8, label: 'Reinforcement' },
    { spawnTimeSec: 18, label: 'Boss Wave' },
  ]);

  const [selectedWave, setSelectedWave] = useState(0);
  const [selectedArchetype, setSelectedArchetype] = useState('melee-grunt');
  const [placeLevel, setPlaceLevel] = useState(5);
  const [tuning, setTuning] = useState<TuningOverrides>({ ...DEFAULT_TUNING });
  const [scrubTime, setScrubTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playerLevel, setPlayerLevel] = useState(5);

  const playRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const simResult = useMemo(
    () => simulateEncounter(enemies, waves, tuning, playerLevel, FEEDBACK_CHANNEL_COLORS),
    [enemies, waves, tuning, playerLevel],
  );

  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) cancelAnimationFrame(playRef.current);
      return;
    }
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      setScrubTime((prev) => {
        const next = prev + dt;
        if (next >= simResult.totalDurationSec) { setIsPlaying(false); return simResult.totalDurationSec; }
        return next;
      });
      playRef.current = requestAnimationFrame(tick);
    };
    playRef.current = requestAnimationFrame(tick);
    return () => { if (playRef.current) cancelAnimationFrame(playRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const handlePlace = useCallback((x: number, y: number) => {
    setEnemies((prev) => [...prev, { id: nextId(), archetypeId: selectedArchetype, gridX: x, gridY: y, waveIndex: selectedWave, level: placeLevel }]);
  }, [selectedArchetype, selectedWave, placeLevel]);

  const handleRemove = useCallback((id: string) => { setEnemies((prev) => prev.filter((e) => e.id !== id)); }, []);

  const handleMove = useCallback((id: string, toX: number, toY: number, toWave?: number) => {
    setEnemies((prev) => prev.map((e) => e.id === id ? { ...e, gridX: toX, gridY: toY, ...(toWave !== undefined ? { waveIndex: toWave } : {}) } : e));
  }, []);

  const updateTuning = useCallback(<K extends keyof TuningOverrides>(key: K, value: number) => {
    setTuning((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAddWave = useCallback(() => {
    const lastTime = waves[waves.length - 1]?.spawnTimeSec ?? 0;
    setWaves((prev) => [...prev, { spawnTimeSec: lastTime + 10, label: `Wave ${prev.length}` }]);
  }, [waves]);

  const handleRemoveWave = useCallback((idx: number) => {
    if (waves.length <= 1) return;
    setWaves((prev) => prev.filter((_, i) => i !== idx));
    setEnemies((prev) => prev.filter((e) => e.waveIndex !== idx).map((e) => ({ ...e, waveIndex: e.waveIndex > idx ? e.waveIndex - 1 : e.waveIndex })));
    if (selectedWave >= idx && selectedWave > 0) setSelectedWave(selectedWave - 1);
  }, [waves.length, selectedWave]);

  const handleUpdateWaveTime = useCallback((idx: number, time: number) => {
    setWaves((prev) => prev.map((w, i) => i === idx ? { ...w, spawnTimeSec: time } : w));
  }, []);

  const exportConfig = useMemo(() => generateUE5Export(enemies, waves, tuning), [enemies, waves, tuning]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportConfig]);

  const handleReset = useCallback(() => { setScrubTime(0); setIsPlaying(false); }, []);

  const totalEnemies = enemies.length;
  const waveEnemyCounts = waves.map((_, i) => enemies.filter((e) => e.waveIndex === i).length);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      className="space-y-4" data-testid="combat-choreography-editor">

      {/* Row 1: Grid + Archetype Palette + Waves */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
        <BlueprintPanel className="p-3 space-y-3">
          <SectionHeader label={`Spatial Grid \u2014 Wave ${selectedWave}: ${waves[selectedWave]?.label}`} icon={Users} />
          <div className="flex items-center justify-end -mt-2 mb-1">
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-text-muted">
              <Users className="w-3 h-3" />
              {enemies.filter((e) => e.waveIndex === selectedWave).length} placed
            </div>
          </div>
          <div className="flex items-start gap-3">
            <SpatialGrid enemies={enemies} selectedWave={selectedWave} totalWaves={waves.length}
              onPlace={handlePlace} onRemove={handleRemove} onMove={handleMove} />
            <ArchetypePalette
              selectedArchetype={selectedArchetype} onSelectArchetype={setSelectedArchetype}
              placeLevel={placeLevel} onPlaceLevel={setPlaceLevel}
              playerLevel={playerLevel} onPlayerLevel={setPlayerLevel}
            />
          </div>
          <GhostLegend selectedWave={selectedWave} totalWaves={waves.length} />
        </BlueprintPanel>

        <WaveManager
          waves={waves} selectedWave={selectedWave} waveEnemyCounts={waveEnemyCounts}
          totalEnemies={totalEnemies} totalDuration={simResult.totalDurationSec}
          onSelect={setSelectedWave} onAdd={handleAddWave} onRemove={handleRemoveWave}
          onUpdateTime={handleUpdateWaveTime}
        />
      </div>

      {/* Row 2: Timeline */}
      <TimelineSection
        simResult={simResult} waves={waves} scrubTime={scrubTime} isPlaying={isPlaying}
        onScrub={setScrubTime} onTogglePlay={() => setIsPlaying(!isPlaying)} onReset={handleReset}
      />

      {/* Row 3: Tuning + Alerts + Stats + Export */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TuningPanel tuning={tuning} onUpdate={updateTuning} onReset={() => setTuning({ ...DEFAULT_TUNING })} />
        <BalanceAlertsPanel alerts={simResult.alerts} />
        <StatsPanel simResult={simResult} />
        <ExportPanel exportConfig={exportConfig} onCopy={handleCopy} copied={copied} />
      </div>
    </motion.div>
  );
}

