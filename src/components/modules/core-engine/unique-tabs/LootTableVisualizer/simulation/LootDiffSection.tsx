'use client';

import { Diff } from 'lucide-react';
import { ACCENT_EMERALD, STATUS_SUCCESS, STATUS_WARNING, STATUS_SUBDUED } from '@/lib/chart-colors';
import { DiffViewer } from '../../_shared';
import { LOOT_DIFF_ENTRIES } from '../data';
import { BlueprintPanel, SectionHeader } from '../design';

export function LootDiffSection() {
  return (
    <BlueprintPanel className="p-3">
      <SectionHeader icon={Diff} label="Loot Table Diff" color={ACCENT_EMERALD} />
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted mb-2">
        Level 10 Boss vs Level 20 Boss
      </div>
      <DiffViewer entries={LOOT_DIFF_ENTRIES} accent={ACCENT_EMERALD} />
      <div className="mt-2 flex gap-3 text-2xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_WARNING }} />
          Changed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUBDUED }} />
          Unchanged
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_SUCCESS }} />
          Increased rate
        </span>
      </div>
    </BlueprintPanel>
  );
}
