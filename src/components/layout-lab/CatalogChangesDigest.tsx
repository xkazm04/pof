'use client';

import { useState } from 'react';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { describeChangeRow, describeChanges, describeSince } from './labCatalogChanges';
import type { CatalogChangesState } from './hooks/useCatalogChanges';
import type { LabTheme } from './theme';

interface Props {
  t: LabTheme;
  state: CatalogChangesState;
  /** The catalog's step list — used ONLY to resolve a jump index (never to invent one). */
  steps: string[];
  /** entityId → display name, for rows the board knows. */
  nameOf: (entityId: string) => string | undefined;
  onOpenStep: (entityId: string, stepIdx: number) => void;
  /** Re-issue the read after a failure. */
  onRetry: () => void;
}

/** Rows shown before the list is collapsed behind a count. */
const MAX_ROWS = 8;

/**
 * "What moved since I was last here" for the open catalog.
 *
 * PoF is worked by parallel sessions, headless drains and MCP writers, so the first honest
 * question on opening a board is not what is red but what MOVED. Every ingredient was already
 * on disk — `pipeline_artifacts.updated_at` and the archived versions in
 * `pipeline_artifact_revisions` — and none of them were joined.
 *
 * It reports only what the store recorded. A row says "content changed" solely when versions
 * were ARCHIVED since the baseline (an archive happens only on a real content change), and
 * says "written since" otherwise, because a verdict-only write archives nothing and is
 * indistinguishable from a first write. The history is capped, so a step at the cap says its
 * count is a floor — under-reporting silently would defeat the whole point.
 */
export function CatalogChangesDigest({ t, state, steps, nameOf, onOpenStep, onRetry }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (state.kind === 'no-baseline') {
    return (
      <Shell t={t}>
        <span data-testid="changes-no-baseline">
          No baseline yet for this catalog — this visit becomes the one the next digest compares against.
        </span>
      </Shell>
    );
  }
  if (state.kind === 'loading') {
    return <Shell t={t}><span data-testid="changes-loading">Reading what moved…</span></Shell>;
  }
  if (state.kind === 'error') {
    return (
      <Shell t={t}>
        <div data-testid="changes-error" style={{ maxWidth: 620 }}>
          <InlineErrorRetry dense onRetry={onRetry}
            message={`Couldn't read what moved — this is unknown, not "nothing": ${state.error}`} />
        </div>
      </Shell>
    );
  }

  const { changes } = state;
  const shown = expanded ? changes.rows : changes.rows.slice(0, MAX_ROWS);
  const beyond = changes.rows.length - shown.length;

  return (
    <Shell t={t}>
      <span data-testid="changes-headline" style={{ color: changes.rows.length ? t.ink : t.muted }}>
        {describeChanges(changes)}
      </span>
      {changes.rows.length > 0 && (
        <ul data-testid="changes-list" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map((row) => {
            const idx = steps.indexOf(row.step);
            const label = `${nameOf(row.entityId) ?? row.entityId} · ${row.step}`;
            const detail = describeChangeRow(row, changes.cap);
            return (
              <li key={`${row.entityId}::${row.step}`} data-testid={`changes-row-${row.entityId}::${row.step}`}>
                {idx >= 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenStep(row.entityId, idx)}
                    className={`focus-ring ${t.fontMono}`}
                    style={{
                      display: 'block', textAlign: 'left', width: '100%', padding: 0,
                      background: 'transparent', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 12,
                    }}
                  >
                    <span style={{ color: t.inkDeep, fontWeight: 600 }}>{label}</span>{` — ${detail}`}
                  </button>
                ) : (
                  // A step the current pipeline no longer lists: report it, but never fabricate
                  // an index to jump to.
                  <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>
                    <span style={{ color: t.inkDeep, fontWeight: 600 }}>{label}</span>
                    {` — ${detail} (this step is not in the catalog's current pipeline)`}
                  </span>
                )}
              </li>
            );
          })}
          {(beyond > 0 || expanded) && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                data-testid="changes-toggle"
                className={`focus-ring ${t.fontMono}`}
                style={{
                  fontSize: 12, padding: '2px 6px', background: 'transparent',
                  border: `1px dashed ${t.line}`, borderRadius: 4, color: t.muted, cursor: 'pointer',
                }}
              >
                {expanded ? `Show ${MAX_ROWS} only` : `Show all ${changes.rows.length} (${beyond} more)`}
              </button>
            </li>
          )}
        </ul>
      )}
      {/* The store's own blind spots, stated once — not per row, and never omitted. */}
      <span data-testid="changes-blind-spot" style={{ color: t.warn, fontSize: 12 }}>
        {blindSpotNote(changes.truncated, changes.cap)}
        {` Baseline: ${describeSince(changes.since)}.`}
      </span>
    </Shell>
  );
}

/** What this digest cannot see, said out loud. */
function blindSpotNote(truncated: number, cap: number): string {
  const base = 'Only content changes are archived, so a verdict-only write shows as “written since”.';
  return truncated > 0
    ? `${base} ${truncated} step${truncated === 1 ? ' has' : 's have'} hit the ${cap}-version cap — their counts are floors, and older changes are gone.`
    : base;
}

function Shell({ t, children }: { t: LabTheme; children: React.ReactNode }) {
  return (
    <div
      data-testid="catalog-changes-digest"
      className={t.fontMono}
      style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        padding: '10px 28px', borderBottom: `1px solid ${t.line}`,
        fontSize: 12, color: t.muted,
      }}
    >
      {children}
    </div>
  );
}
