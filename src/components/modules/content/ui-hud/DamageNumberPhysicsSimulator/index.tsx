'use client';

import { TrendingUp } from 'lucide-react';
import { OPACITY_20 } from '@/lib/chart-colors';
import { ACCENT, PRESETS } from './constants';
import { ClutterBadge } from './ClutterBadge';
import { SimulationCanvas } from './SimulationCanvas';
import { PhysicsPanel } from './PhysicsPanel';
import { CombatPanel } from './CombatPanel';
import { useDamageNumberPhysicsSimulator } from './useDamageNumberPhysicsSimulator';

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export function DamageNumberPhysicsSimulator() {
  const {
    physics, combat, isRunning, particles, metrics, totalSpawned,
    showPhysics, setShowPhysics, showCombat, setShowCombat,
    canvasRef, canvasH,
    updatePhysics, updateCombat, applyPreset, reset, toggleRunning, mobMarkers,
  } = useDamageNumberPhysicsSimulator();

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
        <SimulationCanvas
          isRunning={isRunning}
          toggleRunning={toggleRunning}
          reset={reset}
          particles={particles}
          totalSpawned={totalSpawned}
          canvasRef={canvasRef}
          canvasH={canvasH}
          mobMarkers={mobMarkers}
          metrics={metrics}
          physics={physics}
        />

        {/* ── Right: Parameter panels ── */}
        <div className="space-y-2">
          {/* Physics parameters */}
          <PhysicsPanel
            showPhysics={showPhysics}
            setShowPhysics={setShowPhysics}
            physics={physics}
            updatePhysics={updatePhysics}
          />

          {/* Combat parameters */}
          <CombatPanel
            showCombat={showCombat}
            setShowCombat={setShowCombat}
            combat={combat}
            updateCombat={updateCombat}
          />

          {/* C++ reference */}
          <div className="text-[11px] text-text-muted font-mono leading-relaxed px-1">
            Matching: DamageNumberWidget.h<br />
            Lifetime={physics.lifetime}s Float={physics.floatDistance}px<br />
            Fade: 100% → {(physics.fadeStart * 100).toFixed(0)}% → 0%
          </div>
        </div>
      </div>
    </div>
  );
}
