/**
 * What leaving would interrupt — ONE read for every leave path the app can intercept.
 *
 * Two kinds of leave, and they tear down different things:
 *  - `unload` (close / reload / navigate away): the whole page goes. Counts running CLI
 *    sessions, declared pane holds (`usePaneHold`) and an in-flight one-shot phase (no
 *    one-shot request survives a reload — `oneShotJobStore` rests it at reload-interrupted).
 *  - `shell-switch` (page.tsx swaps whole shells): only the other shell's React tree goes.
 *    CLI state and the one-shot orchestrator are module-level and survive an unmount, so
 *    only pane holds count.
 *
 * Every reason is a WARNING the user can override, never a block: the browser's prompt and
 * the switch confirm both offer "leave anyway". Some held work lives on the server and
 * reattaches on return (a UE cook is a server job, `src/lib/packaging/cook-jobs.ts`; a CLI
 * run re-attaches) — leaving still detaches its live console, so it is named, and the
 * confirm text says such jobs keep running. The drain lane is a server lease and is never
 * a reason. Pure: callers collect the sources (see `useLeaveGuard`).
 */
import { MODULE_LABELS, CATEGORY_MAP } from '@/lib/module-registry';
import { IN_FLIGHT_PHASES, type OneShotPhase } from '@/stores/oneShotJobStore';

export type LeaveKind = 'unload' | 'shell-switch';

export interface LeaveReason {
  source: 'cli-session' | 'pane-hold' | 'one-shot';
  /** The work, as its declarer named it ("UE cook running"). */
  what: string;
  /** Where it runs (module label, terminal label, panel). */
  where: string;
}

export interface LeaveSources {
  sessions?: Readonly<Record<string, { isRunning: boolean; label: string }>>;
  /** `{ paneId → hold reasons }` — the `getPaneHolds()` snapshot. */
  holds?: Readonly<Record<string, readonly string[]>>;
  oneShotPhase?: OneShotPhase;
}

function paneLabel(paneId: string): string {
  return MODULE_LABELS[paneId] ?? CATEGORY_MAP[paneId]?.label ?? paneId;
}

export function leaveRisk(kind: LeaveKind, sources: LeaveSources): LeaveReason[] {
  const out: LeaveReason[] = [];
  if (kind === 'unload') {
    for (const s of Object.values(sources.sessions ?? {})) {
      if (s.isRunning) out.push({ source: 'cli-session', what: 'CLI task running', where: s.label });
    }
  }
  for (const [paneId, reasons] of Object.entries(sources.holds ?? {})) {
    for (const what of reasons) out.push({ source: 'pane-hold', what, where: paneLabel(paneId) });
  }
  const phase = sources.oneShotPhase;
  if (kind === 'unload' && phase && IN_FLIGHT_PHASES.includes(phase)) {
    out.push({ source: 'one-shot', what: `One-shot run ${phase}`, where: 'One-shot' });
  }
  return out;
}

/** The shell-switch confirm text: every reason with its place, and what survives. */
export function describeLeaveRisk(reasons: readonly LeaveReason[]): string {
  const items = reasons.map((r) => `- ${r.what} (${r.where})`).join('\n');
  return `Switching shells closes the panes doing this work:\n${items}\n\n`
    + 'Server jobs (a UE cook) keep running and reattach when you come back; work running in the page stops.\n\n'
    + 'Switch anyway?';
}
