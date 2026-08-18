'use client';

import { StatusTag } from '@/components/ui/StatusTag';
import type { StatusLevel } from '@/lib/status-token';
import type { BalanceReport } from './data';

type CanonCheck = BalanceReport['canonChecks'][number];

const TAG: Record<CanonCheck['status'], { level: StatusLevel; word: string }> = {
  pass: { level: 'ok', word: 'Conforms' },
  violation: { level: 'bad', word: 'Violation' },
  // A law nothing could feed is NOT a pass — it reads as unrun, on purpose.
  'not-evaluated': { level: 'warn', word: 'Not run' },
};

/**
 * Per-law canon conformance for a sweep — one row per ARPG-LAW the combat sim is
 * responsible for, INCLUDING the ones that could not be evaluated. A law that
 * never ran must not read as a silent pass, so it is tagged "Not run" and states
 * the missing input verbatim.
 */
export function CanonChecksPanel({ checks }: { checks: BalanceReport['canonChecks'] }) {
  if (checks.length === 0) {
    return (
      <div className="text-xs text-text-muted font-mono">
        No canon laws were applicable to this run.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {checks.map((c) => {
        const tag = TAG[c.status];
        return (
          <div
            key={c.lawId}
            data-canon-law={c.lawId}
            data-canon-status={c.status}
            className="flex flex-col gap-1 px-2 py-1.5 rounded border border-border/30 bg-surface-deep text-xs font-mono"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <StatusTag level={tag.level} word={tag.word} />
              <span className="text-text font-bold">{c.law}</span>
              <span className="text-text-muted opacity-70">{c.lawId}</span>
              <span className="text-text-muted ml-auto tabular-nums">canon: {c.allowed}</span>
            </div>
            {c.status === 'not-evaluated' ? (
              <div className="text-text-muted">Could not run — {c.reason}</div>
            ) : (
              <div className="text-text-muted tabular-nums">
                {c.metric}: {c.observed !== undefined ? c.observed.toFixed(3) : '—'}
                {c.observedAt ? ` (${c.observedAt})` : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
