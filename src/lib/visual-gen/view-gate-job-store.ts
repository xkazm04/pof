/**
 * The render gate's missing seam — the thing that lets PoF actually LOOK at a generation.
 *
 * `mesh-views.ts` (render N yaws), `view-critique.ts` (judge each yaw) and
 * `kit-coherence.ts` (do the members match) all landed on 2026-08-31, fully tested, and
 * **no production file imported any of them**. The consumer census that found it is the
 * same one-line grep that had just exposed `GEN_PROMPTING_PRACTICES` as a knowledge list
 * nothing reads: a module is delivered when something calls it, not when its tests go
 * green. This store is that call site, and `POST /api/visual-gen/view-gate` is its door.
 *
 * Job-based for the reason `mesh-finish-job-store.ts` is: a headless Blender orbit plus
 * one VLM call per view runs far past an HTTP timeout. POST starts, GET polls.
 * Module-global so it survives Next dev HMR; ephemeral, because the durable artifacts
 * are the PNGs on disk and the verdict text.
 *
 * Three honesty rules carry over from the modules it composes:
 *
 * 1. **A member nobody could render has no verdict.** No render → no critique call, no
 *    invented `pass`; the member is kept in the list carrying its error, because a
 *    dropped member reads as a kit that was fully inspected.
 * 2. **Silence is not a pass, and it aggregates that way.** `worstMemberVerdict` ranks
 *    `fail` > `unmeasured` > `warn` > `pass` — see its own note.
 * 3. **Coherence is advisory.** `gradeKitCoherence` says in as many words that its
 *    threshold is not yet calibrated on a known-good kit; this store surfaces the number
 *    and never folds it into the pass/fail verdict.
 */
import { join } from 'node:path';
import { runMeshViews, type MeshViewsSpec, type MeshViewsResult, type RenderedView } from './mesh-views';
import { critiqueMeshViews, type ViewCritiqueDeps, type ViewGateResult } from './view-critique';
import { gradeKitCoherence, type KitCoherenceGrade } from './kit-coherence';

export interface ViewGateMemberSpec {
  /** Mesh to look at — a `.glb` from the generation path. */
  meshPath: string;
  /** Name used in the coherence report; defaults to the mesh's basename. */
  name?: string;
  /** What the asset is meant to be, so "wrong shape" is judgeable. */
  subject?: string;
}

export interface ViewGateSpec {
  members: ViewGateMemberSpec[];
  /** Root for the rendered PNGs; each member gets `<outDir>/<jobId>/<name>`. */
  outDir?: string;
  views?: number;
  resolution?: number;
  blenderPath?: string;
  timeoutMs?: number;
}

export interface ViewGateMemberResult {
  name: string;
  meshPath: string;
  render?: MeshViewsResult;
  /** Absent whenever the member could not be rendered or judged — never defaulted. */
  gate?: ViewGateResult;
  error?: string;
}

export type ViewGateVerdict = ViewGateResult['verdict'];

export interface ViewGateJob {
  id: string;
  status: 'running' | 'done' | 'error';
  spec: ViewGateSpec;
  members: ViewGateMemberResult[];
  /** Aggregate over the members — see {@link worstMemberVerdict}. */
  verdict: ViewGateVerdict;
  /** Advisory colour-coherence grade; present only for a 2+ member kit. */
  kit?: KitCoherenceGrade;
  error?: string;
  startedAt: number;
}

const g = globalThis as unknown as { pofViewGateJobs?: Map<string, ViewGateJob> };
const jobs = g.pofViewGateJobs ?? new Map<string, ViewGateJob>();
if (!g.pofViewGateJobs) g.pofViewGateJobs = jobs;

/**
 * Stable, unique display names for the kit members. Pure.
 *
 * Two members generated into different provider directories collide on basename
 * (`tripo/crate.glb` and `triposr/crate.glb`), and a coherence report that names the
 * same member twice — "crate and crate are 14.2 dE apart" — cannot be acted on.
 */
export function memberNames(members: ViewGateMemberSpec[]): string[] {
  const seen = new Map<string, number>();
  return (members ?? []).map((m) => {
    const base =
      m.name?.trim() ||
      (m.meshPath.split(/[\\/]/).pop() ?? 'member').replace(/\.[^.]+$/, '') ||
      'member';
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}#${n}`;
  });
}

/**
 * The palette a member contributes to the coherence grade. Pure.
 *
 * The lowest-indexed view that measured one, deliberately: `kit-coherence.ts` was
 * calibrated on per-view palettes (a re-render of the same asset sits at dE 0.0-1.8), so
 * one view is the unit it knows. Merging every yaw would stack N quantised summaries and
 * compare a different quantity than the one the threshold was measured against.
 * Undefined — never `[]` — when nothing measured a palette.
 */
