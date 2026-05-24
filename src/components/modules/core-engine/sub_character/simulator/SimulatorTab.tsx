'use client';

import { useMemo, useState } from 'react';
import { ComparisonMatrix } from './ComparisonMatrix';
import { ArchetypeBalanceRadar } from './ArchetypeBalanceRadar';
import { PredictiveBalanceSimulator } from './predictive/PredictiveBalanceSimulator';
import { COMPARISON_CHARACTERS, computeBalanceScores } from '../_shared/data';

/** Number of characters selected by default — wide enough to see meaningful balance comparisons. */
const DEFAULT_COMPARISON_COUNT = 4;

export function SimulatorTab() {
  const [comparisonIds, setComparisonIds] = useState<string[]>(
    () => COMPARISON_CHARACTERS.slice(0, DEFAULT_COMPARISON_COUNT).map((c) => c.id),
  );
  const comparisonChars = useMemo(() => {
    const idSet = new Set(comparisonIds);
    return COMPARISON_CHARACTERS.filter((c) => idSet.has(c.id));
  }, [comparisonIds]);
  const balanceResults = useMemo(
    () => computeBalanceScores(comparisonChars),
    [comparisonChars],
  );
  const scoreMean = useMemo(() => {
    if (balanceResults.length === 0) return 0;
    return balanceResults.reduce((a, b) => a + b.compositeScore, 0) / balanceResults.length;
  }, [balanceResults]);

  return (
    <div className="space-y-3">
      {/* ── Matrix (wide) + Radar (compact) side-by-side at lg+, stacked below ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <ComparisonMatrix selected={comparisonIds} onSelectionChange={setComparisonIds} />
        <ArchetypeBalanceRadar balanceResults={balanceResults} scoreMean={scoreMean} />
      </div>
      {/* ── Predictive simulator full-width below ─────────────────────────── */}
      <PredictiveBalanceSimulator />
    </div>
  );
}
