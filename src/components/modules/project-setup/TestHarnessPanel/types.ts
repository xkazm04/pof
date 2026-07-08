import type { PofTestSpec, PofTestResult, PofSnapshotDiffReport } from '@/types/pof-bridge';

// ── Suite types ──────────────────────────────────────────────────────────────

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  scenarios: PofTestSpec[];
  snapshotPresets: string[];
  createdAt: number;
}

export interface SuiteRunResult {
  suiteId: string;
  suiteName: string;
  startedAt: number;
  finishedAt: number;
  testResults: PofTestResult[];
  snapshotReport: PofSnapshotDiffReport | null;
  status: 'passed' | 'failed' | 'partial' | 'error';
}
