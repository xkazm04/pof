'use client';

import { useMemo, useState } from 'react';
import { ComparisonMatrix } from './ComparisonMatrix';
import { ArchetypeBalanceRadar } from './ArchetypeBalanceRadar';
import { PredictiveBalanceSimulator } from './predictive/PredictiveBalanceSimulator';
import { COMPARISON_CHARACTERS, computeBalanceScores } from '../_shared/data';

export function SimulatorTab() {
  const [comparisonIds, setComparisonIds] = useState<string[]>(
    () => COMPARISON_CHARACTERS.slice(0, 2).map((c) => c.id),
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
    <div className="space-y-5">
      <ComparisonMatrix selected={comparisonIds} onSelectionChange={setComparisonIds} />
      <ArchetypeBalanceRadar balanceResults={balanceResults} scoreMean={scoreMean} />
      <PredictiveBalanceSimulator />
    </div>
  );
}
