'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_CYAN } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import {
  SCHEMA_GROUPS,
  SCHEMA_VERSION_HISTORY,
  FEATURE_NAMES,
} from '@/components/modules/core-engine/unique-tabs/SaveDataSchema/data';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SaveSchemaPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_CYAN;

const TOTAL_FIELDS = SCHEMA_GROUPS.reduce((s, g) => s + g.fields.length, 0);
const CURRENT_VERSION = SCHEMA_VERSION_HISTORY.find(v => v.isCurrent);

const SAVE_PIPELINE = ['Gather State', 'Serialize', 'Compress', 'Write Slot', 'Verify'] as const;

const SAVE_FEATURES = [
  'UARPGSaveGame', 'Custom serialization', 'Save versioning',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function SchemaMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Database className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{TOTAL_FIELDS} fields</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SchemaCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {SCHEMA_GROUPS.map((g) => (
        <div key={g.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: g.color }}
          />
          <span className="text-text font-medium flex-1">{g.label}</span>
          <span className="text-text-muted">{g.fields.length}f</span>
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {CURRENT_VERSION?.version ?? 'v?'} · {SCHEMA_VERSION_HISTORY.length} versions
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function SchemaFull({ featureMap, defs }: SaveSchemaPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Save data schema with {SCHEMA_GROUPS.length} groups, {TOTAL_FIELDS} fields,
        currently at {CURRENT_VERSION?.version ?? 'unknown'} across {SCHEMA_VERSION_HISTORY.length} versions.
      </SurfaceCard>

      {/* Schema Groups */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Database} label="Schema Groups" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SCHEMA_GROUPS.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              <span className="font-mono font-bold w-28" style={{ color: g.color }}>{g.label}</span>
              <span className="text-text-muted">{g.fields.length} fields — {g.fields.map(f => f.name).join(', ')}</span>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Version timeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Version History" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {SCHEMA_VERSION_HISTORY.map((v, i) => (
            <motion.div
              key={v.version}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className={`font-mono font-bold w-12 ${v.isCurrent ? 'text-accent' : 'text-text-muted'}`}
                style={v.isCurrent ? { color: ACCENT } : undefined}
              >{v.label}</span>
              <span className="text-text-muted flex-1">{v.summary}</span>
              {v.breaking && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">breaking</span>}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {SAVE_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Save Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...SAVE_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function SaveSchemaPanel({ featureMap, defs }: SaveSchemaPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Save Data Schema" icon={<Database className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <SchemaMicro />}
          {density === 'compact' && <SchemaCompact />}
          {density === 'full' && <SchemaFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
