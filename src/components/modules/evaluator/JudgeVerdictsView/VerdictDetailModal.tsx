'use client';

import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { Modal } from '@/components/ui/Modal';
import { MeterBar } from '@/components/ui/MeterBar';
import { StatusTag } from '@/components/ui/StatusTag';
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { qualityColor } from '@/lib/chart-colors';

const JUDGE_LABEL: Record<JudgeVerdict['judge'], string> = {
  'llm-panel': 'LLM panel',
  vlm: 'Vision (VLM)',
  human: 'Human',
};

/** Full-detail view of one content-judge verdict — EvidenceModal-grade findings, reusing the
 *  shared Modal / MeterBar / StatusTag primitives (evaluator theme). */
export function VerdictDetailModal({ verdict, onClose }: { verdict: JudgeVerdict; onClose: () => void }) {
  const level = verdict.verdict === 'pass' ? 'ok' : 'bad';

  return (
    <Modal open onClose={onClose} label={`Verdict for ${verdict.catalogId} ${verdict.step}`} className="max-w-2xl">
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs text-text-muted font-mono">{verdict.catalogId} · {verdict.entityId}</p>
          <h2 className="text-sm font-semibold text-text">{verdict.step}</h2>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <StatusTag level={level} word={verdict.verdict === 'pass' ? 'PASS' : 'FAIL'} />
          <span className="text-lg font-semibold tabular-nums" style={{ color: qualityColor(verdict.score) }}>
            {verdict.score}<span className="text-xs text-text-muted font-normal">/100</span>
          </span>
          <span className="text-2xs uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded bg-surface-hover">
            {JUDGE_LABEL[verdict.judge]}
          </span>
        </div>

        <MeterBar value={verdict.score} color={qualityColor} height={8} ariaLabel={`Score ${verdict.score} of 100`} valueText={`${verdict.score} of 100`} />

        <p className="text-2xs text-text-muted font-mono">
          {verdict.model}{verdict.effort ? ` · effort ${verdict.effort}` : ''}{verdict.rubricVersion != null ? ` · rubric v${verdict.rubricVersion}` : ''}
          {verdict.judgedAt ? ` · ${verdict.judgedAt}` : ''}
        </p>

        {verdict.dimensions && <DimensionScoreBars dimensions={verdict.dimensions} />}

        <section className="space-y-1">
          <h3 className="text-2xs uppercase tracking-wider text-text-muted font-medium">Findings</h3>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">{verdict.findings}</p>
        </section>
      </div>
    </Modal>
  );
}
