import type { PacingFinding, PacingSeverity } from '@/lib/level-design/pacing-linter';
import { SEVERITY_RANK } from './constants';

export function highestSeverity(findings: PacingFinding[]): PacingSeverity | null {
  let best: PacingSeverity | null = null;
  for (const f of findings) {
    if (!best || SEVERITY_RANK[f.severity] > SEVERITY_RANK[best]) best = f.severity;
  }
  return best;
}
