'use client';

import {
  Shield, Compass,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10,
} from '@/lib/chart-colors';
import type { ComponentKind } from './types';
import { EQS_COMPONENTS } from './eqsComponents';
import { KIND_META } from './constants';
import { GroupSection } from './GroupSection';

// ── Main export ─────────────────────────────────────────────────────────────

export function EQSComponentInventory() {
  const contexts = EQS_COMPONENTS.filter((c) => c.kind === 'context');
  const generators = EQS_COMPONENTS.filter((c) => c.kind === 'generator');
  const tests = EQS_COMPONENTS.filter((c) => c.kind === 'test');

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="eqs-component-inventory">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          <h2 className="text-sm font-bold text-text">EQS Component Inventory</h2>
          <span className="text-2xs text-text-muted">{EQS_COMPONENTS.length} custom components</span>
        </div>
        <p className="text-2xs text-text-muted leading-relaxed max-w-2xl">
          All custom EQS components from <code className="font-mono">Source/PoF/AI/EQS/</code> with
          real UPROPERTY defaults and meta clamps from C++. Grouped by type: Context resolves an actor
          reference, Generators produce spatial candidates, Tests score or filter them.
        </p>
      </div>

      {/* Summary badges */}
      <SurfaceCard className="p-3">
        <div className="flex items-center gap-4 flex-wrap">
          {([
            { kind: 'context' as ComponentKind, count: contexts.length },
            { kind: 'generator' as ComponentKind, count: generators.length },
            { kind: 'test' as ComponentKind, count: tests.length },
          ]).map(({ kind, count }) => {
            const km = KIND_META[kind];
            const Icon = km.icon;
            return (
              <div key={kind} className="flex items-center gap-2">
                <div
                  className="p-1 rounded"
                  style={{ backgroundColor: `${km.color}${OPACITY_10}` }}
                >
                  <span style={{ color: km.color }}><Icon className="w-3 h-3" /></span>
                </div>
                <span className="text-2xs font-bold text-text">{count}</span>
                <span className="text-2xs text-text-muted">{km.label}{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
              <span className="text-2xs text-text-muted">Low cost</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" style={{ color: STATUS_WARNING }} />
              <span className="text-2xs text-text-muted">High cost</span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Grouped sections */}
      <GroupSection kind="context" components={contexts} />
      <GroupSection kind="generator" components={generators} />
      <GroupSection kind="test" components={tests} />
    </div>
  );
}
