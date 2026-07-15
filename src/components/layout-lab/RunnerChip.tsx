'use client';

import { useState } from 'react';
import { useSuspendableEffect } from '@/hooks/useSuspend';
import { UI_TIMEOUTS } from '@/lib/constants';
import { fetchDrainLease, type DrainLeaseState } from './labArtifactClient';
import { useLabRunnerStore } from './labRunnerStore';
import type { LabTheme } from './theme';

/**
 * RunnerChip — a persistent header chip that makes the non-reentrant UE drain runner's
 * state visible, so a held L3/L4 lease is no longer invisible until a drain 409s post-hoc.
 * Three states:
 *   - `draining <scope>` — THIS session is draining (from `labRunnerStore.localDrain`, which
 *     the coach + batch drains publish); authoritative for our own runner, so we don't poll.
 *   - `lease held <scope>` — the drain status API reports a lease we didn't take → another
 *     session holds the editor. A batch drain here would 409; the chip says so up front.
 *   - `idle` — no local drain and the API reports no lease.
 *
 * Polling is suspend-safe (`useSuspendableEffect`) on a modest `UI_TIMEOUTS.runnerLeasePoll`
 * interval and does zero work while this lab is draining (localDrain wins) or hidden.
 */
export function RunnerChip({ t }: { t: LabTheme }) {
  const localDrain = useLabRunnerStore((s) => s.localDrain);
  const [lease, setLease] = useState<DrainLeaseState | null>(null);

  useSuspendableEffect(() => {
    // Our own drain is authoritative — no need to poll (and avoids racing our own lease).
    if (localDrain) return;
    let alive = true;
    const tick = async () => {
      const s = await fetchDrainLease();
      if (alive) setLease(s);
    };
    void tick();
    const id = setInterval(() => void tick(), UI_TIMEOUTS.runnerLeasePoll);
    return () => { alive = false; clearInterval(id); };
  }, [localDrain]);

  const heldElsewhere = !localDrain && !!lease?.held;
  const state: 'draining' | 'held' | 'idle' = localDrain ? 'draining' : heldElsewhere ? 'held' : 'idle';

  const label =
    state === 'draining' ? `Runner · draining ${localDrain}` :
    state === 'held'     ? `Runner · lease held${lease?.scope ? ` · ${lease.scope}` : ''}` :
    'Runner · idle';
  const color = state === 'idle' ? t.muted : t.warn;
  const title =
    state === 'draining' ? `This session is draining ${localDrain} (one editor boot).` :
    state === 'held'     ? `Another session holds the drain lease${lease?.scope ? ` (${lease.scope})` : ''} — a drain here would be refused until it frees.` :
    'The drain runner is idle — the UE editor lease is free.';

  return (
    <span
      className={t.fontMono}
      data-testid="lab-runner-chip"
      data-state={state}
      role="status"
      aria-live="polite"
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, whiteSpace: 'nowrap',
        padding: '4px 8px', borderRadius: t.glass ? 6 : 0,
        border: `1px solid ${state === 'idle' ? t.line : color}`,
        color, background: 'transparent',
      }}
    >
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: '50%',
        background: state === 'idle' ? t.muted : color,
        // A running/held lease gets a soft halo so the eye catches a busy runner.
        ...(state === 'idle' ? {} : { boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 25%, transparent)` }),
      }} />
      {label}
    </span>
  );
}
