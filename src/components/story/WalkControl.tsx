'use client';

/**
 * The Orrery's Walk control: run the bounded walker over the active stored graph, follow the job,
 * and say plainly what the result is — SAMPLED data from `pof-walker@1`, never playtest data.
 *
 * It floats over the wheel (mounted through `OrreryChrome`'s `extra` slot) and owns no evidence:
 * the finished report goes up through `onDone`, the parent merges it (`@/lib/story/orrery/walk`)
 * and the merged evidence comes back down as `merged`, which is also what the per-cell table for
 * the selected node reads. Every cell carries its source and status as text, a glyph and a
 * `data-status` hook, so a `stale` or `unverified` cell never reads like a verified one, and a node
 * with no cell says "unmeasured", which is not 0%.
 *
 * Failure containment: the whole control sits inside {@link WalkBoundary}, so a throw while drawing
 * it costs the control, not the map; the fetches already never throw (`tryApiFetch`).
 */

import { Component, type ReactNode } from 'react';
import { LoadingRow } from '@/components/ui/LoadingRow';
import { MicroLabel } from '@/components/ui/MicroLabel';
import { Tooltip } from '@/components/ui/Tooltip';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { useStoryWalk, type WalkResult, type WalkTarget } from '@/components/story/useStoryWalk';
import { cohortStatuses, sampledLabel } from '@/lib/story/orrery/walk';
import { logger } from '@/lib/logger';
import type { EvidenceStatus, MergedEvidence } from '@/lib/story/evidence';
import type { NodeIx, OrreryModel } from '@/lib/story/orrery';

const STATUS_TEXT: Record<EvidenceStatus, { glyph: string; text: string; tone: 'ok' | 'warn' }> = {
  verified: { glyph: '✓', text: 'verified · pinned to this graph', tone: 'ok' },
  unverified: { glyph: '?', text: 'unverified · not pinned to a graph version', tone: 'warn' },
  stale: { glyph: '⚠', text: 'stale · pinned to another revision', tone: 'warn' },
};

export interface WalkControlProps {
  /** The stored graph to walk; `null` when the dataset is not a stored graph. */
  target: WalkTarget | null;
  /** The last finished walk for this dataset, kept by the parent across remounts. */
  last: WalkResult | null;
  /** Imported + sampled evidence as the lens reads it, or `null` before any walk. */
  merged: MergedEvidence | null;
  model: OrreryModel;
  selected: NodeIx;
  lens: string | null;
  onLens: (lens: string | null) => void;
  onDone: (result: WalkResult) => void;
  seed?: number;
  samples?: number;
}

export function WalkControl(props: WalkControlProps) {
  return (
    <WalkBoundary>
      <WalkControlInner {...props} />
    </WalkBoundary>
  );
}

function WalkControlInner({ target, last, merged, model, selected, lens, onLens, onDone, seed, samples }: WalkControlProps) {
  const { phase, start } = useStoryWalk(target, { seed, samples, onDone });
  const busy = phase.kind === 'starting' || phase.kind === 'running';
  const shown = phase.kind === 'done' ? phase.result : phase.kind === 'idle' ? last : null;
  const run = () => void start();

  return (
    <section data-role="orrery-walk" aria-label="Sampled walk" data-phase={phase.kind}>
      <div data-role="orrery-walk-head">
        <Tooltip
          multiline
          placement="bottom"
          content="Sample walks through this graph with the bounded walker (pof-walker@1). Its reach is SAMPLED, its findings are leads to reproduce, and imported evidence always outranks it."
        >
          <button type="button" data-role="orrery-walk-btn" onClick={run} disabled={busy || !target}>
            {shown ? 'Walk again' : 'Walk'}
          </button>
        </Tooltip>
        {!target ? <MicroLabel tone="muted">Not a stored graph: nothing to walk.</MicroLabel> : null}
        {phase.kind === 'idle' && !last && target ? <MicroLabel tone="muted">No sampled walk yet.</MicroLabel> : null}
      </div>

      {phase.kind === 'starting' ? <LoadingRow variant="inline" label="Starting the walk…" /> : null}
      {phase.kind === 'running' ? (
        <div data-role="orrery-walk-status">
          <LoadingRow
            variant="inline"
            label={`${phase.state === 'queued' ? 'Queued' : 'Walking'} · ${phase.progress.done.toLocaleString()} / ${phase.progress.total.toLocaleString()} walks`}
          />
          <progress
            data-role="orrery-walk-progress"
            max={Math.max(1, phase.progress.total)}
            value={phase.progress.done}
            aria-label="Walk progress"
          />
        </div>
      ) : null}
      {phase.kind === 'failed' ? <InlineErrorRetry message={`Walk failed: ${phase.message}`} onRetry={run} /> : null}

      {shown ? <WalkSummary result={shown} merged={merged} lens={lens} onLens={onLens} /> : null}
      {shown && merged ? <WalkCells model={model} selected={selected} merged={merged} /> : null}
    </section>
  );
}

