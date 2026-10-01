'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { Users } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { simulateEncounter } from '@/lib/combat/choreography-sim';
import type { TuningOverrides } from '@/types/combat-simulator';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { FEEDBACK_CHANNEL_COLORS } from './types';
import { useEncounterDraftStore } from './encounterDraftStore';
import { CompareStrip } from './CompareStrip';
import { generateUE5Export } from './ue5-export';
import { SpatialGrid } from './SpatialGrid';
import { BalanceAlertsPanel } from './BalanceAlertsPanel';
import {
  WaveManager, TimelineSection, TuningPanel, StatsPanel, ExportPanel,
  ArchetypePalette, GhostLegend,
} from './panels';
import { TensionPanel } from './TensionPanel';

export function CombatChoreographyEditor() {
  // The draft lives in a module-level store so it survives the Combat tab's
  // AnimatePresence remount; playback/copy state is ephemeral and stays local.
  const enemies = useEncounterDraftStore((s) => s.enemies);
  const waves = useEncounterDraftStore((s) => s.waves);
  const tuning = useEncounterDraftStore((s) => s.tuning);
  const playerLevel = useEncounterDraftStore((s) => s.playerLevel);
  const selectedWave = useEncounterDraftStore((s) => s.selectedWave);
  const selectedArchetype = useEncounterDraftStore((s) => s.selectedArchetype);
  const placeLevel = useEncounterDraftStore((s) => s.placeLevel);
  const baseline = useEncounterDraftStore((s) => s.baseline);
  const dispatch = useEncounterDraftStore((s) => s.dispatch);
  const [scrubTime, setScrubTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const playRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  // Debounce the sim inputs so dragging a tuning slider (which updates `tuning`
  // every pointer tick) doesn't re-run the full 60s encounter sim synchronously
  // on the main thread mid-gesture. The raw state still drives the controls'
  // visual position; the sim recomputes once the drag settles (~140ms).
  const debouncedEnemies = useDebouncedValue(enemies, 140);
  const debouncedWaves = useDebouncedValue(waves, 140);
  const debouncedTuning = useDebouncedValue(tuning, 140);
  const debouncedPlayerLevel = useDebouncedValue(playerLevel, 140);

  const simResult = useMemo(
    () => simulateEncounter(debouncedEnemies, debouncedWaves, debouncedTuning, debouncedPlayerLevel, FEEDBACK_CHANNEL_COLORS),
    [debouncedEnemies, debouncedWaves, debouncedTuning, debouncedPlayerLevel],
  );

  /* Suspend-gated (see `useSuspend.ts`). Encounter playback advances the scrub
     head at 60fps for the whole encounter duration (tens of seconds). The module
     LRU keeps this pane MOUNTED behind `display:none` and the browser only
     throttles rAF for a hidden TAB, so playback left running would otherwise
     scrub — and re-render the timeline — in a pane nobody can see.

     Pausing is lossless because the playhead is React state (`scrubTime`), not
     a closure variable: it survives the pause untouched, and the resumed run
     re-seeds `lastFrameRef` from the current frame time so the hidden span is
     never added as one huge dt (which would jump the head to the end and stop
     playback). Resuming continues from the exact frame the pane was hidden on. */
  useSuspendableEffect(() => {
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
    // Deliberately keyed on `isPlaying` alone (unchanged): adding `simResult`
    // would restart playback from the current frame on every tuning edit.
  }, [isPlaying]);

  const handlePlace = useCallback((x: number, y: number) => dispatch({ type: 'placeEnemy', x, y }), [dispatch]);
  const handleRemove = useCallback((id: string) => dispatch({ type: 'removeEnemy', id }), [dispatch]);
  const handleMove = useCallback((id: string, x: number, y: number, wave?: number) => {
    dispatch({ type: 'moveEnemy', id, x, y, wave });
  }, [dispatch]);
  const updateTuning = useCallback(<K extends keyof TuningOverrides>(key: K, value: number) => {
    dispatch({ type: 'setTuning', key, value });
  }, [dispatch]);

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
      className="space-y-4" data-testid="pof-module-arpg-combat-choreography-editor">

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
              selectedArchetype={selectedArchetype} onSelectArchetype={(id) => dispatch({ type: 'selectArchetype', id })}
              placeLevel={placeLevel} onPlaceLevel={(level) => dispatch({ type: 'setPlaceLevel', level })}
              playerLevel={playerLevel} onPlayerLevel={(level) => dispatch({ type: 'setPlayerLevel', level })}
            />
          </div>
          <GhostLegend selectedWave={selectedWave} totalWaves={waves.length} />
        </BlueprintPanel>

        <WaveManager
          waves={waves} selectedWave={selectedWave} waveEnemyCounts={waveEnemyCounts}
          totalEnemies={totalEnemies} totalDuration={simResult.totalDurationSec}
          onSelect={(index) => dispatch({ type: 'selectWave', index })} onAdd={() => dispatch({ type: 'addWave' })}
          onRemove={(index) => dispatch({ type: 'removeWave', index })}
          onUpdateTime={(index, time) => dispatch({ type: 'setWaveTime', index, time })}
        />
      </div>

      {/* Row 2: Timeline (with dramatic tension arc overlay) */}
      <TimelineSection
        simResult={simResult} waves={waves} scrubTime={scrubTime} isPlaying={isPlaying}
        onScrub={setScrubTime} onTogglePlay={() => setIsPlaying(!isPlaying)} onReset={handleReset}
      />

      {/* Row 2a: this tuning pass vs a pinned baseline */}
      <CompareStrip baseline={baseline} current={simResult}
        onPin={() => dispatch({ type: 'pinBaseline' })} onRevert={() => dispatch({ type: 'revertToBaseline' })}
        onClear={() => dispatch({ type: 'clearBaseline' })} />

      {/* Row 2b: Dramatic Arc beat sheet */}
      <TensionPanel tensionCurve={simResult.tensionCurve} onSeek={setScrubTime} />

      {/* Row 3: Tuning + Alerts + Stats + Export */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <TuningPanel tuning={tuning} onUpdate={updateTuning} onReset={() => dispatch({ type: 'resetTuning' })} />
        <BalanceAlertsPanel alerts={simResult.alerts} />
        <StatsPanel simResult={simResult} />
        <ExportPanel exportConfig={exportConfig} onCopy={handleCopy} copied={copied} />
      </div>
    </motion.div>
  );
}

