'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Z_INDEX } from '@/lib/constants';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';
import { LANE_GLYPH, LANE_WORD, type ActivityLane, type LaneState } from './activityModel';
import { useLabActivity } from './hooks/useLabActivity';
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
 */
export function ActivityChip({ t }: { t: LabTheme }) {
  const summary = useLabActivity();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const setPanelOpen = useOneShotLabStore((s) => s.setPanelOpen);

  // Close on outside click / Escape (mirrors LabBridgeStrip's popover behaviour).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const tone = toneOf(summary.state, t);

  return (
    <span ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <Button
        onClick={toggle}
        mono
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="lab-activity-chip"
        data-state={summary.state}
        ariaLabel="What is running right now"
        title={summary.detail}
        style={{ color: tone, borderColor: summary.state === 'idle' ? t.line : tone, background: 'transparent' }}
      >
        <span aria-hidden="true" style={{ fontSize: 'var(--lab-fs-xs)' }}>{LANE_GLYPH[summary.state]}</span>
        <span role="status" aria-live="polite">{summary.label}</span>
      </Button>

      {open && (
        <div
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
              action={
                lane.id === 'one-shot' && lane.state !== 'idle'
                  ? { label: 'Open panel', onClick: () => { setPanelOpen(true); setOpen(false); }, aria: 'open one-shot panel' }
                  : null
              }
            />
          ))}
          <p style={{ margin: 0, fontSize: 'var(--lab-fs-xs)', color: t.muted, fontFamily: t.fontMono }}>
            Not covered here: a CLI produce dispatch in flight (its state lives in the step panel that
            started it) and anything launched outside the browser. These engines stay separate runtimes —
            this panel only reads them.
          </p>
        </div>
      )}
    </span>
  );
}

function LaneRow({ lane, t, action }: {
  lane: ActivityLane;
  t: LabTheme;
  action: { label: string; onClick: () => void; aria: string } | null;
}) {
  const tone = toneOf(lane.state, t);
  return (
    <div data-testid={`lab-activity-lane-${lane.id}`} data-state={lane.state} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--lab-s2)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: t.fontMono, fontSize: 'var(--lab-fs-xs)', color: tone }}>
          <span aria-hidden="true">{LANE_GLYPH[lane.state]}</span> {LANE_WORD[lane.state]}
        </span>
        <span style={{ fontFamily: t.fontMono, fontSize: 'var(--lab-fs-xs)', color: t.ink }}>{lane.title}</span>
        {action && (
          <Button onClick={action.onClick} ariaLabel={action.aria} mono style={{ marginLeft: 'auto' }}>
            {action.label}
          </Button>
        )}
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
