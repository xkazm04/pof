'use client';

import { Zap, ArrowRight, Timer, CheckCircle2, CircleDashed, Lock } from 'lucide-react';
import {
  STATUS_WARNING, STATUS_SUCCESS, STATUS_LOCKED,
  ACCENT_CYAN,
  OPACITY_8, OPACITY_15, OPACITY_20,
  withOpacity,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { FAST_TRAVEL_NODES, FAST_TRAVEL_COVERAGE } from '../_shared/data';

const ACCENT = ACCENT_CYAN;

export function FastTravelNetwork() {
  return (
    <BlueprintPanel color={ACCENT} className="p-3">
      <SectionHeader icon={Zap} label="Fast Travel Network" color={ACCENT} />

      {/* Coverage Summary — glyph + percentage, so coverage never reads by hue alone. */}
      <div className="flex flex-wrap gap-2 mb-2.5 pb-3 border-b border-border/40">
        {FAST_TRAVEL_COVERAGE.map((ftc) => {
          const full = ftc.pct === 100;
          const partial = ftc.pct > 0 && ftc.pct < 100;
          const CoverageIcon = full ? CheckCircle2 : partial ? CircleDashed : Lock;
          const coverageColor = full ? STATUS_SUCCESS : partial ? STATUS_WARNING : STATUS_LOCKED;
          return (
            <div key={ftc.zone} className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em]">
              <span className="text-text-muted">{ftc.zone}:</span>
              <span className="font-bold flex items-center gap-1" style={{ color: coverageColor }}>
                <CoverageIcon aria-hidden className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
                {ftc.pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Travel Nodes */}
      <div className="space-y-3">
        {FAST_TRAVEL_NODES.map((node) => (
          <div key={node.name} className="bg-surface-deep rounded-lg p-3 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" style={{ color: node.discovered ? ACCENT : STATUS_LOCKED }} />
                <span className="text-xs font-bold text-text">{node.name}</span>
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted">({node.zone})</span>
              </div>
              <span className="flex items-center gap-1 text-xs font-mono uppercase tracking-[0.15em] font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: node.discovered ? STATUS_SUCCESS : STATUS_LOCKED,
                  backgroundColor: node.discovered ? withOpacity(STATUS_SUCCESS, OPACITY_8) : 'transparent',
                  border: `1px ${node.discovered ? 'solid' : 'dashed'} ${withOpacity(node.discovered ? STATUS_SUCCESS : STATUS_LOCKED, OPACITY_20)}`,
                }}>
                {node.discovered
                  ? <CheckCircle2 aria-hidden className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
                  : <Lock aria-hidden className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />}
                {node.discovered ? 'Discovered' : 'Undiscovered'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {node.travelTimes.map((tt) => (
                <span key={tt.to} className="flex items-center gap-1 text-xs font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface/50 border border-border/30">
                  <ArrowRight className="w-2.5 h-2.5" />
                  {tt.to}
                  <Timer className="w-2.5 h-2.5 ml-1 opacity-50" />
                  <span className="font-bold" style={{ color: ACCENT }}>{tt.seconds}s</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </BlueprintPanel>
  );
}
