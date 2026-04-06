'use client';

import { ITEM_SETS, ACCENT } from '../data';
import { withOpacity, OPACITY_25, OPACITY_50 } from '@/lib/chart-colors';

const setCount = ITEM_SETS.length;
const bonusCount = ITEM_SETS.reduce((sum, s) => sum + s.bonuses.length, 0);

export function SetsMetric() {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono leading-tight">
        <span className="font-bold" style={{ color: ACCENT }}>{setCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {setCount === 1 ? 'set' : 'sets'} / </span>
        <span className="font-bold" style={{ color: ACCENT }}>{bonusCount}</span>
        <span style={{ color: withOpacity(ACCENT, OPACITY_50) }}> {bonusCount === 1 ? 'bonus' : 'bonuses'}</span>
      </div>
      <div className="flex gap-2" aria-hidden="true">
        {ITEM_SETS.map((set) => (
          <div key={set.name} className="flex gap-0.5" title={`${set.name}: ${set.pieces.filter(p => p.owned).length}/${set.pieces.length}`}>
            {set.pieces.map((p) => (
              <span
                key={p.slot}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: p.owned ? set.color : withOpacity(set.color, OPACITY_25) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
