'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
  STATUS_COLORS,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { FeatureRow, FeatureStatus } from '@/types/feature-matrix';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface EffectsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = '#ef4444';

const EFFECT_TYPES = [
  { name: 'GE_Damage', desc: 'Instant damage application', color: '#ef4444' },
  { name: 'GE_Heal', desc: 'Health restoration over time', color: '#10b981' },
  { name: 'GE_Buff', desc: 'Temporary stat modifier', color: '#3b82f6' },
  { name: 'GE_Regen', desc: 'Periodic health/mana regen', color: '#8b5cf6' },
];

const EFFECT_FEATURE_NAMES = ['Core Gameplay Effects', 'Damage execution calculation'];

const EFFECT_PIPELINE_STEPS = ['Predict', 'Apply', 'Stack', 'Expire', 'Remove'] as const;

/* ── Helpers ────────────────────────────────────────────────────────────── */

function statusDotColor(status: FeatureStatus | undefined): string {
  if (!status) return STATUS_COLORS.unknown.dot;
  return STATUS_COLORS[status].dot;
}

/* ── Micro density ──────────────────────────────────────────────────────── */

function EffectsMicro() {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-2">
      <Flame className="w-5 h-5 text-red-400" />
      <span className="font-mono text-xs">{EFFECT_TYPES.length}</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function EffectsCompact({ featureMap }: EffectsPanelProps) {
  return (
    <div className="space-y-2 p-2 text-xs">
      {/* Effect type list */}
      <div className="space-y-1">
        {EFFECT_TYPES.map((effect) => (
          <div key={effect.name} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: effect.color }}
            />
            <span className="font-medium text-text">{effect.name}</span>
            <span className="text-text-muted truncate ml-auto text-2xs">{effect.desc}</span>
          </div>
        ))}
      </div>

      {/* Feature status indicators */}
      <div className="border-t border-border/40 pt-1.5 space-y-1">
        {EFFECT_FEATURE_NAMES.map((name) => {
          const status = featureMap.get(name)?.status;
          const dotColor = statusDotColor(status);
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span className="text-text-muted truncate">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function EffectsFull({ featureMap, defs }: EffectsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className="space-y-2.5">
      {/* Feature cards */}
      {EFFECT_FEATURE_NAMES.map((name) => (
        <FeatureCard
          key={name}
          name={name}
          featureMap={featureMap}
          defs={defs}
          expanded={expanded}
          onToggle={onToggle}
          accent={ACCENT}
        />
      ))}

      {/* Effect type cards */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="Effect Types" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {EFFECT_TYPES.map((effect) => (
            <SurfaceCard key={effect.name} level={3} className="p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: effect.color, boxShadow: `0 0 6px ${effect.color}60` }}
                />
                <span className="text-xs font-semibold text-text">{effect.name}</span>
              </div>
              <p className="text-2xs text-text-muted leading-relaxed">{effect.desc}</p>
            </SurfaceCard>
          ))}
        </div>
      </SurfaceCard>

      {/* Effect application pipeline */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <SectionLabel label="Effect Application Pipeline" />
        <div className="mt-3">
          <PipelineFlow steps={[...EFFECT_PIPELINE_STEPS]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main EffectsPanel ──────────────────────────────────────────────────── */

export function EffectsPanel({ featureMap, defs }: EffectsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Effects" icon={<Flame className="w-4 h-4" />}>
      {density === 'micro' && <EffectsMicro />}
      {density === 'compact' && <EffectsCompact featureMap={featureMap} defs={defs} />}
      {density === 'full' && <EffectsFull featureMap={featureMap} defs={defs} />}
    </PanelFrame>
  );
}
