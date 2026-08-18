import type { HarnessRunStatus, StartFormValues } from './types';

/**
 * Pure guards for the three harness controls. Every control the operator can see
 * resolves to `{ enabled, reason }` BEFORE it is clicked, so a control that the
 * API would refuse is disabled with the refusal spelled out — never a button that
 * silently 409s. Kept pure (no React, no fetch) so the rules are unit-testable and
 * the panel cannot drift from them.
 */

export interface ControlGuard {
  enabled: boolean;
  /** Why the control is unavailable. Always non-null when `enabled` is false. */
  reason: string | null;
}

/** Mirror of the route's `THEME_DIRECTIVE_MAX` — validated here so a 400 is pre-empted. */
export const THEME_DIRECTIVE_MAX = 2000;

const FIELD_LABEL: Record<'projectPath' | 'projectName' | 'ueVersion', string> = {
  projectPath: 'project path',
  projectName: 'project name',
  ueVersion: 'UE version',
};

function listMissing(form: StartFormValues): string[] {
  return (['projectPath', 'projectName', 'ueVersion'] as const)
    .filter((k) => form[k].trim() === '')
    .map((k) => FIELD_LABEL[k]);
}

/** Format a list as "a", "a and b", "a, b and c". */
function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function startGuard(status: HarnessRunStatus, form: StartFormValues): ControlGuard {
  if (status === 'running') {
    return {
      enabled: false,
      reason: 'A run is already in flight on this server — the API refuses a second start with 409. Pause it first.',
    };
  }
  const missing = listMissing(form);
  if (missing.length > 0) {
    return {
      enabled: false,
      reason: `Fill in ${andList(missing)} — the API rejects a start without ${missing.length > 1 ? 'them' : 'it'} (400).`,
    };
  }
  if (form.themeDirective.length > THEME_DIRECTIVE_MAX) {
    return {
      enabled: false,
      reason: `Theme directive is ${form.themeDirective.length} characters — the API caps it at ${THEME_DIRECTIVE_MAX} (400).`,
    };
  }
  const targetRate = form.targetPassRate.trim();
  if (targetRate !== '' && !Number.isFinite(Number(targetRate))) {
    return { enabled: false, reason: `Target pass rate "${targetRate}" is not a number.` };
  }
  return { enabled: true, reason: null };
}

export function pauseGuard(status: HarnessRunStatus): ControlGuard {
  if (status !== 'running') {
    return {
      enabled: false,
      reason: `Pause needs a run in flight — this server reports "${status}". The API refuses it with 409.`,
    };
  }
  return { enabled: true, reason: null };
}

/**
 * A resume is reachable two ways: the in-memory run is `paused`, or a state path
 * is supplied so the route can REHYDRATE a run from disk after a server restart
 * (`rehydrateHarnessOrchestrator`). Which one applies is reported to the operator
 * because they behave differently.
 */
export type ResumeMode = 'resume' | 'rehydrate';

export function resumeGuard(status: HarnessRunStatus, statePath: string): ControlGuard & { mode: ResumeMode | null } {
  if (status === 'paused') return { enabled: true, reason: null, mode: 'resume' };
  if (statePath.trim() !== '') return { enabled: true, reason: null, mode: 'rehydrate' };
  return {
    enabled: false,
    reason:
      `Resume needs a paused run — this server reports "${status}". After a restart the in-memory run is gone; ` +
      'give the run\'s state path above to rehydrate it from disk.',
    mode: null,
  };
}

/**
 * The honest caveat shown beside an ENABLED pause. Pause flips an in-memory flag on
 * a `globalThis` singleton, so a pause POST that lands on a server process without
 * that global comes back 409 even though the status read said "running". Surfaced
 * rather than papered over — this is a known defect of the route, not of the panel.
 */
export const PAUSE_PROCESS_CAVEAT =
  'Pause flips an in-memory flag on the server process that owns the run. If the app runs more than one ' +
  'worker process, the POST can land on a process without that run and come back 409 — this panel reports ' +
  'the refusal verbatim instead of pretending the pause landed.';

/** Body for `POST /api/harness { action: 'start' }` — omits every blank optional field. */
export function buildStartBody(form: StartFormValues): Record<string, unknown> {
  const num = (v: string): number | undefined => {
    const t = v.trim();
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

  const maxIterations = num(form.maxIterations);
  const targetPassRate = num(form.targetPassRate);
  const budgetUsd = num(form.budgetUsd);
  const statePath = str(form.statePath);
  const scenario = str(form.scenario);
  const themeDirective = form.themeDirective.trim() === '' ? undefined : form.themeDirective;

  return {
    action: 'start',
    projectPath: form.projectPath.trim(),
    projectName: form.projectName.trim(),
    ueVersion: form.ueVersion.trim(),
    ...(statePath != null ? { statePath } : {}),
    ...(maxIterations != null ? { maxIterations } : {}),
    ...(targetPassRate != null ? { targetPassRate } : {}),
    ...(budgetUsd != null ? { budgetUsd } : {}),
    ...(scenario != null ? { scenario } : {}),
    ...(themeDirective != null ? { themeDirective } : {}),
    ...(form.checkpoint ? { checkpoint: true } : {}),
    ...(form.unlimited ? { unlimited: true } : {}),
  };
}
