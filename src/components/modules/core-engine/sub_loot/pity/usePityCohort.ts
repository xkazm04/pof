'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_COHORT_PLAYERS, cohortPercentiles, compareToAnalytic, mulberry32, pityBenefit, simulateCohort,
  type AnalyticComparison, type CohortResult, type PityBenefit,
} from './pityCohort';

export const PITY_COHORT_DEBOUNCE_MS = 150;
const COHORT_SEED = 0x51ed;

export interface PityCohortView {
  noPity: CohortResult;
  pity: CohortResult;
  /** [p50, p95, p99] of the pity cohort. */
  percentiles: (number | null)[];
  drift: AnalyticComparison;
  benefit: PityBenefit;
  /** The inputs this view was computed for; a mismatch with the live inputs means stale. */
  inputKey: string;
}

interface Options {
  rate: number;
  /** null when pity is switched off: the "pity" cohort is then the plain one. */
  threshold: number | null;
  players?: number;
  debounceMs?: number;
}

/** Debounced cohort simulation: runs in a timeout, never on the render path. */
export function usePityCohort({ rate, threshold, players = DEFAULT_COHORT_PLAYERS, debounceMs = PITY_COHORT_DEBOUNCE_MS }: Options) {
  const [result, setResult] = useState<PityCohortView | null>(null);
  const noPityCache = useRef<{ key: string; cohort: CohortResult } | null>(null);

  const inputKey = `${rate}|${threshold}|${players}`;

  useEffect(() => {
    const id = setTimeout(() => {
      const count = Math.min(players, DEFAULT_COHORT_PLAYERS);
      const key = `${rate}|${count}`;
      if (noPityCache.current?.key !== key) {
        noPityCache.current = {
          key, cohort: simulateCohort({ rate, threshold: null, players: count, rng: mulberry32(COHORT_SEED) }),
        };
      }
      const noPity = noPityCache.current.cohort;
      const pity = threshold === null
        ? noPity
        : simulateCohort({ rate, threshold, players: count, rng: mulberry32(COHORT_SEED + 1) });
      setResult({
        noPity, pity,
        percentiles: cohortPercentiles(pity.kills, [50, 95, 99]),
        drift: compareToAnalytic(pity, rate, threshold),
        benefit: pityBenefit(noPity, pity),
        inputKey,
      });
    }, debounceMs);
    return () => clearTimeout(id);
  }, [rate, threshold, players, debounceMs, inputKey]);

  return { result, pending: result?.inputKey !== inputKey };
}
