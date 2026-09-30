'use client';

import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  ACCENT_PURPLE_BOLD,
  withOpacity, OPACITY_5, OPACITY_8, OPACITY_25,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from '../../unique-tabs/_shared';
import { useSpellbookData } from '../_shared/context';
import { CooldownWheel, formatCd } from './CooldownWheel';

/** The overview row shows at most this many wheels; the chips above reach the rest. */
const OVERVIEW_CAP = 8;

export function CooldownFlow() {
  const { COOLDOWN_ABILITIES: rows } = useSpellbookData();
  const [selected, setSelected] = useState(0);
  const maxCd = useMemo(
    () => rows.reduce((m, r) => (r.cd !== null && r.cd > m ? r.cd : m), 0),
    [rows],
  );

  const header = (
    <>
      <div className="absolute right-0 bottom-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: withOpacity(ACCENT_PURPLE_BOLD, OPACITY_5) }} />
      <SectionLabel icon={Clock} label="Cooldown Flow" color={ACCENT_PURPLE_BOLD} />
    </>
  );

  if (rows.length === 0) {
    return (
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        {header}
        <p data-testid="cooldown-flow-empty" className="mt-3 text-sm text-text-muted">
          No ability with a cooldown yet. Author one in the spellbook catalog.
        </p>
      </SurfaceCard>
    );
  }

  // The list can shrink under a stale selection (live sync, catalog edit): clamp it.
  const idx = Math.min(selected, rows.length - 1);
  const current = rows[idx];
  const hidden = rows.length - OVERVIEW_CAP;

  return (
    <SurfaceCard level={2} className="p-3 relative overflow-hidden">
      {header}
      <div className="flex flex-wrap gap-1.5 mb-3 mt-3 max-h-28 overflow-y-auto">
        {rows.map((ability, i) => (
          <button key={ability.id} type="button" onClick={() => setSelected(i)} aria-pressed={idx === i}
            className={`px-2.5 py-1 rounded-lg text-sm font-bold border transition-all cursor-pointer ${
              idx === i ? 'shadow-sm' : 'opacity-50 hover:opacity-80'
            }`}
            style={idx === i ? {
              backgroundColor: withOpacity(ability.color, OPACITY_8),
              borderColor: withOpacity(ability.color, OPACITY_25),
              color: ability.color,
            } : {
              backgroundColor: 'transparent',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}>
            {ability.name}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 justify-center flex-wrap">
        <CooldownWheel ability={current} maxCd={maxCd} index={0} />
        <div data-testid="cooldown-detail" className="text-sm text-text-muted space-y-1">
          <div className="font-mono font-bold" style={{ color: current.color }}>{current.name}</div>
          {current.cd !== null ? (
            <>
              <div className="font-mono">Cooldown: {formatCd(current.cd)}</div>
              {maxCd > 0 && (
                <div className="font-mono">{Math.round((current.cd / maxCd) * 100)}% of the longest ({formatCd(maxCd)})</div>
              )}
            </>
          ) : (
            <div className="font-mono">Cooldown: in a GE blueprint (no catalog entry)</div>
          )}
        </div>
      </div>
      {/* Overview, capped so a large catalog does not render a wall of wheels */}
      <div className="flex items-center gap-4 justify-center flex-wrap mt-4 pt-3 border-t border-border/30">
        {rows.slice(0, OVERVIEW_CAP).map((ab, i) => (
          <CooldownWheel key={ab.id} ability={ab} maxCd={maxCd} index={i} />
        ))}
        {hidden > 0 && (
          <span className="text-xs font-mono text-text-muted">+{hidden} more, pick one above</span>
        )}
      </div>
    </SurfaceCard>
  );
}
