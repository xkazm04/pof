'use client';

import { STATUS_COLORS } from '../../_shared';
import type { FeatureRow } from '@/types/feature-matrix';

import { withOpacity, OPACITY_50 } from '@/lib/chart-colors';
interface FeatureListProps {
  itemNames: string[];
  featureMap: Map<string, FeatureRow>;
}

export function FeatureList({ itemNames, featureMap }: FeatureListProps) {
  return (
    <>
      {itemNames.map(name => {
        const status = featureMap.get(name)?.status ?? 'unknown';
        const sc = STATUS_COLORS[status];
        return (
          <div key={name} className="flex items-center justify-between text-xs bg-surface/50 p-2 rounded-lg border border-border/50">
            <span className="text-text font-medium">{name}</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-surface shadow-sm border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot, boxShadow: `0 0 5px ${withOpacity(sc.dot, OPACITY_50)}` }} />
              <span style={{ color: sc.dot }}>{sc.label}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}
