import type { ABTest, ABTestVerdict, PromptCluster } from '@/types/prompt-evolution';
import { TIE_MARGIN, readTestVerdict } from './verdict';

/**
 * Plain-language layer for the Prompt Evolution view's Simple Mode.
 *
 * These pure functions turn the statistical guts of an A/B test (z-test
 * confidence, epsilon-greedy trials, success proportions) and a prompt cluster
 * into a single human-readable verdict — the kind consumer A/B tools surface
 * ("Wording B wins — it succeeded 8 of 10 times; switch to it?"). No DOM, no
 * wall-clock: everything is derived from the supplied records so it stays pure
 * and unit-testable.
 */

export interface PlainVerdict {
  /** Which slot won, or null when it is a tie / still inconclusive. */
  winnerSlot: 'A' | 'B' | null;
  /** Whether the test has actually concluded with a recorded winner. */
  concluded: boolean;
  /** Short headline, e.g. "Wording B wins" or "Too early to call". */
  headline: string;
  /** One sentence with the concrete numbers behind the headline. */
  detail: string;
  /** One-sentence "why this won" derived from the trial data. */
  why: string;
  /** Plain-language confidence note. */
  confidenceNote: string;
}

function pct(rate: number): number {
  return Math.round(rate * 100);
}

function avgMs(totalMs: number, trials: number): number {
  return trials > 0 ? totalMs / trials : Infinity;
}

/**
 * Turn a z-test confidence (0–1) into a plain sentence. The engine only ever
 * stores a few discrete bands (0.95 / 0.9 / 0.8 / lower), so we phrase the
 * high bands as near-certainty and anything under 80% as an early lead.
 */
export function plainConfidence(confidence: number): string {
  if (confidence >= 0.95) return "We're 95% sure this isn't just luck.";
  if (confidence >= 0.9) return "We're about 90% sure this isn't just luck.";
  if (confidence >= 0.8) return "We're fairly sure (around 80%) this isn't just luck.";
  if (confidence > 0) return "This is an early lead — not yet a sure thing.";
  return 'Not enough runs yet to be sure this is real.';
}

/**
 * Build a plain-language verdict for an A/B test. `labelA` / `labelB` are the
 * human variant labels (falls back to "Wording A" / "Wording B"). `verdict` is
 * the reading to state (the server's, from `verdict.ts`); without one the
 * self-reported reading is used. Rates, the tie margin and the basis all come
 * from it — this layer only words them.
 */
