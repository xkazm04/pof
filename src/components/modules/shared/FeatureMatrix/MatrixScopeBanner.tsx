'use client';

import { STATUS_TOKENS } from '@/lib/status-token';
import { StatusTag } from '@/components/ui/StatusTag';
import type { ProjectScopeReport } from '@/lib/feature-matrix-db';
import { describeMatrixScope } from './matrixScope';

/**
 * Says what the active project's scope let this matrix see.
 *
 * Renders nothing when the read hid nothing (`own`) — a banner on a clean module
 * would be noise. It renders LOUDLY when the module looks empty only because
 * another project holds its rows, because that is the state that was previously
 * indistinguishable from "never reviewed".
 *
 * Display only. It offers no way to claim or adopt rows: backfilling attribution is
 * an operator decision made centrally, not something a module view should invite.
 */
export function MatrixScopeBanner({
  scope,
  visibleRows,
}: {
  scope: ProjectScopeReport | null | undefined;
  visibleRows: number;
}) {
  const desc = describeMatrixScope(scope, visibleRows);
  if (!desc || !desc.show) return null;

  const token = STATUS_TOKENS[desc.level];

  return (
    <div
      data-testid="pof-feature-matrix-scope"
      data-scope-state={desc.state}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs"
      style={{
        backgroundColor: token.bg,
        border: `1px solid ${token.border}`,
        borderStyle: token.borderStyle,
      }}
    >
      <StatusTag level={desc.level} word={desc.word} className="flex-shrink-0 mt-px" />
      <div className="min-w-0 space-y-1">
        <p className="text-text leading-relaxed">{desc.headline}</p>
        {/* The report's own sentence, verbatim — a paraphrase could drift from what
            the query actually did, and this panel's whole value is that it cannot. */}
        <details>
          <summary className="cursor-pointer text-2xs text-text-muted hover:text-text transition-colors">
            What this scope saw
          </summary>
          <p className="mt-1 text-2xs text-text-muted leading-relaxed">{desc.note}</p>
        </details>
      </div>
    </div>
  );
}