function WalkSummary({
  result,
  merged,
  lens,
  onLens,
}: {
  result: WalkResult;
  merged: MergedEvidence | null;
  lens: string | null;
  onLens: (lens: string | null) => void;
}) {
  const r = result.report;
  const leads = r.findings.filter((f) => f.lead).length;
  const sampledCohorts = new Set(r.cohorts.map((c) => c.id));
  return (
    <div data-role="orrery-walk-status" data-walk-done="true">
      <span data-role="orrery-chip" data-tone="warn" data-walk-label="true">
        {sampledLabel(r)}
      </span>
      <MicroLabel tone="muted" as="div">
        engine {r.engine} · {r.samples.toLocaleString()} samples · seed {r.seed}
        {typeof result.durationMs === 'number' ? ` · ${Math.round(result.durationMs).toLocaleString()} ms` : ''}
      </MicroLabel>
      {r.gradeable ? null : (
        <div data-role="orrery-walk-note" data-tone="warn" data-walk-gradeable="false">
          Not gradeable: {r.untypedEdges.length.toLocaleString()} guard{r.untypedEdges.length === 1 ? ' holds' : 's hold'} an
          untyped <code>expr</code> the walker cannot evaluate, so it lets them pass. This sample is optimistic.
        </div>
      )}
      <ul data-role="orrery-walk-cohorts" aria-label="Reach by cohort">
        {(merged ? cohortStatuses(merged) : []).map((c) => {
          const s = STATUS_TEXT[c.status];
          return (
            <li key={c.cohort} data-status={c.status}>
              <span data-role="orrery-chip" data-tone={s.tone}>
                {s.glyph} {c.cohort} · {c.sources.join(' + ')} · {s.text}
              </span>
              {sampledCohorts.has(c.cohort) && lens !== c.cohort ? (
                <button type="button" data-role="orrery-walk-lens" onClick={() => onLens(c.cohort)}>
                  Show on lens
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <MicroLabel tone="muted" as="div">
        {leads.toLocaleString()} lead{leads === 1 ? '' : 's'} in the Audit tab &mdash; reproduce before trusting.
      </MicroLabel>
    </div>
  );
}

/** The selected node's cells, one per cohort, each with its value, source and status. */
function WalkCells({ model, selected, merged }: { model: OrreryModel; selected: NodeIx; merged: MergedEvidence }) {
  const n = selected >= 0 ? model.R[selected] : undefined;
  if (!n || n.virtual) return null;
  const row = merged.reach[n.id];
  if (!row) {
    return (
      <div data-role="orrery-walk-cells" data-measured="false">
        <MicroLabel tone="muted">{n.title}: no reach row in any source &mdash; unmeasured, which is not 0%.</MicroLabel>
      </div>
    );
  }
  return (
    <div data-role="orrery-walk-cells" data-measured="true">
      <MicroLabel tone="muted" as="div">
        {n.title}
      </MicroLabel>
      {Object.entries(row).map(([cohort, cell]) => {
        const s = STATUS_TEXT[cell.status];
        return (
          <div key={cohort} data-role="orrery-walk-cell" data-status={cell.status} data-source={cell.source}>
            <span>{cohort}</span>
            <b>{cell.value}%</b>
            <span>
              {s.glyph} {cell.source} · {s.text}
              {cell.shadowed ? ` (outranks sampled ${cell.shadowed.value}%)` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

class WalkBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    logger.error('[story/walk] the Walk control crashed while rendering:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section data-role="orrery-walk" data-phase="crashed" role="alert">
        <MicroLabel tone="muted">The Walk control failed to draw ({this.state.error.message}); the map is unaffected.</MicroLabel>
      </section>
    );
  }
}
