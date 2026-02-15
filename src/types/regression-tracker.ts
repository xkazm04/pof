import type { FindingSeverity, FindingCategory, PlaytestFinding, PlaytestSession } from './game-director';

/** Lifecycle of a tracked regression across builds */
export type RegressionStatus = 'open' | 'fixed' | 'regressed' | 'resolved';

/** Fingerprint that uniquely identifies a finding across sessions */
export interface FindingFingerprint {
  id: string;
  /** Hash of category + title-stem + related-module */
  hash: string;
  category: FindingCategory;
  titleStem: string;
  relatedModule: string | null;
  /** First time this fingerprint was observed */
  firstSeenSessionId: string;
  firstSeenAt: string;
  /** Current lifecycle status */
  status: RegressionStatus;
  /** Peak severity across all occurrences */
  peakSeverity: FindingSeverity;
  /** Count of sessions where this appeared */
  occurrenceCount: number;
  /** Count of times it regressed after being fixed */
  regressionCount: number;
}

/** An individual occurrence of a fingerprinted finding in a session */
export interface FingerprintOccurrence {
  fingerprintId: string;
  sessionId: string;
  findingId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  suggestedFix: string;
  confidence: number;
  createdAt: string;
}

/** A regression alert for a finding that reappeared after being fixed */
export interface RegressionAlert {
  id: string;
  fingerprintId: string;
  /** Session where it was last marked fixed */
  fixedInSessionId: string;
  /** Session where it reappeared */
  reappearedInSessionId: string;
  fixedInSessionName: string;
  reappearedInSessionName: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  /** Number of sessions between fix and regression */
  buildGap: number;
  createdAt: string;
  dismissed: boolean;
}

/** Full regression report generated for a session */
export interface RegressionReport {
  sessionId: string;
  sessionName: string;
  generatedAt: string;
  /** New findings not seen before */
  newFindings: FindingFingerprint[];
  /** Findings that reappeared after being fixed */
  regressions: RegressionAlert[];
  /** Findings still present from prior sessions */
  persistent: FindingFingerprint[];
  /** Findings from prior sessions not found here = presumed fixed */
  newlyFixed: FindingFingerprint[];
  /** Summary stats */
  stats: {
    totalTracked: number;
    openCount: number;
    fixedCount: number;
    regressedCount: number;
    resolvedCount: number;
    regressionRate: number;
  };
}
