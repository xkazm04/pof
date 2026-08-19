'use client';

import { STATUS_TOKENS } from '@/lib/status-token';
import { StatusTag } from '@/components/ui/StatusTag';
import type { BuildScopeDescription } from './buildScope';

/**
 * Says what the active project's scope let the Builds tab see.
 *
 * Renders nothing when the read hid nothing (`own`). It renders LOUDLY when the tab
 * looks empty only because another project holds the builds — the state that was
 * previously indistinguishable from "you have never built".
 *
 * Presentation only: the four states, the ramp level and the tag word come from
 * `describeBuildScope`, which delegates them to the ONE shared classifier.
 */
export function BuildScopeBanner({ desc }: { desc: BuildScopeDescription | null }) {
  if (!desc || !desc.show) return null;

  const token = STATUS_TOKENS[desc.level];

  return (
    <div
      data-testid="pof-build-history-scope"
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
        {/* What the scoped query actually did — a paraphrase could drift from the
            query, and this panel's whole value is that it cannot. */}
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
