import { useCallback } from 'react';
import {
  ChevronDown, ChevronRight, CheckCircle2, Clock, Trophy,
  Target, Copy, FlaskConical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { StatTerm } from '@/components/ui/StatTerm';
import type { PromptVariant, ABTest, ABTestView, ABTestVerdict } from '@/types/prompt-evolution';
import { explainTestVerdict, type PlainVerdict } from '@/lib/prompt-evolution/plain-language';
import { verdictOf } from '@/lib/prompt-evolution/verdict';
import { STATUS_WARNING, STATUS_SUCCESS, STATUS_NEUTRAL } from '@/lib/chart-colors';
import { toast } from 'sonner';
import { ACCENT, STATUS_COLORS, type ViewMode } from './constants';

// ── A/B Test Card ───────────────────────────────────────────────────────────

export function ABTestCard({
  test,
  variantA,
  variantB,
  isExpanded,
  onToggle,
  onConclude,
  concludeRefusal,
  mode,
}: {
  test: ABTest | ABTestView;
  variantA?: PromptVariant;
  variantB?: PromptVariant;
  isExpanded: boolean;
  onToggle: () => void;
  onConclude?: () => void;
  /** Why the last decide-now press was refused, shown next to the test. */
  concludeRefusal?: string;
  mode: ViewMode;
}) {
  // The ONE reading (verdict.ts): the server's when it sent one, else self-reported.
  const reading = verdictOf(test);
  const totalTrials = test.variantATrials + test.variantBTrials;
  const statusColor = STATUS_COLORS[test.status];

  // Plain-language verdict — the single human-readable answer.
  const verdict = explainTestVerdict(test, variantA?.label, variantB?.label, reading);
  const winnerVariant = verdict.winnerSlot === 'A' ? variantA : verdict.winnerSlot === 'B' ? variantB : undefined;

  const handleUseWording = useCallback(async () => {
    if (!winnerVariant) return;
    await navigator.clipboard.writeText(winnerVariant.prompt);
    toast.success(`Copied “${winnerVariant.label}” to clipboard`);
  }, [winnerVariant]);

  const plainStatus = test.status === 'concluded' ? 'Decided' : test.status === 'running' ? 'Testing' : 'Stopped';

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-surface/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <FlaskConical className="w-3.5 h-3.5" style={{ color: statusColor }} />
        <span className="text-xs font-medium text-text flex-1">{test.checklistItemId}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border" style={{ borderColor: statusColor, color: statusColor }}>
          {mode === 'simple' ? plainStatus : test.status}
        </span>
        <span className="text-xs text-text-muted">
          {totalTrials} {mode === 'simple' ? `run${totalTrials === 1 ? '' : 's'}` : 'trials'}
        </span>
        {test.winnerId && (
          <Trophy className="w-3 h-3 text-yellow-500" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border/30">
              {/* Plain-language verdict — shown in BOTH modes (the headline answer) */}
              <PlainVerdictBanner
                verdict={verdict}
                canUseWording={Boolean(winnerVariant)}
                onUseWording={handleUseWording}
              />
              <VerdictBasisLine reading={reading} mode={mode} />

              {/* Advanced-only statistical breakdown */}
              {mode === 'advanced' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <VariantSlotCard
                      label="Variant A"
                      variant={variantA}
                      trials={test.variantATrials}
                      successes={test.variantASuccesses}
                      totalDurationMs={test.variantATotalDurationMs}
                      rate={reading.rateA}
                      judgedVerdicts={reading.basis === 'judge' ? reading.trialsA : null}
                      isWinner={test.winnerId === test.variantAId}
                    />
                    <VariantSlotCard
                      label="Variant B"
                      variant={variantB}
                      trials={test.variantBTrials}
                      successes={test.variantBSuccesses}
                      totalDurationMs={test.variantBTotalDurationMs}
                      rate={reading.rateB}
                      judgedVerdicts={reading.basis === 'judge' ? reading.trialsB : null}
                      isWinner={test.winnerId === test.variantBId}
                    />
                  </div>

                  {/* Raw confidence (jargon tooltipped) */}
                  {test.confidence > 0 && (
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Target className="w-3 h-3" />
                      <span>
                        <StatTerm term="confidence">Confidence</StatTerm>: {Math.round(test.confidence * 100)}%{' '}
                        <span className="text-text-muted/70">
                          (<StatTerm term="z-test">z-test</StatTerm>)
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Conclude button — offered only when the server's per-arm floor is met */}
              {test.status === 'running' && !reading.canConclude && (
                <p className="text-xs text-text-muted" data-testid="conclude-shortfall">
                  {shortfallText(reading.shortfall)}
                </p>
              )}
              {concludeRefusal && (
                <p className="text-xs text-text-muted" role="status" data-testid="conclude-refusal">
                  {concludeRefusal}
                </p>
              )}
              {test.status === 'running' && onConclude && reading.canConclude && (
                <button
                  onClick={onConclude}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors focus-ring"
                  style={{ backgroundColor: ACCENT }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {mode === 'simple' ? 'Finish & pick a winner' : 'Conclude Test'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/** "Needs 1 more run of A and 2 more runs of B before a winner can be picked." */
function shortfallText(shortfall: ABTestVerdict['shortfall']): string {
  const parts = (['A', 'B'] as const)
    .filter((slot) => shortfall[slot] > 0)
    .map((slot) => `${shortfall[slot]} more run${shortfall[slot] === 1 ? '' : 's'} of ${slot}`);
  return `Needs ${parts.join(' and ')} before a winner can be picked.`;
}

/**
 * What the verdict rests on — a score without its basis is not a measurement.
 * The band is the z-test band of the evidence as it stands NOW (read time), which
 * can differ from the confidence stored when the test was decided.
 */
function VerdictBasisLine({ reading, mode }: { reading: ABTestVerdict; mode: ViewMode }) {
  const basis = reading.basis === 'judge' ? 'judge verdicts' : 'self-reported run results';
  return (
    <p className="text-2xs text-text-muted" data-testid="verdict-basis" title={reading.note}>
      {mode === 'simple'
        ? `Based on ${basis}.`
        : `Basis: ${basis} (${reading.trialsA} vs ${reading.trialsB}) · current band: ${reading.band}`}
    </p>
  );
}

// ── Plain-language verdict banner ────────────────────────────────────────────

function PlainVerdictBanner({
  verdict,
  canUseWording,
  onUseWording,
}: {
  verdict: PlainVerdict;
  canUseWording: boolean;
  onUseWording: () => void;
}) {
  const hasWinner = verdict.winnerSlot !== null;
  const accent = hasWinner ? STATUS_SUCCESS : STATUS_NEUTRAL;

  return (
    <div
      className="mt-2 rounded-md border bg-surface/40 p-3"
      style={{ borderLeft: `3px solid ${accent}` }}
      data-testid="plain-verdict"
    >
      <div className="flex items-start gap-2">
        {hasWinner ? (
          <Trophy className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
        ) : (
          <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-text-muted" />
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-semibold text-text">{verdict.headline}</p>
          <p className="text-xs text-text-muted leading-relaxed">{verdict.detail}</p>
          <p className="text-xs text-text-muted leading-relaxed">
            <span className="text-text">Why:</span> {verdict.why}
          </p>
          <p className="text-2xs text-text-muted/80">{verdict.confidenceNote}</p>
        </div>
      </div>

      {hasWinner && canUseWording && (
        <div className="mt-2.5">
          <button
            onClick={onUseWording}
            className="focus-ring inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white transition-colors"
            style={{ backgroundColor: STATUS_SUCCESS }}
          >
            <Copy className="w-3 h-3" />
            Use this wording
          </button>
        </div>
      )}
    </div>
  );
}

function VariantSlotCard({
  label,
  variant,
  trials,
  successes,
  totalDurationMs,
  rate,
  judgedVerdicts,
  isWinner,
}: {
  label: string;
  variant?: PromptVariant;
  trials: number;
  successes: number;
  totalDurationMs: number;
  /** The arm's rate on the verdict's basis. */
  rate: number;
  /** Verdict count when the rate is judged; `null` on the self-reported basis. */
  judgedVerdicts: number | null;
  isWinner: boolean;
}) {
  const avgDur = trials > 0 ? Math.round(totalDurationMs / trials / 1000) : 0;

  return (
    <div className={`rounded-md p-2.5 border ${isWinner ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border/50 bg-surface/30'}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-medium text-text">{label}</span>
        {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
      </div>
      {variant && (
        <p className="text-[11px] text-text-muted mb-1.5 truncate">{variant.label}</p>
      )}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-text">
          {Math.round(rate * 100)}%
        </span>
        {judgedVerdicts !== null && (
          <span className="text-text-muted">of {judgedVerdicts} verdicts ·</span>
        )}
        <span className="text-text-muted">
          {successes}/{trials}{judgedVerdicts !== null ? ' runs' : ''}
        </span>
        {avgDur > 0 && (
          <span className="text-text-muted flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {avgDur}s
          </span>
        )}
      </div>
      {/* Rate bar */}
      <div className="mt-1.5 h-1 rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${rate * 100}%`, backgroundColor: isWinner ? STATUS_WARNING : ACCENT }}
        />
      </div>
    </div>
  );
}
