'use client';

import { useMemo } from 'react';
import { aggregateWarnings, type BuildParseResult } from '@/components/cli/UE5BuildParser';
import { ErrorCard } from '@/components/cli/ErrorCard';
import { WarningAggregator } from '@/components/cli/WarningAggregator';
import { BuildSummaryCard, BuildLedgerRow } from '@/components/cli/BuildSummaryCard';
import { diffBuildErrors, buildFixAllPrompt } from '@/components/cli/buildLedger';

/**
 * The ONE build block of the terminal (single log rows and tool-pair rows both
 * render it): per-error cards, grouped warnings, the build summary, and the
 * ledger row — fixed / new / remaining against the previous build of the
 * session plus a single 'Fix all N' that sends every standing error in one run.
 */
export function BuildBlock({ parsed, prev, onFix, isRunning = false }: {
  parsed: BuildParseResult;
  /** The build parsed before this one in the session (buildLedger.previousBuild); null for the first. */
  prev: BuildParseResult | null;
  onFix?: (prompt: string) => void;
  isRunning?: boolean;
}) {
  const errors = useMemo(() => parsed.diagnostics.filter((d) => d.severity === 'error'), [parsed]);
  const warningGroups = useMemo(() => aggregateWarnings(parsed.diagnostics), [parsed]);
  const delta = useMemo(
    () => diffBuildErrors(prev ? prev.diagnostics : null, parsed.diagnostics),
    [prev, parsed],
  );
  const standing = useMemo(() => [...delta.remaining, ...delta.introduced], [delta]);
  const fixAll = onFix ? () => {
    const prompt = buildFixAllPrompt(standing);
    if (prompt) onFix(prompt);
  } : undefined;
  const ledger = {
    delta: prev ? delta : null,
    fixAllCount: standing.length,
    onFixAll: fixAll,
    isRunning,
  };

  return (
    <>
      {errors.map((d) => (
        <ErrorCard key={d.id} diagnostic={d} onFix={onFix} isRunning={isRunning} />
      ))}
      {warningGroups.length > 0 && (
        <WarningAggregator groups={warningGroups} onFix={onFix} isRunning={isRunning} />
      )}
      {parsed.summary ? (
        <BuildSummaryCard summary={parsed.summary} {...ledger} />
      ) : (ledger.delta || (fixAll && standing.length > 0)) ? (
        // Build output without a 'Build SUCCEEDED/FAILED' line: no summary to
        // claim, but the ledger and Fix all still apply.
        <div className="mx-2 my-1 rounded border border-border overflow-hidden">
          <BuildLedgerRow {...ledger} />
        </div>
      ) : null}
    </>
  );
}
