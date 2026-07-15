'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { StatusTag } from '@/components/ui/StatusTag';
import { statusBg, statusBorder, STATUS_WARNING } from '@/lib/chart-colors';
import { tryApiFetch } from '@/lib/api-utils';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { aggregateJudgeByModule, detectJudgeDiscrepancies } from '@/lib/evaluator/combined-health';

/**
 * Truth-surfacing badge on the Quality tab: where a module's feature-matrix quality reads
 * healthy but the AI content judges failed its produced content, the two signals disagree and
 * the green scoreboard is lying. This banner names those modules with a plain-language reason,
 * using the colorblind-safe StatusTag (not hue alone). Read-only; renders nothing when the
 * signals agree (or there are no verdicts) — so it never adds noise on the daily path.
 */
export function QualityDiscrepancyBanner({
  cells,
}: {
  cells: Array<{ moduleId: string; label: string; avgQuality: number | null }>;
}) {
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await tryApiFetch<JudgeVerdict[]>('/api/judge-verdicts');
      if (res.ok) setVerdicts(res.data);
    } finally { /* silent — the banner is additive, absence is fine */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flags = useMemo(() => {
    if (verdicts.length === 0) return [];
    return detectJudgeDiscrepancies(cells, aggregateJudgeByModule(verdicts));
  }, [cells, verdicts]);

  if (flags.length === 0) return null;

  return (
    <section
      className="rounded-lg border p-3 space-y-2"
      style={{ borderColor: statusBorder(STATUS_WARNING), backgroundColor: statusBg(STATUS_WARNING) }}
      data-testid="quality-discrepancy-banner"
      aria-label="Health and content-judge disagreement"
    >
      <div className="flex items-center gap-2">
        <StatusTag level="warn" word="SIGNALS DISAGREE" />
        <span className="text-xs text-text-muted">
          {flags.length} module{flags.length === 1 ? '' : 's'} read healthy on the matrix but the content judges disagree.
        </span>
      </div>
      <ul className="space-y-1.5">
        {flags.map((f) => (
          <li key={f.moduleId} className="flex items-start gap-2 text-sm">
            <StatusTag level="bad" word={`${f.judgedContent}`} iconClassName="w-2.5 h-2.5" />
            <span className="min-w-0">
              <span className="text-text font-medium">{f.label}</span>
              <span className="text-text-muted"> — {f.reason}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
