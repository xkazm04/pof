'use client';

import { useMemo } from 'react';
import { Z_INDEX } from '@/lib/constants';
import { useDynamicTitle } from '@/hooks/useDynamicTitle';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { LANE_GLYPH, LANE_WORD, drainSubject, type ActivityLane, type LaneState } from './activityModel';
import { useLabRunnerStore, type DrainRun } from './labRunnerStore';
import { useLabActivity } from './hooks/useLabActivity';
import { useHeaderPopover } from './hooks/useHeaderPopover';
import { Button } from './ui/Button';
import { labPanelStyle, type LabTheme } from './theme';

/**
 * ActivityChip — the lab's single answer to "is anything running right now?".
 *
 * It replaces the two unrelated header chips (`RunnerChip` for the UE drain lease and
 * `LabJobsChip` for the one-shot orchestrator), which shared no store, no code path and
 * no vocabulary — so answering "is it safe to boot a drain?" required knowing that two
 * chips existed and meant different things.
 *
 * This is a unified READ, not a merged runtime: each engine keeps its own store and its
 * own lifecycle (see `activityModel.ts`); this component only renders their lanes in one
 * vocabulary. Three honesty properties it must keep:
 *   - MY session's drain (`draining …`) stays distinguishable from a lease held by a run
 *     this page did not start — that distinction is the whole point of the drain lane.
 *   - Before the first lease poll answers (and after one fails) the lane reads UNKNOWN,
 *     never idle: a false idle invites a second, non-reentrant UE editor boot.
 *   - Each lane names its own blind spot, so the surface never claims knowledge it lacks.
 *
 * The drain lane is an ACTION surface for this session's batch drains (the run lives in
 * `labRunnerStore`, not in the Matrix): Cancel while one runs, Open in Matrix / Dismiss once it
 * has finished. `onOpenDrain(catalogId)` routes through the shell's navigate door.
 */
export function ActivityChip({ t, onOpenDrain }: { t: LabTheme; onOpenDrain?: (catalogId: string) => void }) {
  const summary = useLabActivity();
  // The lab shell's tab title: this chip is always mounted in the header and already holds
  // the summary, so the tab reports outcomes (failed / needs you / done) from the same read.
  useDynamicTitle(summary);
  const { open, close, toggle, panelRef, wrapperProps } = useHeaderPopover();
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);
  const runMap = useLabRunnerStore((s) => s.runs);
  const drainRun = useMemo(() => drainSubject(Object.values(runMap)), [runMap]);

  const tone = toneOf(summary.state, t);

  return (
    <span {...wrapperProps} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        onClick={toggle}
        mono
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="lab-activity-chip"
        data-state={summary.state}
        // An aria-label replaces the label text inside the button, so the answer rides in it.
        ariaLabel={`What is running right now — ${summary.label}`}
        title={summary.detail}
        style={{ color: tone, borderColor: summary.state === 'idle' ? t.line : tone, background: 'transparent' }}
      >
        <span aria-hidden="true" style={{ fontSize: 'var(--lab-fs-xs)' }}>{LANE_GLYPH[summary.state]}</span>
        <span role="status" aria-live="polite">{summary.label}</span>
      </Button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="What is running right now"
          data-testid="lab-activity-panel"
          style={labPanelStyle(t, {
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 'min(420px, 92vw)', zIndex: Z_INDEX.panel,
            padding: 'var(--lab-s3)', borderRadius: t.glass ? 10 : 0,
            display: 'flex', flexDirection: 'column', gap: 'var(--lab-s3)',
            textAlign: 'left',
          })}
        >
          {summary.lanes.map((lane) => (
            <LaneRow
              key={lane.id}
              lane={lane}
              t={t}
              actions={
                lane.id === 'one-shot' && lane.state !== 'idle'
                  ? [{ label: 'Open panel', onClick: () => { setPanelOpen(true); close(); }, aria: 'open one-shot panel' }]
                  : lane.id === 'drain' ? drainActions(drainRun, onOpenDrain, close) : []
              }
            />
          ))}
          <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.muted, fontFamily: 'var(--lab-font-mono)' }}>
            Not covered here: a CLI produce dispatch in flight (its state lives in the step panel that
            started it) and anything launched outside the browser. These engines stay separate runtimes —
            this panel only reads them.
          </p>
        </div>
      )}
    </span>
  );
}

interface LaneAction { label: string; onClick: () => void; aria: string }

/** The drain lane's actions for the run it is about (see `drainSubject`). */
function drainActions(run: DrainRun | null, onOpenDrain: ((catalogId: string) => void) | undefined, close: () => void): LaneAction[] {
  if (!run) return [];
  const runner = useLabRunnerStore.getState();
  if (run.phase === 'running') {
    // Honest Cancel: it skips the automatic retry only; the lane then says "cancel requested".
    return run.cancelRequested ? [] : [{ label: 'Cancel', onClick: () => { runner.requestCancel(run.id); }, aria: `cancel the ${run.catalogId} batch drain` }];
  }
  const acts: LaneAction[] = [];
  if (onOpenDrain) acts.push({ label: 'Open in Matrix', onClick: () => { onOpenDrain(run.catalogId); close(); }, aria: `open the ${run.catalogId} drain in the Matrix` });
  acts.push({ label: 'Dismiss', onClick: () => { runner.dismissRun(run.id); close(); }, aria: `dismiss the ${run.catalogId} drain result` });
  return acts;
}

function LaneRow({ lane, t, actions }: {
  lane: ActivityLane;
  t: LabTheme;
  actions: LaneAction[];
}) {
  const tone = toneOf(lane.state, t);
  return (
    <div data-testid={`lab-activity-lane-${lane.id}`} data-state={lane.state} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: tone }}>
          <span aria-hidden="true">{LANE_GLYPH[lane.state]}</span> {LANE_WORD[lane.state]}
        </span>
        <span style={{ fontFamily: 'var(--lab-font-mono)', fontSize: 'var(--lab-fs-xs)', color: t.ink }}>{lane.title}</span>
        {actions.map((a, i) => (
          <Button key={a.aria} onClick={a.onClick} ariaLabel={a.aria} mono style={i === 0 ? { marginLeft: 'auto' } : undefined}>
            {a.label}
          </Button>
        ))}
      </div>
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.text }}>{lane.label}</span>
      {/* The blind spot is always shown: an operator reading "idle" must be able to see
          how far that claim reaches. */}
      <span style={{ fontSize: 'var(--lab-fs-xs)', color: t.muted }}>Blind spot: {lane.blindSpot}</span>
    </div>
  );
}

/** Colour is the secondary channel only — every state also carries a glyph and a word. */
function toneOf(state: LaneState, t: LabTheme): string {
  return state === 'idle' ? t.muted : state === 'attention' ? t.bad : t.warn;
}