export function explainTestVerdict(
  test: ABTest,
  labelA?: string,
  labelB?: string,
  verdict: ABTestVerdict = readTestVerdict(test),
): PlainVerdict {
  const nameA = labelA?.trim() || 'Wording A';
  const nameB = labelB?.trim() || 'Wording B';

  const { rateA, rateB } = verdict;
  const judged = verdict.basis === 'judge';
  const totalTrials = test.variantATrials + test.variantBTrials;

  // Resolve the winning slot. Prefer the recorded winnerId; otherwise infer
  // from current rates (so a running test still gets a "leading" read).
  let winnerSlot: 'A' | 'B' | null = null;
  if (test.winnerId) {
    winnerSlot = test.winnerId === test.variantAId ? 'A' : 'B';
  }
  const concluded = test.status === 'concluded' && Boolean(test.winnerId);

  // Inconclusive: still running with no clear lead, or no trials at all.
  if (!concluded && (totalTrials < 2 || verdict.tie)) {
    const detail = totalTrials === 0
      ? 'No runs recorded yet.'
      : judged
        ? `So far the judges passed ${nameA} ${pct(rateA)}% of ${verdict.trialsA} verdicts and ${nameB} ${pct(rateB)}% of ${verdict.trialsB}.`
        : `So far: ${nameA} succeeded ${test.variantASuccesses} of ${test.variantATrials}, ${nameB} succeeded ${test.variantBSuccesses} of ${test.variantBTrials}.`;
    return {
      winnerSlot: null,
      concluded: false,
      headline: totalTrials === 0 ? 'No results yet' : 'Too early to call',
      detail,
      why: 'Run both wordings a few more times to see a clear winner.',
      confidenceNote: plainConfidence(0),
    };
  }

  // We have a leader (concluded winner, or a running front-runner).
  const slot: 'A' | 'B' = winnerSlot ?? (rateA >= rateB ? 'A' : 'B');
  const winnerName = slot === 'A' ? nameA : nameB;
  const loserName = slot === 'A' ? nameB : nameA;
  const winSucc = slot === 'A' ? test.variantASuccesses : test.variantBSuccesses;
  const winTrials = slot === 'A' ? test.variantATrials : test.variantBTrials;
  const winRate = slot === 'A' ? rateA : rateB;
  const loseRate = slot === 'A' ? rateB : rateA;
  const winEvidence = slot === 'A' ? verdict.trialsA : verdict.trialsB;
  const loseEvidence = slot === 'A' ? verdict.trialsB : verdict.trialsA;
  const winAvg = slot === 'A'
    ? avgMs(test.variantATotalDurationMs, test.variantATrials)
    : avgMs(test.variantBTotalDurationMs, test.variantBTrials);
  const loseAvg = slot === 'A'
    ? avgMs(test.variantBTotalDurationMs, test.variantBTrials)
    : avgMs(test.variantATotalDurationMs, test.variantATrials);

  const headline = concluded ? `${winnerName} wins` : `${winnerName} is ahead`;

  // A recorded winner the current evidence now clearly disfavours (e.g. crowned
  // on a self-report before the judges scored both arms) is stated as such —
  // never as "the winner, at a lower rate than the loser".
  if (loseRate - winRate >= TIE_MARGIN) {
    const evidence = judged ? "the judges' verdicts" : 'the recorded runs';
    return {
      winnerSlot: slot,
      concluded,
      headline,
      detail: `${winnerName} was picked, but ${evidence} now favour ${loserName}: ${pct(loseRate)}% vs ${pct(winRate)}%.`,
      why: 'The evidence has changed since this test was decided — consider running it again.',
      confidenceNote: plainConfidence(test.confidence),
    };
  }

  const detail = judged
    ? `The judges passed its work ${pct(winRate)}% of the time over ${winEvidence} verdicts, compared with ${pct(loseRate)}% for ${loserName} over ${loseEvidence} verdicts.`
    : `It succeeded ${winSucc} of ${winTrials} times (${pct(winRate)}%), compared with ${pct(loseRate)}% for ${loserName}.`;

  // "Why this won" mirrors the engine's decision rule (verdict.ts decideWinner):
  // a clear rate gap wins on results; a near-tie is broken by whichever finished faster.
  let why: string;
  if (Math.abs(winRate - loseRate) >= TIE_MARGIN) {
    why = judged
      ? `The judges passed ${winnerName}'s work more often than ${loserName}'s.`
      : `${winnerName} finished the task successfully more often than ${loserName}.`;
  } else if (winAvg < loseAvg) {
    why = `Both succeeded about equally often, but ${winnerName} finished faster on average.`;
  } else {
    why = `${winnerName} matched ${loserName} on success and was no slower.`;
  }

  return {
    winnerSlot: slot,
    concluded,
    headline,
    detail,
    why,
    confidenceNote: plainConfidence(test.confidence),
  };
}

/**
 * One-sentence plain summary of a prompt cluster ("Prompts about X worked Y% of
 * the time across N runs.").
 */
export function plainClusterSummary(cluster: PromptCluster): string {
  const topic = cluster.keywords.slice(0, 3).join(', ') || cluster.label || 'these prompts';
  const runs = cluster.sessionIds.length;
  return `Prompts about “${topic}” worked ${pct(cluster.successRate)}% of the time across ${runs} run${runs === 1 ? '' : 's'}.`;
}

/** Plain band label for a 0–1 success rate. */
export function plainSuccessBand(rate: number): string {
  if (rate >= 0.7) return 'works well';
  if (rate >= 0.4) return 'mixed results';
  return 'often fails';
}
