'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Users, Play, RotateCcw } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SubTabNavigation } from '@/components/modules/core-engine/unique-tabs/_shared';
import {
  ACCENT_CYAN, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';
import type { DirectorConfig } from '@/types/squad-tactics';
import {
  runSquadSimulation, PRESET_FORMATIONS, ROLE_DEFINITIONS,
  DEFAULT_DIRECTOR_CONFIG,
} from '@/lib/ai-director/squad-engine';
import { useDragAngle } from '@/hooks/useDragAngle';
import {
  ACCENT, ROLE_COLORS, ROLE_ICONS, SVG_CENTER, DRAW_RADIUS, SUB_TABS,
} from './constants';
import { FormationView } from './FormationView';
import { PipelineView } from './PipelineView';
import { CodeGenView } from './CodeGenView';
import { SquadConfigErrorBanner } from './SquadConfigErrorBanner';

export { SquadConfigErrorBanner } from './SquadConfigErrorBanner';

/* ── Component ────────────────────────────────────────────────────────────── */

export function SquadChoreographyEditor() {
  const [config, setConfig] = useState<DirectorConfig>(DEFAULT_DIRECTOR_CONFIG);
  const [activeTab, setActiveTab] = useState('formation');
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag the cyan arrow to rotate the target's forward vector — shared pointer math.
  const setForwardAngle = useCallback(
    (angle: number) => setConfig(prev => ({ ...prev, targetForwardAngle: angle })),
    [],
  );
  const drag = useDragAngle(svgRef, SVG_CENTER, setForwardAngle);

  // Run simulation — validated at the engine boundary, so an invalid config
  // surfaces as a typed error instead of NaN positions that break the SVG.
  const simulation = useMemo(() => runSquadSimulation(config), [config]);
  const result = simulation.ok ? simulation.data : null;
  const configError = simulation.ok ? null : simulation.error;

  // Scale factor: map UU to SVG pixels
  const maxDist = result
    ? Math.max(...result.members.map(m => m.distance), config.attackDistance)
    : config.attackDistance;
  const scale = maxDist > 0 ? DRAW_RADIUS / (maxDist * 1.15) : 1;

  // Forward arrow
  const arrowLen = DRAW_RADIUS * 0.7;
  const arrowEndX = SVG_CENTER + Math.cos(config.targetForwardAngle) * arrowLen;
  const arrowEndY = SVG_CENTER + Math.sin(config.targetForwardAngle) * arrowLen;

  // Handlers
  const handleFormationChange = useCallback((formationId: string) => {
    const formation = PRESET_FORMATIONS.find(f => f.id === formationId);
    if (formation) {
      setConfig(prev => ({ ...prev, formation, seed: prev.seed + 1 }));
    }
  }, []);

  const handleResimulate = useCallback(() => {
    setConfig(prev => ({ ...prev, seed: prev.seed + 1 }));
  }, []);

  const handleResetForward = useCallback(() => {
    setConfig(prev => ({ ...prev, targetForwardAngle: -Math.PI / 2 }));
  }, []);

  const handleWeightChange = useCallback((key: 'flankWeight' | 'separationWeight' | 'rangeWeight', value: number) => {
    setConfig(prev => ({ ...prev, [key]: value, seed: prev.seed + 1 }));
  }, []);

  const handleDistanceChange = useCallback((value: number) => {
    setConfig(prev => ({ ...prev, attackDistance: value, seed: prev.seed + 1 }));
  }, []);

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full" data-testid="squad-choreography-editor">
      {/* Header */}
      <SurfaceCard className="p-0 overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${ACCENT}${OPACITY_10}` }}
          >
            <Users className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-text font-mono">AI Director: Squad Choreography</h3>
            <p className="text-2xs text-text-muted">
              Compose EQS queries across a squad to produce emergent coordinated tactics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResimulate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: `${ACCENT}${OPACITY_15}`,
                color: ACCENT,
                border: `1px solid ${ACCENT}30`,
              }}
              data-testid="squad-resimulate-btn"
            >
              <Play className="w-3.5 h-3.5" />
              Re-simulate
            </button>
            <button
              onClick={handleResetForward}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: `${ACCENT_CYAN}${OPACITY_15}`,
                color: ACCENT_CYAN,
                border: `1px solid ${ACCENT_CYAN}30`,
              }}
              data-testid="squad-reset-forward-btn"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </SurfaceCard>

      {/* Inline error state — surfaces an invalid director config instead of
          rendering a silently-broken (NaN / off-canvas) formation diagram. */}
      {configError && <SquadConfigErrorBanner error={configError} />}

      {/* Config + Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Formation selector */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Formation</h4>
          <div className="space-y-1">
            {PRESET_FORMATIONS.map(f => (
              <button
                key={f.id}
                onClick={() => handleFormationChange(f.id)}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  backgroundColor: config.formation.id === f.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
                  color: config.formation.id === f.id ? ACCENT : 'var(--text-muted)',
                  border: config.formation.id === f.id ? `1px solid ${ACCENT}30` : '1px solid transparent',
                }}
                data-testid={`squad-formation-${f.id}`}
              >
                <span className="font-bold">{f.name}</span>
                <span className="text-2xs block text-text-muted mt-0.5">{f.description}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        {/* Weights / params */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Director Weights</h4>
          {[
            { key: 'flankWeight' as const, label: 'Flank Angle', value: config.flankWeight },
            { key: 'separationWeight' as const, label: 'Ally Separation', value: config.separationWeight },
            { key: 'rangeWeight' as const, label: 'Range Preference', value: config.rangeWeight },
          ].map(w => (
            <div key={w.key} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-2xs text-text-muted">{w.label}</span>
                <span className="text-2xs font-mono font-bold" style={{ color: ACCENT }}>{w.value.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={w.value}
                onChange={e => handleWeightChange(w.key, parseFloat(e.target.value))}
                className="w-full h-1 accent-current rounded-full"
                style={{ accentColor: ACCENT }}
              />
            </div>
          ))}
          <div className="space-y-0.5 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-text-muted">Attack Distance</span>
              <span className="text-2xs font-mono font-bold" style={{ color: ACCENT }}>{config.attackDistance} UU</span>
            </div>
            <input
              type="range"
              min={100} max={600} step={25}
              value={config.attackDistance}
              onChange={e => handleDistanceChange(parseInt(e.target.value))}
              className="w-full h-1 accent-current rounded-full"
              style={{ accentColor: ACCENT }}
            />
          </div>
        </SurfaceCard>

        {/* Formation metrics */}
        <SurfaceCard className="p-3 space-y-2">
          <h4 className="text-xs font-bold text-text">Formation Metrics</h4>
          {result ? (
            [
              { label: 'Quality Score', value: `${(result.formationScore * 100).toFixed(0)}%`, color: result.formationScore > 0.7 ? STATUS_SUCCESS : result.formationScore > 0.4 ? STATUS_WARNING : STATUS_ERROR },
              { label: 'Angular Coverage', value: `${result.angularCoverage.toFixed(0)}°/360°`, color: result.angularCoverage > 200 ? STATUS_SUCCESS : result.angularCoverage > 120 ? STATUS_WARNING : STATUS_ERROR },
              { label: 'Avg Separation', value: `${result.avgSeparation.toFixed(0)} UU`, color: result.avgSeparation > config.minSeparation ? STATUS_SUCCESS : STATUS_ERROR },
              { label: 'Squad Size', value: `${result.members.length}`, color: ACCENT },
              { label: 'Collisions', value: result.hasCollisions ? 'Yes' : 'None', color: result.hasCollisions ? STATUS_ERROR : STATUS_SUCCESS },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-2xs text-text-muted">{m.label}</span>
                <span className="text-2xs font-mono font-bold" style={{ color: m.color }}>{m.value}</span>
              </div>
            ))
          ) : (
            <p className="text-2xs text-text-muted italic" data-testid="squad-metrics-unavailable">
              Metrics unavailable — fix the config above to recompute.
            </p>
          )}
          {/* Role breakdown */}
          <div className="pt-1 border-t border-border/30 space-y-1">
            <span className="text-2xs text-text-muted">Roles</span>
            <div className="flex flex-wrap gap-1">
              {config.formation.roles.map(({ role, count }) => {
                const RoleIcon = ROLE_ICONS[role];
                return (
                  <span
                    key={role}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-mono"
                    style={{
                      backgroundColor: `${ROLE_COLORS[role]}${OPACITY_10}`,
                      color: ROLE_COLORS[role],
                      border: `1px solid ${ROLE_COLORS[role]}30`,
                    }}
                  >
                    <RoleIcon className="w-2.5 h-2.5" />
                    {count}x {ROLE_DEFINITIONS[role].label}
                  </span>
                );
              })}
            </div>
          </div>
        </SurfaceCard>
      </div>

      {/* Sub-tab navigation + content — only when the config produced a result. */}
      {result && (
        <>
          <SubTabNavigation
            tabs={SUB_TABS}
            activeTabId={activeTab}
            onChange={setActiveTab}
            accent={ACCENT}
          />

          {activeTab === 'formation' && (
            <FormationView
              config={config}
              result={result}
              isDragging={drag.isDragging}
              svgRef={svgRef}
              scale={scale}
              arrowEndX={arrowEndX}
              arrowEndY={arrowEndY}
              onPointerDown={drag.onPointerDown}
              onPointerUp={drag.onPointerUp}
              onPointerMove={drag.onPointerMove}
            />
          )}
          {activeTab === 'pipeline' && (
            <PipelineView result={result} />
          )}
          {activeTab === 'codegen' && (
            <CodeGenView config={config} />
          )}
        </>
      )}
    </div>
  );
}
