'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, ArrowRight, Eye, GitCompareArrows } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { StatusTag } from '@/components/ui/StatusTag';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, STATUS_WARNING } from '@/lib/chart-colors';
import type { CrashDiagnosis, DiagnosisSignatureMatch } from '@/types/crash-analyzer';

/**
 * The provenance banner for an analysis that was written for a DIFFERENT crash
 * and transferred here by signature matching.
 *
 * Everything below this banner — root cause, fix, prompt, line numbers — is text
 * about `sourceCrashId`, not about the crash on screen. Without the banner a
 * transferred analysis is indistinguishable from a hand-verified one, which is
 * the exact overclaim the no-diagnosis notice exists to prevent; a fuzzy match
 * silently wearing that card would just move the lie one step earlier.
 */
function MatchProvenance({ match }: { match: DiagnosisSignatureMatch }) {
  const strong = match.strength === 'strong';
  return (
    <div
      data-testid="diagnosis-match-provenance"
      className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusTag
          level={strong ? 'ok' : 'warn'}
          word={strong ? 'SIGNATURE MATCH' : 'WEAK SIGNATURE MATCH'}
        />
        <MicroLabel tone="muted" mono>
          similarity {match.similarity.toFixed(2)}
        </MicroLabel>
      </div>
      <p className="text-xs text-text leading-relaxed">
        This analysis was written for <span className="font-mono">{match.sourceCrashId}</span>, not
        for this crash. PoF attached it because the two crashes have a similar shape — nothing below
        was authored about the crash on screen.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <MicroLabel tone="muted" uppercase as="p">What matches</MicroLabel>
          <ul className="mt-0.5 space-y-0.5">
            {match.agreements.map((a) => (
              <li key={a} className="text-xs text-text leading-relaxed">{a}</li>
            ))}
          </ul>
        </div>
        <div>
          <MicroLabel tone="muted" uppercase as="p">What differs</MicroLabel>
          {match.differences.length === 0 ? (
            <p className="mt-0.5 text-xs text-text-muted">nothing compared came out different</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {match.differences.map((d) => (
                <li key={d} className="text-xs text-text leading-relaxed">{d}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiDiagnosisCard({ diagnosis }: { diagnosis: CrashDiagnosis }) {
  // A transferred analysis and a hand-written one carry two different kinds of
  // number in `confidence`; the card must not render them identically.
  const match = diagnosis.match;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopyPrompt = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(diagnosis.fixPrompt);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch {
      // Insecure origin, denied permission, or unsupported API — surface it
      // instead of showing a false "Copied!" success.
      setCopied(false);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), UI_TIMEOUTS.copyFeedback);
    }
  }, [diagnosis]);

  return (
    <SurfaceCard>
      <h3 className="text-xs font-semibold text-text mb-1 flex items-center gap-1.5">
        {match ? (
          <GitCompareArrows className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
        )}
        {match ? 'Matched Root Cause Analysis' : 'AI Root Cause Analysis'}
        <ProgressRing
          value={Math.round(diagnosis.confidence * 100)}
          size={20}
          strokeWidth={2}
          color={match ? STATUS_WARNING : ACCENT_EMERALD}
        />
      </h3>
      {/* The ring shows a percentage either way, so the caption has to say WHICH
          kind of number it is — a human judgement about this crash, or a score
          derived from how alike two crashes are. */}
      <MicroLabel tone="muted" as="p" className="mb-2">
        {match
          ? `computed confidence — ${match.sourceCrashId} analyst confidence × ${match.similarity.toFixed(2)} signature similarity`
          : 'analyst confidence — hand-written for this crash'}
      </MicroLabel>

      <div className="space-y-3">
        {match && <MatchProvenance match={match} />}
        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Summary</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.summary} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Root Cause</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.rootCause} /></p>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">UE5 Pattern</p>
          <Badge variant="warning">{diagnosis.uePattern}</Badge>
        </div>

        <div>
          <p className="text-2xs font-medium text-text mb-0.5">Fix Description</p>
          <p className="text-2xs text-text-muted"><DecoratedCrashText text={diagnosis.fixDescription} /></p>
        </div>

        {/* Fix prompt */}
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-2xs font-medium text-emerald-400 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> One-Click Fix Prompt
            </p>
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className={`w-3 h-3 ${copyFailed ? 'text-red-400' : ''}`} />}
              {copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy'}
            </button>
          </div>
          {/* The prompt names concrete files and line numbers — for the crash it
              was WRITTEN for. On a transferred analysis those references are a
              lead, not a location, and handing them over unqualified would be
              the most expensive form of this overclaim. */}
          {match && (
            <MicroLabel tone="muted" as="p" className="mb-1.5">
              Written for {match.sourceCrashId} — verify its file and line references against this
              crash before running it.
            </MicroLabel>
          )}
          <pre className="text-xs leading-relaxed text-emerald-300/80 whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
            {diagnosis.fixPrompt}
          </pre>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {diagnosis.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-surface-2 text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
