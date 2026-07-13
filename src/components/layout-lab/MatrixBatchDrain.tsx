'use client';

import type { LabTheme } from './theme';
import { Button } from './ui/Button';
import type { BatchDrainState, BatchEntity } from './hooks/useBatchDrain';

interface Props {
  t: LabTheme;
  /** Entities in this catalog that currently have ≥1 deferred gate. */
  deferredEntities: BatchEntity[];
  state: BatchDrainState;
  onStart: () => void;
  onCancel: () => void;
}

/**
 * Matrix header action: drain every deferred gate across a whole catalog in one click.
 * The button only appears when the catalog has ≥1 deferred artifact. While running it
 * shows serial progress + a Cancel; when done it reports the flips (deferred → pass/fail)
 * with per-step fail reasons and any locked/errored entities — no silent skips.
 * The actual serial loop + lease handling lives in `useBatchDrain`.
 */
export function MatrixBatchDrain({ t, deferredEntities, state, onStart, onCancel }: Props) {
  const { running, summary, doneEntityIds, total } = state;
  // Hide entirely when there's nothing to drain and no run to report.
  if (deferredEntities.length === 0 && !running && !summary) return null;

  const doneCount = doneEntityIds.size;

  return (
    <div
      data-testid="batch-drain"
      className={t.fontMono}
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, color: t.muted }}
    >
      {running ? (
        <>
          <span data-testid="batch-drain-progress" aria-live="polite" style={{ color: t.text }}>
            Draining {doneCount}/{total}…
          </span>
          <Button mono onClick={onCancel} data-testid="batch-drain-cancel" ariaLabel="Cancel batch drain">
            Cancel
          </Button>
        </>
      ) : (
        deferredEntities.length > 0 && (
          <Button
            mono
            variant="accent"
            onClick={onStart}
            data-testid="batch-drain-start"
            ariaLabel={`Drain deferred gates for ${deferredEntities.length} entit${deferredEntities.length > 1 ? 'ies' : 'y'}`}
          >
            ⏵ Drain {deferredEntities.length} deferred set{deferredEntities.length > 1 ? 's' : ''}
          </Button>
        )
      )}

      {/* Summary of flips — visible during (live counts) and after the run. */}
      {summary && (
        <span data-testid="batch-drain-summary" role="status" aria-live="polite" style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: summary.passed ? t.ok : t.muted }}>{summary.passed} passed</span>
          <span style={{ color: summary.failed ? t.bad : t.muted }}>{summary.failed} failed</span>
          {summary.skipped > 0 && <span title="Gates the runner left deferred (not yet runnable)">{summary.skipped} still deferred</span>}
          {summary.entitiesLocked > 0 && <span style={{ color: t.warn }} title="Skipped — another drain held the lease after a retry">{summary.entitiesLocked} locked</span>}
          {summary.entitiesErrored > 0 && <span style={{ color: t.bad }} title="Drain request errored">{summary.entitiesErrored} errored</span>}
        </span>
      )}

      {/* Per-step fail reasons — the checker's own words, never hidden. */}
      {!running && summary && summary.fails.length > 0 && (
        <ul data-testid="batch-drain-fails" style={{ listStyle: 'none', margin: 0, padding: 0, flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {summary.fails.map((f) => (
            <li key={`${f.entityId}:${f.step}`} style={{ fontSize: 12, color: t.bad }}>
              <span style={{ color: t.inkDeep, fontWeight: 600 }}>{f.entityName}</span>
              <span style={{ color: t.muted }}> · {f.step} — </span>
              {f.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
