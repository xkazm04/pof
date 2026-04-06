'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR, STATUS_SUBDUED, ACCENT_CYAN_LIGHT, OVERLAY_WHITE,
  withOpacity, OPACITY_5, OPACITY_80,
} from '@/lib/chart-colors';
import { DiffViewer } from '../../_shared';
import { BlueprintPanel, SectionHeader } from '../design';
import { ACCENT, ENHANCED_SLOTS, SAVE_DIFF_ENTRIES, buildSlotDiff } from '../data';
import type { DiffEntry } from '@/types/unique-tab-improvements';

export function SaveDiffSection() {
  const [diffSlotA, setDiffSlotA] = useState(ENHANCED_SLOTS[1].id);
  const [diffSlotB, setDiffSlotB] = useState(ENHANCED_SLOTS[2].id);

  const resolvedSlotA = ENHANCED_SLOTS.find(s => s.id === diffSlotA);
  const resolvedSlotB = ENHANCED_SLOTS.find(s => s.id === diffSlotB);
  const diffEntries: DiffEntry[] = resolvedSlotA && resolvedSlotB
    ? buildSlotDiff(resolvedSlotA, resolvedSlotB)
    : SAVE_DIFF_ENTRIES;

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10">
        <SectionHeader label="SAVE_DIFF_VIEWER" icon={FileText} color={ACCENT} />
      </div>

      {/* Slot-to-slot comparison picker */}
      <div className="px-4 py-2.5 border-b border-border/10 flex items-center gap-3 font-mono text-xs" style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_5)}` }}>
        <select
          value={diffSlotA}
          onChange={e => setDiffSlotA(e.target.value)}
          aria-label="Left comparison slot"
          className="bg-surface-deep border border-border/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
            style={{ color: ACCENT_CYAN_LIGHT }}
        >
          {ENHANCED_SLOTS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label} -- {s.characterName} Lv.{s.level}
            </option>
          ))}
        </select>
        <span className="text-text-muted text-sm">vs</span>
        <select
          value={diffSlotB}
          onChange={e => setDiffSlotB(e.target.value)}
          aria-label="Right comparison slot"
          className="bg-surface-deep border border-border/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
            style={{ color: ACCENT_CYAN_LIGHT }}
        >
          {ENHANCED_SLOTS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label} -- {s.characterName} Lv.{s.level}
            </option>
          ))}
        </select>
        {diffSlotA === diffSlotB && (
          <span className="ml-1" style={{ color: withOpacity(STATUS_WARNING, OPACITY_80) }}>same slot -- no changes</span>
        )}
      </div>

      <div className="p-3 relative z-10">
        {/* Summary stats */}
        <div className="flex gap-4 mb-3 font-mono text-xs">
          {(['changed', 'added', 'removed', 'unchanged'] as const).map(type => {
            const count = diffEntries.filter(e => e.changeType === type).length;
            const colors = { changed: STATUS_WARNING, added: STATUS_SUCCESS, removed: STATUS_ERROR, unchanged: STATUS_SUBDUED };
            return (
              <span key={type} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[type] }} />
                <span className="text-xs font-mono uppercase tracking-[0.15em]" style={{ color: colors[type] }}>{type}</span>
                <span className="font-bold" style={{ color: OVERLAY_WHITE }}>{count}</span>
              </span>
            );
          })}
        </div>

        <DiffViewer entries={diffEntries} accent={ACCENT} />
      </div>
    </BlueprintPanel>
  );
}
