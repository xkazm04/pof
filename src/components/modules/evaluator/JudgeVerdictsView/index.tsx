'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Gavel, Activity } from 'lucide-react';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { tryApiFetch } from '@/lib/api-utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { FetchError } from '@/components/modules/shared/FetchError';
import { MODULE_COLORS, qualityColor } from '@/lib/chart-colors';
import { VERDICT_STANDING_CHIP } from '@/lib/judge/verdictStanding';
import { rollupVerdictsByCatalog, verdictTotals, countsAsCurrent, type CatalogVerdictGroup, type ViewVerdict } from './verdictRollup';
import { VerdictDetailModal } from './VerdictDetailModal';

const ACCENT = MODULE_COLORS.evaluator;
const JUDGE_LABEL: Record<JudgeVerdict['judge'], string> = { 'llm-panel': 'LLM', vlm: 'VLM', human: 'Human' };

/**
 * Verdicts tab — surfaces the AI content-judge verdicts (the deepest quality signal the project
 * has) inside the Evaluator's Quality group, grouped by catalog. Each verdict opens full,
 * EvidenceModal-grade findings. Read-only: verdicts are POSTed by the judge harness; this view
 * never mutates or re-grades. fail verdicts are visually distinct via the colorblind-safe StatusTag.
 *
 * **Headline counts match acceptance.** They are derived from the STANDING subset only (see
 * `verdictRollup`) — a superseded-rubric fail and a fail bound to content that no longer exists
 * are not current quality, and reporting them as such stated a number the app's own acceptance
 * layer did not hold. Those rows stay VISIBLE (they are evidence), listed after the standing ones
 * and carrying the same `VERDICT: …` provenance vocabulary the lab's `ProvenanceStrip` uses — so
 * the distinction is legible in the list, without opening the modal.
 */
export function JudgeVerdictsView() {
  const [verdicts, setVerdicts] = useState<ViewVerdict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ViewVerdict | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tryApiFetch<ViewVerdict[]>('/api/judge-verdicts');
      if (res.ok) {
        setVerdicts(res.data);
        setError(null);
      } else {
        setError(res.error);
        setVerdicts([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => (verdicts ? rollupVerdictsByCatalog(verdicts) : []), [verdicts]);
  const totals = useMemo(() => (verdicts ? verdictTotals(verdicts) : null), [verdicts]);

  if (verdicts === null) {
    return (
      <div className="flex items-center justify-center py-12" aria-busy={isLoading}>
        <Activity className="w-5 h-5 animate-spin text-text-muted-hover" />
      </div>
    );
  }

  if (error && verdicts.length === 0) {
    return <FetchError message={error} onRetry={load} />;
  }

  if (verdicts.length === 0) {
    return (
      <EmptyState
        icon={Gavel}
        title="No content judgments yet"
        description="The AI content judges (Sonnet LLM-panel / Qwen vision / human) haven't scored any produced content yet. Run the judge harness (scripts/judge-run.ts) over a catalog and its verdicts — pass/fail scores and the reasons behind them — will appear here, grouped by catalog."
        iconColor={ACCENT}
      />
    );
  }

  return (
    <div className="space-y-5" data-testid="judge-verdicts-view">
      {totals && (
        <div className="space-y-1" data-testid="verdict-totals">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Gavel className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-text font-medium">{totals.standing} standing verdicts</span>
            <span className="text-text-muted">·</span>
            <span style={{ color: qualityColor(totals.passCount / Math.max(1, totals.standing) * 100) }}>{totals.passCount} pass</span>
            {totals.failCount > 0 && (
              <>
                <span className="text-text-muted">·</span>
                <StatusTag level="bad" word={`${totals.failCount} FAIL`} />
              </>
            )}
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">avg <span className="tabular-nums" style={{ color: qualityColor(totals.avgScore) }}>{totals.avgScore}</span></span>
          </div>
          {totals.standing < totals.total && (
            <p data-testid="verdict-not-counted">
              <MicroLabel>
                {totals.total} judgments on record · {totals.supersededCount} superseded-rubric
                {' '}· {totals.staleCount} bound to content that no longer exists — kept as evidence, not counted as current quality.
              </MicroLabel>
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => <CatalogGroup key={g.catalogId} group={g} onSelect={setSelected} />)}
      </div>

      {selected && <VerdictDetailModal verdict={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CatalogGroup({ group, onSelect }: { group: CatalogVerdictGroup; onSelect: (v: ViewVerdict) => void }) {
  return (
    <section className="border border-border rounded-lg overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-hover">
        <h3 className="text-sm font-semibold text-text font-mono">{group.catalogId}</h3>
        <div className="flex items-center gap-2 text-2xs text-text-muted">
          <span>{group.standing} standing{group.standing < group.total ? ` of ${group.total}` : ''}</span>
          {group.failCount > 0 && <StatusTag level="bad" word={`${group.failCount} FAIL`} iconClassName="w-2.5 h-2.5" />}
          <span className="tabular-nums" style={{ color: qualityColor(group.avgScore) }}>avg {group.avgScore}</span>
        </div>
      </header>
      <ul className="divide-y divide-border">
        {group.verdicts.map((v) => (
          <li key={`${v.entityId}::${v.step}::${v.judge}`}>
            <VerdictRow verdict={v} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One verdict. A row that does NOT count toward current quality says so in place — the
 * `VERDICT: …` chip is the same vocabulary the lab's `ProvenanceStrip` renders (glyph + word,
 * never hue alone), so the reader never has to open the modal to learn that a red FAIL is about
 * content this step no longer holds.
 */
function VerdictRow({ verdict: v, onSelect }: { verdict: ViewVerdict; onSelect: (v: ViewVerdict) => void }) {
  const standing = countsAsCurrent(v);
  const chip = v.provenance ? VERDICT_STANDING_CHIP[v.provenance] : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect(v)}
      data-testid="verdict-row"
      data-standing={standing ? 'current' : 'not-counted'}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-hover transition-colors focus-ring${standing ? '' : ' bg-surface-hover/40'}`}
    >
      <StatusTag level={v.verdict === 'pass' ? 'ok' : 'bad'} word={v.verdict === 'pass' ? 'PASS' : 'FAIL'} iconClassName="w-2.5 h-2.5" />
      <span className="text-sm font-semibold tabular-nums w-9 shrink-0" style={{ color: qualityColor(v.score) }}>{v.score}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text truncate">{v.step}</span>
        <span className="block truncate">
          <MicroLabel mono>{v.entityId}</MicroLabel>
        </span>
      </span>
      {chip && !standing && (
        <StatusTag
          level={chip.level === 'ok' ? 'ok' : 'warn'}
          word={chip.word}
          iconClassName="w-2.5 h-2.5"
          className="shrink-0"
          style={{ fontSize: 12 }}
        />
      )}
      <MicroLabel uppercase className="shrink-0">{JUDGE_LABEL[v.judge]}</MicroLabel>
    </button>
  );
}