export function kitPaletteOf(views: RenderedView[]): string[] | undefined {
  const withPalette = (views ?? [])
    .filter((v) => (v.palette ?? []).length > 0)
    .sort((a, b) => a.index - b.index);
  return withPalette[0]?.palette;
}

/** Severity order for the aggregate. Higher wins. */
const VERDICT_RANK: Record<ViewGateVerdict, number> = {
  pass: 0,
  warn: 1,
  unmeasured: 2,
  fail: 3,
};

/**
 * Aggregate the members' verdicts into one. Pure.
 *
 * `fail` > `unmeasured` > `warn` > `pass`. The two ends are inherited from
 * `scoreViewGate` (a seen defect outranks a coverage gap; silence is not a pass). The
 * middle is this store's own call: the aggregate answers "can this kit go on unattended",
 * and a member nobody could look at is precisely the failure mode the gate exists to
 * catch, whereas a `warn` is a single moderate view that already named itself and its
 * known false-positive mode. An empty set is `unmeasured`, not `pass`.
 */
export function worstMemberVerdict(verdicts: ViewGateVerdict[]): ViewGateVerdict {
  if (!verdicts?.length) return 'unmeasured';
  return verdicts.reduce((worst, v) => (VERDICT_RANK[v] > VERDICT_RANK[worst] ? v : worst), 'pass');
}

type RenderFn = (spec: MeshViewsSpec) => Promise<MeshViewsResult>;
type CritiqueFn = (views: RenderedView[], deps?: ViewCritiqueDeps) => Promise<ViewGateResult>;

export interface ViewGateJobDeps {
  render?: RenderFn;
  critique?: CritiqueFn;
}

const defaultOutRoot = () => join(process.cwd(), 'generated', 'view-gate').replace(/\\/g, '/');

/**
 * Start a render-gate job (fire-and-forget). Returns the job id immediately.
 *
 * Members are processed in series on purpose: each one spawns Blender and then issues a
 * VLM call per view, so a parallel fan-out over a kit would open N Blender processes and
 * burst the vision quota that `qwen.ts`'s fallback chain exists to nurse.
 */
export function startViewGateJob(spec: ViewGateSpec, deps: ViewGateJobDeps = {}): string {
  const render = deps.render ?? ((s: MeshViewsSpec) => runMeshViews(s));
  const critique = deps.critique ?? critiqueMeshViews;

  const id = `viewgate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const names = memberNames(spec.members);
  const outRoot = (spec.outDir ?? defaultOutRoot()).replace(/\\/g, '/');

  const job: ViewGateJob = {
    id,
    status: 'running',
    spec,
    members: spec.members.map((m, i) => ({ name: names[i], meshPath: m.meshPath })),
    verdict: 'unmeasured',
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  void (async () => {
    for (let i = 0; i < spec.members.length; i++) {
      const m = spec.members[i];
      const slot = job.members[i];
      try {
        const result = await render({
          meshPath: m.meshPath,
          outDir: `${outRoot}/${id}/${names[i]}`,
          views: spec.views,
          resolution: spec.resolution,
          blenderPath: spec.blenderPath,
          timeoutMs: spec.timeoutMs,
        });
        slot.render = result;
        if (!result.ok) {
          // No pixels, so nothing to judge. The member stays in the list with its reason.
          slot.error = result.error ?? 'render failed without a reason';
          continue;
        }
        slot.gate = await critique(result.views, m.subject ? { subject: m.subject } : {});
      } catch (e) {
        slot.error = e instanceof Error ? e.message : String(e);
      }
    }

    job.verdict = worstMemberVerdict(
      job.members.map((m) => m.gate?.verdict ?? ('unmeasured' as ViewGateVerdict)),
    );

    if (spec.members.length >= 2) {
      job.kit = gradeKitCoherence(
        job.members.map((m) => ({
          name: m.name,
          palette: kitPaletteOf(m.render?.views ?? []),
        })),
      );
    }

    const judged = job.members.filter((m) => m.gate !== undefined).length;
    if (judged === 0) {
      job.status = 'error';
      job.error =
        `none of the ${job.members.length} member(s) could be rendered and judged ` +
        `(first: ${job.members[0]?.error ?? 'no reason recorded'}) — the gate did not run`;
    } else {
      job.status = 'done';
    }
  })();

  return id;
}

export function getViewGateJob(id: string): ViewGateJob | undefined {
  return jobs.get(id);
}
