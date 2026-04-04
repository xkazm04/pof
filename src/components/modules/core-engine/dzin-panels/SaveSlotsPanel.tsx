'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDensity, PanelFrame } from '@/lib/dzin/core';
import { DZIN_SPACING, TRANSITION_ENTER, TRANSITION_EXIT } from '@/lib/dzin/animation-constants';
import {
  FeatureCard,
  PipelineFlow,
  SectionLabel,
} from '@/components/modules/core-engine/unique-tabs/_shared';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ACCENT_EMERALD, ACCENT_CYAN, STATUS_WARNING, STATUS_SUBDUED } from '@/lib/chart-colors';
import type { FeatureRow } from '@/types/feature-matrix';
import {
  SAVE_SLOTS,
  FILE_SIZE_SECTIONS,
  TOTAL_BYTES,
  COMPRESSION_RATIO,
  formatBytes,
} from '@/components/modules/core-engine/unique-tabs/SaveDataSchema/data';

/* ── Props ──────────────────────────────────────────────────────────────── */

export interface SaveSlotsPanelProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
}

/* ── Constants ──────────────────────────────────────────────────────────── */

const ACCENT = ACCENT_EMERALD;

const ACTIVE_SLOTS = SAVE_SLOTS.filter(s => !s.empty);

const SLOT_PIPELINE = ['Select Slot', 'Gather State', 'Serialize', 'Compress', 'Write File', 'Update Meta'] as const;

const SLOT_FEATURES = [
  'Save function', 'Load function', 'Auto-save', 'Save slot system',
];

/* ── Micro density ──────────────────────────────────────────────────────── */

function SlotsMicro() {
  return (
    <div className={DZIN_SPACING.micro.wrapper}>
      <Save className="w-5 h-5" style={{ color: ACCENT }} />
      <span className="font-mono text-xs">{ACTIVE_SLOTS.length}/{SAVE_SLOTS.length} slots</span>
    </div>
  );
}

/* ── Compact density ────────────────────────────────────────────────────── */

function SlotsCompact() {
  return (
    <div className={`${DZIN_SPACING.compact.wrapper} text-xs`}>
      {SAVE_SLOTS.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.empty ? STATUS_SUBDUED : s.isAuto ? STATUS_WARNING : ACCENT }}
          />
          <span className="text-text font-medium flex-1">{s.label}</span>
          {!s.empty && <span className="text-text-muted">Lv{s.level}</span>}
        </div>
      ))}
      <div className={`border-t border-border/40 ${DZIN_SPACING.compact.divider} text-text-muted`}>
        {formatBytes(TOTAL_BYTES)} raw · {formatBytes(Math.round(TOTAL_BYTES * COMPRESSION_RATIO))} compressed
      </div>
    </div>
  );
}

/* ── Full density ───────────────────────────────────────────────────────── */

function SlotsFull({ featureMap, defs }: SaveSlotsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const onToggle = (name: string) => setExpanded((prev) => (prev === name ? null : name));

  return (
    <div className={DZIN_SPACING.full.wrapper}>
      <SurfaceCard level={3} className={`${DZIN_SPACING.full.card} bg-surface-deep/50 border-border/40 text-sm text-text-muted leading-relaxed`}>
        Save slot manager with {SAVE_SLOTS.length} slots ({ACTIVE_SLOTS.length} active),
        {formatBytes(TOTAL_BYTES)} raw data at {Math.round(COMPRESSION_RATIO * 100)}% compression ratio.
      </SurfaceCard>

      {/* Slot list */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel icon={Save} label="Save Slots" color={ACCENT} />
        <div className="space-y-2 mt-2">
          {SAVE_SLOTS.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 text-xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.empty ? STATUS_SUBDUED : s.isAuto ? STATUS_WARNING : ACCENT }}
              />
              <span className="font-mono font-bold w-20" style={{ color: s.empty ? STATUS_SUBDUED : ACCENT }}>{s.label}</span>
              {s.empty ? (
                <span className="text-text-muted italic">Empty</span>
              ) : (
                <span className="text-text-muted">Lv{s.level} · {s.zone} · {s.playtime} · {s.ts}</span>
              )}
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* File size breakdown */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="File Size Budget" color={ACCENT} />
        <div className="space-y-1.5 mt-2">
          {FILE_SIZE_SECTIONS.map((sec, i) => (
            <motion.div
              key={sec.label}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 text-xs"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sec.color }} />
              <span className="font-mono w-32" style={{ color: sec.color }}>{sec.label}</span>
              <span className="text-text-muted">{formatBytes(sec.bytes)}</span>
              <div className="flex-1 h-1.5 bg-surface-deep/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(sec.bytes / TOTAL_BYTES) * 100}%`, backgroundColor: sec.color }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </SurfaceCard>

      {/* Feature cards */}
      {SLOT_FEATURES.map((name) => (
        <FeatureCard key={name} name={name} featureMap={featureMap} defs={defs} expanded={expanded} onToggle={onToggle} accent={ACCENT} />
      ))}

      {/* Pipeline */}
      <SurfaceCard level={2} className={`${DZIN_SPACING.full.card} relative overflow-hidden`}>
        <SectionLabel label="Save Slot Pipeline" />
        <div className={DZIN_SPACING.full.pipelineMt}>
          <PipelineFlow steps={[...SLOT_PIPELINE]} accent={ACCENT} />
        </div>
      </SurfaceCard>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */

export function SaveSlotsPanel({ featureMap, defs }: SaveSlotsPanelProps) {
  const density = useDensity();

  return (
    <PanelFrame title="Save Slots" icon={<Save className="w-4 h-4" />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={density}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: TRANSITION_EXIT }}
          transition={TRANSITION_ENTER}
        >
          {density === 'micro' && <SlotsMicro />}
          {density === 'compact' && <SlotsCompact />}
          {density === 'full' && <SlotsFull featureMap={featureMap} defs={defs} />}
        </motion.div>
      </AnimatePresence>
    </PanelFrame>
  );
}
