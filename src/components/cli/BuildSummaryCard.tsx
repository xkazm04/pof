'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, AlertCircle, Zap,
} from 'lucide-react';
import type { BuildSummary } from './UE5BuildParser';
import type { BuildErrorDelta } from '@/components/cli/buildLedger';
import { STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, CLI_COLORS } from '@/lib/chart-colors';

export interface BuildLedgerRowProps {
  /** Errors fixed / new / remaining since the previous build; null on the session's first build. */
  delta?: BuildErrorDelta | null;
  /** Distinct errors still standing in this build (what 'Fix all' sends). */
  fixAllCount?: number;
  /** Dispatch ONE run for every error still standing. */
  onFixAll?: () => void;
  isRunning?: boolean;
}

interface BuildSummaryCardProps extends BuildLedgerRowProps {
  summary: BuildSummary;
}

/**
 * What changed since the previous build of the session plus a single 'Fix all N'.
 * Counts come from two parsed builds (buildLedger.diffBuildErrors), never from
 * what a CLI run claims it fixed. Renders nothing when there is neither.
 */
export function BuildLedgerRow({ delta = null, fixAllCount = 0, onFixAll, isRunning = false }: BuildLedgerRowProps) {
  const canFix = !!onFixAll && fixAllCount > 0;
  if (!delta && !canFix) return null;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 border-t border-border/50 text-xs">
      {delta && (
        <span role="group" aria-label="Errors since the previous build" className="flex items-center gap-1.5 flex-wrap">
          <span style={{ color: delta.fixed.length > 0 ? STATUS_SUCCESS : undefined }}>{delta.fixed.length} fixed</span>
          <span className="text-text-muted" aria-hidden="true">·</span>
          <span style={{ color: delta.introduced.length > 0 ? STATUS_ERROR : undefined }}>{delta.introduced.length} new</span>
          <span className="text-text-muted" aria-hidden="true">·</span>
          <span style={{ color: delta.remaining.length > 0 ? STATUS_WARNING : undefined }}>{delta.remaining.length} remaining</span>
          <span className="text-2xs text-text-muted">since previous build</span>
        </span>
      )}
      {canFix && (
        <button
          type="button"
          onClick={() => { if (!isRunning) onFixAll?.(); }}
          disabled={isRunning}
          title={isRunning ? 'Wait for the current task to finish' : 'Ask Claude to fix every error of this build in one run'}
          className={`ml-auto flex items-center gap-1 font-medium ${CLI_COLORS.prompt} hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-blue-400 disabled:hover:bg-blue-500/10`}
        >
          <Zap className="w-3 h-3" aria-hidden="true" />
          Fix all {fixAllCount}
        </button>
      )}
    </div>
  );
}

export function BuildSummaryCard({ summary, ...ledger }: BuildSummaryCardProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isSuccess = summary.success;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-2 my-1 rounded border overflow-hidden ${
        isSuccess
          ? 'border-green-500/30 bg-green-500/[0.05]'
          : 'border-status-red-strong bg-red-500/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {/* Status icon */}
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
        ) : (
          <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_ERROR }} />
        )}

        {/* Build result */}
        <span className="text-xs font-semibold" style={{ color: isSuccess ? STATUS_SUCCESS : STATUS_ERROR }}>
          Build {isSuccess ? 'Succeeded' : 'Failed'}
        </span>

        {/* Counts */}
        <div className="flex items-center gap-2 ml-auto">
          {summary.errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs" style={{ color: STATUS_ERROR }}>
              <AlertCircle className="w-2.5 h-2.5" />
              {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.warningCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs" style={{ color: STATUS_WARNING }}>
              <AlertTriangle className="w-2.5 h-2.5" />
              {summary.warningCount} warning{summary.warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.duration && (
            <span className="flex items-center gap-0.5 text-xs text-text-muted">
              <Clock className="w-2.5 h-2.5" />
              {summary.duration}
            </span>
          )}
        </div>
      </div>
      <BuildLedgerRow {...ledger} />
    </motion.div>
  );
}
