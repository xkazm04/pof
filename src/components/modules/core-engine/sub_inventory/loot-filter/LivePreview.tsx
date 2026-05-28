'use client';

import { useState } from 'react';
import { Volume2, Eye, EyeOff } from 'lucide-react';
import {
  RARITY_COLORS, STATUS_SUCCESS, STATUS_WARNING, STATUS_MUTED, withOpacity, OPACITY_8, OPACITY_15,
} from '@/lib/chart-colors';
import type { FilterEvaluation } from '@/lib/loot-filter/types';

function StatChip({ label, value, color, testId }: { label: string; value: number; color: string; testId: string }) {
  return (
    <div className="flex-1 rounded-lg border px-2.5 py-1.5" style={{ borderColor: withOpacity(color, OPACITY_15), backgroundColor: withOpacity(color, OPACITY_8) }}>
      <div className="text-lg font-mono font-bold tabular-nums leading-none" style={{ color }} data-testid={testId}>{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

/** Runs the ruleset live against the catalog and shows which drops surface (and how). */
export function LivePreview({ evaluation, accent }: { evaluation: FilterEvaluation; accent: string }) {
  const [showHidden, setShowHidden] = useState(false);
  const rows = showHidden ? evaluation.outcomes : evaluation.outcomes.filter((o) => o.visible);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <StatChip label="Surfaced" value={evaluation.shown} color={STATUS_SUCCESS} testId="lf-count-surfaced" />
        <StatChip label="Highlighted" value={evaluation.highlighted} color={STATUS_WARNING} testId="lf-count-highlighted" />
        <StatChip label="Hidden" value={evaluation.hidden} color={STATUS_MUTED} testId="lf-count-hidden" />
      </div>

      <button type="button" onClick={() => setShowHidden((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text cursor-pointer">
        {showHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {showHidden ? 'Hiding nothing — showing all drops' : `Hiding ${evaluation.hidden} drop${evaluation.hidden === 1 ? '' : 's'} (click to reveal)`}
      </button>

      <div className="space-y-0.5 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
        {rows.map((o) => {
          const color = o.style.color || RARITY_COLORS[o.item.rarity] || accent;
          return (
            <div key={o.item.id}
              className={`flex items-center gap-2 px-2 py-1 rounded-md ${o.visible ? '' : 'opacity-40'}`}
              style={{ backgroundColor: o.action === 'highlight' ? withOpacity(color, OPACITY_8) : 'transparent' }}>
              {o.style.beam
                ? <span className="w-0.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
                : <span className="w-0.5 h-4 flex-shrink-0" />}
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: RARITY_COLORS[o.item.rarity] || accent }} />
              <span className={`text-sm font-medium truncate ${o.visible ? '' : 'line-through'}`} style={{ color: o.visible ? color : undefined }}>{o.item.name}</span>
              <span className="text-[10px] font-mono text-text-muted/60 truncate hidden sm:inline">{o.item.type}/{o.item.subtype}</span>
              <span className="flex-1" />
              {o.style.sound && o.style.sound !== 'None' && <Volume2 className="w-3 h-3 flex-shrink-0" style={{ color }} />}
              <span className="text-[10px] font-mono text-text-muted/50 truncate max-w-[130px] flex-shrink-0">{o.matchedRuleName ?? 'default'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
