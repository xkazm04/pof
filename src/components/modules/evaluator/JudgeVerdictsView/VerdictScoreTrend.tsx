'use client';

import { useEffect, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { StatusTag } from '@/components/ui/StatusTag';
import { ChartPanel } from '@/components/layout-lab/steps/shared/ChartPanel';
import { qualityColor, STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { buildVerdictTrend, trendPointLabel, trendSummary, VERDICT_HISTORY_LIMIT } from '@/lib/judge/verdictTrend';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import type { LabTheme } from '@/components/layout-lab/theme';

/**
 * The SCORE TREND for one step + judge class — "did my fix actually improve this?".
 *
 * A re-judge used to destroy the record of what the judge previously said (one row per judge
 * class, overwritten), so the modal could render a rich single verdict with nothing to compare it
 * against. It now reads the append-only log via `GET /api/judge-verdicts/history`.
 *
 * Display only: this component never writes, and acceptance still reads exactly one verdict per
 * judge class from `judge_verdicts`. Fetches only when mounted — the modal mounts it, so a closed
 * verdict costs nothing.
 */

/** ChartPanel is themed by a `LabTheme`; this maps it onto the app's own tokens so the bars sit
 *  correctly in the evaluator surface in both themes (CSS vars, never hardcoded colors). */
const TREND_THEME: LabTheme = {
  id: 'dark',
  label: 'evaluator',
  bg: 'var(--surface)',
  gridLine: null,
  panel: 'var(--surface)',
  ink: 'var(--text)',
  inkDeep: 'var(--text)',
  text: 'var(--text-muted)',
  muted: 'var(--text-muted)',
  line: 'var(--border)',
  accentBg: 'var(--surface-hover)',
  glass: false,
  fontBody: '',
  fontMono: 'font-mono',
  ok: STATUS_SUCCESS,
  warn: STATUS_WARNING,
  bad: STATUS_ERROR,
  onAccent: 'var(--text)',
};

const DIRECTION_TAG = {
  improved: { level: 'ok' as const, word: 'IMPROVED' },
  regressed: { level: 'bad' as const, word: 'REGRESSED' },
  unchanged: { level: 'warn' as const, word: 'UNCHANGED' },
};

export function VerdictScoreTrend({ verdict }: { verdict: Pick<JudgeVerdict, 'catalogId' | 'entityId' | 'step' | 'judge'> }) {
  const [history, setHistory] = useState<JudgeVerdict[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({
      catalogId: verdict.catalogId, entityId: verdict.entityId, step: verdict.step, judge: verdict.judge,
    });
    void tryApiFetch<JudgeVerdict[]>(`/api/judge-verdicts/history?${q}`).then((res) => {
      if (!live) return;
      if (res.ok) { setHistory(res.data); setError(null); } else { setError(res.error); setHistory([]); }
    });
    return () => { live = false; };
  }, [verdict.catalogId, verdict.entityId, verdict.step, verdict.judge]);

  const trend = buildVerdictTrend(history ?? []);
  const seen = new Map<string, number>();
  const rows = trend.points.map((p, i) => {
    const base = trendPointLabel(p, i);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      label: n > 1 ? `${base} (${n})` : base,
      value: p.score,
      color: qualityColor(p.score),
      highlight: i === trend.points.length - 1,
    };
  });

  return (
    <section className="space-y-1.5" data-testid="verdict-trend">
      <h3 className="text-2xs uppercase tracking-wider text-text-muted font-medium">Score trend</h3>

      {history === null && <MicroLabel tone="muted">Loading judgment history…</MicroLabel>}
      {error && <MicroLabel tone="muted">Judgment history unavailable: {error}</MicroLabel>}

      {history !== null && !error && (
        <>
          {rows.length >= 2 && (
            <ChartPanel
              variant="bars"
              t={TREND_THEME}
              rows={rows}
              max={100}
              labelWidth={96}
              ariaLabel={`Judge score across ${rows.length} judgments of ${verdict.step}`}
            />
          )}
          <p className="flex flex-wrap items-center gap-2">
            {trend.direction !== 'none' && (
              <StatusTag level={DIRECTION_TAG[trend.direction].level} word={DIRECTION_TAG[trend.direction].word} />
            )}
            <MicroLabel tone="muted">{trendSummary(trend)}</MicroLabel>
          </p>
          {/* A rise that judged the SAME bytes is not evidence a fix worked — say so. */}
          {trend.points.some((p) => p.sameContentAsPrevious === true) && (
            <p><MicroLabel tone="muted">Some re-judges read the same content as the one before them — a change there is judge variance, not a fix.</MicroLabel></p>
          )}
          <p><MicroLabel tone="muted">Keeping the last {VERDICT_HISTORY_LIMIT} judgments per step + judge class; older ones are pruned.</MicroLabel></p>
        </>
      )}
    </section>
  );
}
