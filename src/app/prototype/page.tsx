'use client';

import { useState, useRef, useMemo } from 'react';
import { DzinLayout } from '@/lib/dzin/core';
import { pofRegistry } from '@/lib/dzin/panel-definitions';
import { CorePanel } from '@/components/modules/core-engine/dzin-panels/CorePanel';
import { useFeatureMatrix } from '@/hooks/useFeatureMatrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { PanelDensity } from '@/lib/dzin/core/types/panel';
import type { PanelDirective } from '@/lib/dzin/core/layout/types';
import type { FeatureRow } from '@/types/feature-matrix';

/* ── Resize presets ────────────────────────────────────────────────────── */

const RESIZE_PRESETS = {
  Small: 160,
  Medium: 320,
  Large: 800,
} as const;

type ResizePreset = keyof typeof RESIZE_PRESETS;
type ControlMode = 'override' | 'resize';

const DENSITIES: PanelDensity[] = ['micro', 'compact', 'full'];

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function PrototypePage() {
  const [mode, setMode] = useState<ControlMode>('override');
  const [selectedDensity, setSelectedDensity] = useState<PanelDensity>('full');
  const [selectedPreset, setSelectedPreset] = useState<ResizePreset>('Large');
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Data wiring (real hooks, no mocks) ─────────────────────────────── */

  const { features, isLoading } = useFeatureMatrix('arpg-combat');
  const defs = MODULE_FEATURE_DEFINITIONS['arpg-combat'] ?? [];

  const featureMap = useMemo(() => {
    const map = new Map<string, FeatureRow>();
    for (const f of features) map.set(f.featureName, f);
    return map;
  }, [features]);

  /* ── Directive ──────────────────────────────────────────────────────── */

  const directives: PanelDirective[] = useMemo(
    () => [
      {
        type: 'arpg-combat-core',
        density: mode === 'override' ? selectedDensity : undefined,
      },
    ],
    [mode, selectedDensity],
  );

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-deep flex items-center justify-center">
        <span className="text-text-muted text-sm animate-pulse">Loading feature data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-deep p-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-text mb-6">Dzin Prototype</h1>

      {/* Control bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <ModeButton
            label="Override"
            active={mode === 'override'}
            onClick={() => setMode('override')}
          />
          <ModeButton
            label="Resize"
            active={mode === 'resize'}
            onClick={() => setMode('resize')}
          />
        </div>

        {/* Density / Resize controls */}
        <div className="flex items-center gap-2">
          {mode === 'override' ? (
            DENSITIES.map((d) => (
              <ControlButton
                key={d}
                label={d}
                active={selectedDensity === d}
                onClick={() => setSelectedDensity(d)}
              />
            ))
          ) : (
            (Object.keys(RESIZE_PRESETS) as ResizePreset[]).map((preset) => (
              <ControlButton
                key={preset}
                label={preset}
                active={selectedPreset === preset}
                onClick={() => setSelectedPreset(preset)}
              />
            ))
          )}
        </div>
      </div>

      {/* Layout container */}
      <div
        ref={containerRef}
        className="mx-auto transition-all duration-300 ease-in-out"
        style={
          mode === 'resize'
            ? { width: RESIZE_PRESETS[selectedPreset] }
            : { maxWidth: '56rem' /* max-w-4xl */ }
        }
      >
        <DzinLayout
          directives={directives}
          registry={pofRegistry}
          renderPanel={() => (
            <CorePanel featureMap={featureMap} defs={defs} />
          )}
          options={{ containerRef, preferredTemplate: 'single' }}
        />
      </div>
    </div>
  );
}

/* ── Control components ────────────────────────────────────────────────── */

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
          : 'bg-surface text-text-muted hover:text-text hover:bg-surface-deep'
      }`}
    >
      {label}
    </button>
  );
}

function ControlButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
        active
          ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
          : 'bg-surface border-border text-text-muted hover:text-text hover:border-border/80'
      }`}
    >
      {label}
    </button>
  );
}
