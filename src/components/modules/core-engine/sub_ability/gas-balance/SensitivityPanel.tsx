'use client';

import { TrendingDown, AlertTriangle } from 'lucide-react';
import {
  STATUS_WARNING,
  ACCENT_CYAN, ACCENT_ORANGE,
  MODULE_COLORS, ACCENT_VIOLET, STATUS_ERROR,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import { SensitivityChart } from './SensitivityChart';
import type { SensitivityResult } from './data';
import { ACCENT } from './data';

const sensColors: Record<string, string> = {
  strength: ACCENT_ORANGE, armor: MODULE_COLORS.core,
  criticalChance: STATUS_WARNING, attackPower: STATUS_ERROR, baseDamage: ACCENT_CYAN,
};

interface Props {
  show: boolean;
  results: SensitivityResult[];
  running: boolean;
  onRun: () => void;
}

export function SensitivityPanel({ show, results, running, onRun }: Props) {
  return (
    <BlueprintPanel color={ACCENT_VIOLET} className="p-3">
      <div className="flex items-center justify-between">
        <SectionHeader icon={TrendingDown} label="Attribute Sensitivity Analysis" color={ACCENT_VIOLET} />
        <button onClick={onRun} disabled={running}
          className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50">
          {running ? 'Running...' : 'Run Analysis'}
        </button>
      </div>
      <p className="text-2xs text-text-muted mt-0.5 mb-2">
        Sweeps each attribute across its range (500 iterations per point) to identify diminishing returns and optimal breakpoints.
      </p>
      {show && results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
          {results.map(sr => {
            const c = sensColors[sr.attribute] ?? ACCENT;
            return (
              <BlueprintPanel key={sr.attribute} color={c} className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-bold capitalize" style={{ color: c }}>{sr.attribute}</span>
                  {sr.diminishingAt !== null && (
                    <span className="text-2xs flex items-center gap-0.5" style={{ color: STATUS_WARNING }}>
                      <AlertTriangle className="w-3 h-3" /> DR at {sr.diminishingAt.toFixed(0)}
                    </span>
                  )}
                </div>
                <SensitivityChart result={sr} color={c} />
                <div className="text-2xs text-text-muted text-center mt-0.5">DPS vs {sr.attribute}</div>
              </BlueprintPanel>
            );
          })}
        </div>
      )}
    </BlueprintPanel>
  );
}
