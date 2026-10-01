'use client';

import { useEffect } from 'react';
import { leaveRisk, describeLeaveRisk, type LeaveSources } from '@/lib/shell/leaveRisk';
import { switchShell, type ShellPref } from '@/lib/ecw/shell-pref';
import { getPaneHolds } from '@/hooks/usePaneHold';
import { useCLIPanelStore } from '@/components/cli/store/cliPanelStore';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';

/**
 * The leave guard — a root-hosted service. `page.tsx` swaps whole shells, so neither shell
 * outlives the other; the guard lives ABOVE the gate and covers both. Sources are read AT
 * the event (`getState()` / `getPaneHolds()`), so it costs no subscription and no render.
 */
function currentLeaveSources(): LeaveSources {
  return {
    sessions: useCLIPanelStore.getState().sessions,
    holds: getPaneHolds(),
    oneShotPhase: useOneShotJobStore.getState().phase,
  };
}

/** Ask the browser to confirm a close / reload while anything `leaveRisk('unload')` names is in flight. */
export function useLeaveGuard(): void {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (leaveRisk('unload', currentLeaveSources()).length > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}

/**
 * Every shell switch goes through here: a flip that would unmount held work names it and
 * lets the user stay. Returns whether the switch happened; with nothing at risk it never
 * asks and behaves exactly as `switchShell`.
 */
export function requestShellSwitch(
  to: ShellPref,
  { confirm = (message: string) => window.confirm(message) }: { confirm?: (message: string) => boolean } = {},
): boolean {
  const reasons = leaveRisk('shell-switch', currentLeaveSources());
  if (reasons.length > 0 && !confirm(describeLeaveRisk(reasons))) return false;
  switchShell(to);
  return true;
}
