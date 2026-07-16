import {
  ArrowUp,
  Clock,
  FileCode2,
  GitCommitHorizontal,
  Loader2,
  Zap,
} from 'lucide-react';
import { PASS_LABELS } from '@/lib/evaluator/module-eval-prompts';
import type { EvalFinding } from '@/lib/evaluator/finding-collector';
import type { CommitAttribution } from '@/lib/evaluator/git-attribution';
import { STATUS_WARNING, severityAccentCard } from '@/lib/chart-colors';
import { EFFORT_LABELS, EVAL_ACCENT, SEVERITY_CONFIG } from './constants';

// ─── Finding Row ─────────────────────────────────────────────────────────────

export function FindingRow({
  finding,
  status,
  commits,
  onFix,
  isFixRunning,
  isFixTarget = false,
}: {
  finding: EvalFinding;
  /** Regression tag relative to the previous scan (undefined = no baseline yet). */
  status?: 'new' | 'persisting';
  /** Commits that touched this finding's file since the last scan (NEW findings). */
  commits?: CommitAttribution[];
  onFix: () => void;
  isFixRunning: boolean;
  /** True only when THIS finding is the one currently being fixed. */
  isFixTarget?: boolean;
}) {
  const cfg = SEVERITY_CONFIG[finding.severity];
  const SeverityIcon = cfg.icon;

  return (
    <div
      className="rounded-md border border-border border-l-[3px] bg-surface px-3 py-2.5 transition-colors"
      style={severityAccentCard(cfg)}
    >
      <div className="flex items-start gap-2.5">
        <SeverityIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />

        <div className="flex-1 min-w-0">
          {/* Regression status tag */}
          {status === 'new' && (
            <span
              className="inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1.5"
              style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}1a` }}
            >
              <ArrowUp className="w-2.5 h-2.5" />
              New
            </span>
          )}
          {status === 'persisting' && (
            <span className="inline-block text-2xs uppercase tracking-wider text-text-muted mb-1.5">
              Persisting
            </span>
          )}

          {/* Description */}
          <p className="text-xs text-text leading-relaxed mb-1.5">
            {finding.description}
          </p>

          {/* File location */}
          {finding.file && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileCode2 className="w-3 h-3 text-text-muted" />
              <span className="text-xs text-text-muted font-mono">
                {finding.file}{finding.line ? `:${finding.line}` : ''}
              </span>
            </div>
          )}

          {/* Git attribution — which commit(s) introduced this since last scan */}
          {status === 'new' && commits && commits.length > 0 && (
            <div className="flex items-start gap-1.5 mb-1.5">
              <GitCommitHorizontal className="w-3 h-3 text-text-muted mt-0.5 flex-shrink-0" />
              <span className="text-2xs text-text-muted leading-relaxed">
                Introduced in{' '}
                <span className="font-mono text-text-muted-hover">{commits[0].hash}</span>
                {commits[0].subject ? ` — ${commits[0].subject}` : ''}
                {commits.length > 1 ? ` (+${commits.length - 1} more)` : ''}
              </span>
            </div>
          )}

          {/* Suggested fix */}
          {finding.suggestedFix && (
            <div className="bg-background/50 rounded px-2.5 py-1.5 mb-2">
              <span className="text-2xs text-text-muted uppercase tracking-wider font-semibold block mb-0.5">
                Suggested Fix
              </span>
              <p className="text-xs text-text-muted-hover leading-relaxed">
                {finding.suggestedFix}
              </p>
            </div>
          )}

          {/* Footer: severity badge, effort, pass, fix button */}
          <div className="flex items-center gap-2">
            <span
              className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: cfg.color, backgroundColor: cfg.bg }}
            >
              {cfg.label}
            </span>
            <span className="text-2xs text-text-muted flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {EFFORT_LABELS[finding.effort] ?? finding.effort}
            </span>
            <span className="text-2xs text-text-muted">
              {PASS_LABELS[finding.pass]}
            </span>

            <button
              onClick={onFix}
              disabled={isFixRunning}
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: `${EVAL_ACCENT}12`,
                color: EVAL_ACCENT,
                border: `1px solid ${EVAL_ACCENT}25`,
              }}
            >
              {isFixTarget ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Zap className="w-2.5 h-2.5" />
              )}
              Fix
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
