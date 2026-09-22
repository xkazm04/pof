/**
 * The delegation ledger — one entry per delegated task, with the overseer's verdict.
 *
 * Its job is to answer, with numbers rather than impressions, the operator's question: *what
 * can Codex do independently, and where does it need more instructions?* A task class whose
 * first-pass acceptance is high can be delegated with a short brief; one that keeps needing
 * follow-up rounds needs a longer brief, a higher tier, or to stay with the overseer. The
 * routing table (`routing.ts`) is a hypothesis; this is the measurement that revises it.
 */

export type CodexVerdict = 'accepted' | 'accepted-after-revision' | 'rejected';

export interface LedgerEntry {
  id: string;
  at: string;
  tier: string;
  /** Free-text task class ('mapping', 'test', 'ui', 'image-review', …) — the unit of calibration. */
  taskClass: string;
  model: string;
  effort: string;
  verdict: CodexVerdict;
  /** 1 = accepted as delivered; each follow-up instruction adds one. */
  rounds: number;
  secs: number;
  outputTokens: number;
  notes: string;
}

export interface LedgerStat {
  key: string;
  n: number;
  /** Accepted with no follow-up — the "independent" rate. */
  firstPass: number;
  accepted: number;
  meanRounds: number;
}

/** Group by `tier · model · taskClass`, most-used first. */
export function summarizeLedger(entries: LedgerEntry[]): LedgerStat[] {
  const groups = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const key = `${e.tier} · ${e.model} · ${e.taskClass}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([key, es]) => ({
      key,
      n: es.length,
      firstPass: es.filter((e) => e.verdict === 'accepted' && e.rounds === 1).length / es.length,
      accepted: es.filter((e) => e.verdict !== 'rejected').length / es.length,
      meanRounds: es.reduce((s, e) => s + e.rounds, 0) / es.length,
    }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export function parseLedger(jsonl: string): LedgerEntry[] {
  return jsonl.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as LedgerEntry);
}
