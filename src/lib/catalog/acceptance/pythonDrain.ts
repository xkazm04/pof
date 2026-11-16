/**
 * Python-step drain — the missing production consumer for `pythonStepCheckers`.
 *
 * The `player-movement` pipeline's steps each persist a dispatch descriptor
 * (`data.python = { module, function }`) and their checkers read the module's structured
 * return (`{created, skipped, failed}` / `{ok, issues}`) back out of the artifact. Both
 * halves existed — the modules are on disk in the UE project's `Content/Python/
 * player_movement/`, the checkers are unit-tested — but NOTHING ever called the bridge and
 * wrote the result back, so all ten steps sat permanently at `deferred` ("awaiting
 * /pof/python/run on the editor"). On the map that is R4-WAITING: a gate declared and never
 * run. This is that gate's runner, mirroring `/drain` (L3/L4 UE tests), `verify-static`
 * (UE source on disk) and `bind-icons` (the generated art library).
 *
 * Honesty rules baked in:
 *  - a step with no `data.python` descriptor is skipped — the drain never invents a dispatch;
 *  - the module's return is merged and RE-GRADED by the step's own checker, so the drain
 *    reports whatever the module actually produced (including `fail`), never a verdict of
 *    its own;
 *  - a TRANSPORT failure (editor closed, bridge down, python traceback) writes NOTHING. The
 *    artifact stays `deferred`, because "we could not ask" is not "the step failed" — the
 *    error is reported in the summary instead (Rule 4: surface the reason, don't fake it);
 *  - steps run in the pipeline's declared ORDER, and by default a chain stops after a step
 *    the re-grade condemns OR whose module could not be run (a bridge error): `retarget` failing
 *    merely because `import_clips` never ran is a consequence, not an independent finding, and
 *    recording it as one would be noise. The skipped steps report `upstream-failed` naming which.
 *    `continueOnFail` opts out of both stops.
 *
 * Pure orchestration over injected deps (no fs / db / network / clock), like `staticVerify`
 * and `bindIconsAll`, so it is unit-testable with no editor and no SQLite.
 */
import type { AcceptanceResult } from './types';

export interface PythonDrainFilter {
  catalogId?: string;
  entityId?: string;
}

/** The dispatch descriptor a python-driven step persists in its artifact data. */
export interface PythonDispatch {
  module: string;
  function: string;
}

/** Read the dispatch descriptor out of artifact data, or null when the step declares none. */
export function readDispatch(data: Record<string, unknown> | undefined): PythonDispatch | null {
  const p = (data ?? {})['python'];
  if (!p || typeof p !== 'object') return null;
  const { module, function: fn } = p as Record<string, unknown>;
  if (typeof module !== 'string' || !module.trim()) return null;
  if (typeof fn !== 'string' || !fn.trim()) return null;
  return { module, function: fn };
}

/** True once a module's return has been written back — used to skip already-drained steps. */
export function hasResult(data: Record<string, unknown> | undefined): boolean {
  const d = data ?? {};
  return d.created !== undefined || d.skipped !== undefined || d.failed !== undefined || d.ok !== undefined;
}

export type PythonDrainOutcome =
  | 'drained'          // the module ran and its return was re-graded
  | 'no-dispatch'      // the step declares no python module
  | 'already-drained'  // a result is already recorded (pass `force` to re-run)
  | 'bridge-error'     // could not reach / run the module — artifact left untouched
  | 'not-gradable'     // no server checker resolved, so nothing was written
  | 'upstream-failed'; // an earlier step in this entity's chain was condemned

export interface PythonDrainRow {
  catalogId: string;
  entityId: string;
  step: string;
  module?: string;
  outcome: PythonDrainOutcome;
  from: string;
  to: string;
  detail: string;
  changed: boolean;
}

export interface PythonDrainSummary {
  dispatched: number;
  passed: number;
  /** The module ran but returned fewer artifacts than the step expects. */
  pending: number;
  failed: number;
  stillDeferred: number;
  errors: number;
  skipped: number;
  changed: number;
  results: PythonDrainRow[];
}

