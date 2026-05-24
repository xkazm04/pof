'use client';

import { Table2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_ERROR, STATUS_WARNING } from '@/lib/chart-colors';
import type { DodgeParams, DodgePhases, HitMarker } from '../_shared/dodge-types';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { FrameDataTable } from './FrameDataTable';
import type { PlayheadStats } from './types';

/* ── Phase Legend ─────────────────────────────────────────────────────────── */

export function PhaseLegend({ phases, hitMarkers, stats }: { phases: DodgePhases; hitMarkers: HitMarker[]; stats: PlayheadStats }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {[phases.movement, phases.invuln, phases.cancel, phases.recovery].map((phase) => (
        <span key={phase.label} className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: phase.color }}>
          <span className="w-3 h-1 rounded-full" style={{ backgroundColor: phase.color }} />
          {phase.label}
        </span>
      ))}
      {hitMarkers.length > 0 && (
        <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em]" style={{ color: STATUS_ERROR }}>
          <span className="w-2 h-2 rounded-full border" style={{ borderColor: STATUS_ERROR }} />
          Hits ({stats.dodgedHits}/{stats.totalHits} dodged)
        </span>
      )}
    </div>
  );
}

/* ── Frame Data Panel Wrapper ────────────────────────────────────────────── */

export function FrameDataPanel({ params }: { params: DodgeParams }) {
  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <BlueprintPanel color={STATUS_WARNING} className="p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <SectionHeader icon={Table2} label="Frame Data" color={STATUS_WARNING} />
          <span className="ml-auto text-xs font-mono uppercase tracking-[0.15em] text-text-muted/50">@60 FPS &middot; Dustloop-style</span>
        </div>
        <FrameDataTable params={params} />
      </BlueprintPanel>
    </motion.div>
  );
}
