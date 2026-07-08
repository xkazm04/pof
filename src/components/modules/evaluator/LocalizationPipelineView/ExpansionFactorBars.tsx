import { useMemo } from 'react';
import { SUPPORTED_LOCALES } from '@/lib/localization/definitions';
import { MAX_EXPANSION } from './constants';
import { expansionColor, formatExpansion } from './helpers';

export function ExpansionFactorBars() {
  const sorted = useMemo(
    () => [...SUPPORTED_LOCALES].sort((a, b) => b.expansionFactor - a.expansionFactor),
    [],
  );

  return (
    <div className="space-y-1.5">
      {sorted.map((loc) => {
        const widthPct = (loc.expansionFactor / MAX_EXPANSION) * 100;
        const color = expansionColor(loc.expansionFactor);
        return (
          <div key={loc.code} className="flex items-center gap-3">
            <span className="text-2xs text-text-muted w-20 shrink-0 truncate" title={loc.name}>
              {loc.nativeName}
            </span>
            <div className="flex-1 h-2.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="text-2xs font-medium w-12 text-right shrink-0"
              style={{ color }}
            >
              {formatExpansion(loc.expansionFactor)}
            </span>
            <span className="text-2xs text-text-muted w-8 text-right shrink-0">
              ×{loc.expansionFactor.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