export interface PythonDrainDeps {
  listArtifacts: (filter: PythonDrainFilter) => { catalogId: string; entityId: string; step: string; status: string; data: Record<string, unknown> }[];
  /** The pipeline's declared step labels in order — the chain order the drain respects. */
  stepOrder: (catalogId: string) => string[];
  /** Call the module on the editor thread. Resolves to the module's return, or an error. */
  run: (module: string, fn: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  /** Re-grade the merged data with the step's own server checker (null when unregistered). */
  grade: (catalogId: string, step: string, data: Record<string, unknown>, entityId: string) => AcceptanceResult | null;
  save: (catalogId: string, entityId: string, step: string, data: Record<string, unknown>, res: AcceptanceResult) => void;
}

function orderKey(order: string[], step: string): number {
  const i = order.indexOf(step);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export async function drainPythonAll(
  filter: PythonDrainFilter,
  deps: PythonDrainDeps,
  opts?: { apply?: boolean; force?: boolean; continueOnFail?: boolean },
): Promise<PythonDrainSummary> {
  const apply = opts?.apply !== false;
  const results: PythonDrainRow[] = [];
  let dispatched = 0, passed = 0, pending = 0, failed = 0, stillDeferred = 0, errors = 0, skipped = 0, changed = 0;

  // Group by entity so each chain can stop independently, and run each chain in step order.
  const artifacts = deps.listArtifacts(filter);
  const byEntity = new Map<string, typeof artifacts>();
  for (const a of artifacts) {
    const key = `${a.catalogId}\u0000${a.entityId}`;
    const list = byEntity.get(key) ?? [];
    list.push(a);
    byEntity.set(key, list);
  }

  for (const [, list] of byEntity) {
    const order = deps.stepOrder(list[0].catalogId);
    const chain = [...list].sort((x, y) => orderKey(order, x.step) - orderKey(order, y.step));
    let broken = false;
    // Why the chain stopped, for the detail of the steps it skips: a condemned step vs a module that never ran.
    let brokenBy: 'condemned' | 'unreachable' = 'condemned';

    for (const a of chain) {
      const row = (outcome: PythonDrainOutcome, detail: string, to = a.status, module?: string): void => {
        results.push({
          catalogId: a.catalogId, entityId: a.entityId, step: a.step,
          ...(module ? { module } : {}),
          outcome, from: a.status, to, detail, changed: to !== a.status,
        });
      };

      const dispatch = readDispatch(a.data);
      if (!dispatch) { skipped++; row('no-dispatch', 'step declares no python module'); continue; }
      if (broken) {
        skipped++;
        row('upstream-failed', brokenBy === 'unreachable'
          ? 'an earlier step in this chain could not be run (bridge error), so this one has no inputs to run on'
          : 'an earlier step in this chain was condemned', a.status, dispatch.module);
        continue;
      }
      if (!opts?.force && hasResult(a.data)) {
        skipped++;
        row('already-drained', 'a module return is already recorded', a.status, dispatch.module);
        // Its PERSISTED verdict still speaks for the chain: a fail recorded on an earlier run
        // condemns the steps after it exactly as a fail drained this run does.
        if (a.status === 'fail' && !opts?.continueOnFail) { broken = true; brokenBy = 'condemned'; }
        continue;
      }

      const out = await deps.run(dispatch.module, dispatch.function);
      if (!out.ok) {
        // Could not ASK — that is not the step failing. Leave the artifact alone.
        errors++;
        row('bridge-error', out.error, a.status, dispatch.module);
        // The step definitely did not run, so everything after it would be dispatched against missing
        // inputs and recorded as an independent fail. Stop the chain, as a condemned step does.
        if (!opts?.continueOnFail) { broken = true; brokenBy = 'unreachable'; }
        continue;
      }

      const returned = (out.data && typeof out.data === 'object' && !Array.isArray(out.data))
        ? (out.data as Record<string, unknown>)
        : {};
      const merged = { ...a.data, ...returned };
      const verdict = deps.grade(a.catalogId, a.step, merged, a.entityId);
      if (!verdict) { skipped++; row('not-gradable', 'no server checker — nothing written', a.status, dispatch.module); continue; }

      dispatched++;
      if (verdict.status === 'pass') passed++;
      else if (verdict.status === 'pending') pending++;
      else if (verdict.status === 'fail') { failed++; if (!opts?.continueOnFail) { broken = true; brokenBy = 'condemned'; } }
      else if (verdict.status === 'deferred') stillDeferred++;
      if (verdict.status !== a.status) changed++;
      if (apply) deps.save(a.catalogId, a.entityId, a.step, merged, verdict);
      row('drained', verdict.reason ?? verdict.detail ?? verdict.status, verdict.status, dispatch.module);
    }
  }

  return { dispatched, passed, pending, failed, stillDeferred, errors, skipped, changed, results };
}
