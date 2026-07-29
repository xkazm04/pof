'use client';

import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';
import { Modal } from '@/components/ui/Modal';
import { MeterBar } from '@/components/ui/MeterBar';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DimensionScoreBars } from '@/components/ui/DimensionScoreBars';
import { qualityColor } from '@/lib/chart-colors';
import { RUBRIC_VERSION } from '@/lib/judge/rubrics';
import { VERDICT_STANDING_CHIP, VERDICT_STANDING_NOTE, rubricStanding } from '@/lib/judge/verdictStanding';
import type { ViewVerdict } from './verdictRollup';

const JUDGE_LABEL: Record<JudgeVerdict['judge'], string> = {
  'llm-panel': 'LLM panel',
  vlm: 'Vision (VLM)',
  human: 'Human',
};

/** Full-detail view of one content-judge verdict — EvidenceModal-grade findings, reusing the
 *  shared Modal / MeterBar / StatusTag primitives (evaluator theme).
 *
 *  It also states the verdict's STANDING: which rubric it was scored under versus the current
 *  one, and the content binding (`contentHash` + provenance) behind it. The modal used to print
 *  `rubric v2` with nothing to compare it to, and never mentioned the binding at all — so a
 *  verdict about content that no longer exists read exactly like one that still applies. */
export function VerdictDetailModal({ verdict, onClose }: { verdict: ViewVerdict; onClose: () => void }) {
  const level = verdict.verdict === 'pass' ? 'ok' : 'bad';
  const chip = verdict.provenance ? VERDICT_STANDING_CHIP[verdict.provenance] : undefined;
  const superseded = rubricStanding(verdict);

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
          {chip && <StatusTag level={chip.level === 'ok' ? 'ok' : 'warn'} word={chip.word} />}
        </div>

        <MeterBar value={verdict.score} color={qualityColor} height={8} ariaLabel={`Score ${verdict.score} of 100`} valueText={`${verdict.score} of 100`} />

        <p className="text-2xs text-text-muted font-mono">
          {verdict.model}{verdict.effort ? ` · effort ${verdict.effort}` : ''}
          {verdict.rubricVersion != null ? ` · rubric v${verdict.rubricVersion} (current v${RUBRIC_VERSION})` : ''}
          {verdict.judgedAt ? ` · ${verdict.judgedAt}` : ''}
        </p>

        <section className="space-y-1" data-testid="verdict-standing">
          <h3 className="text-2xs uppercase tracking-wider text-text-muted font-medium">Standing</h3>
          {verdict.provenance && <p><MicroLabel tone="muted">{VERDICT_STANDING_NOTE[verdict.provenance]}</MicroLabel></p>}
          {superseded && <p><MicroLabel tone="muted">{superseded}.</MicroLabel></p>}
          <p>
            <MicroLabel mono>
              {verdict.contentHash ? `content binding ${verdict.contentHash}` : 'no content binding recorded'}
            </MicroLabel>
          </p>
        </section>

        {verdict.dimensions && <DimensionScoreBars dimensions={verdict.dimensions} />}

        <section className="space-y-1">
          <h3 className="text-2xs uppercase tracking-wider text-text-muted font-medium">Findings</h3>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap break-words">{verdict.findings}</p>
        </section>
      </div>
    </Modal>
  );
}
