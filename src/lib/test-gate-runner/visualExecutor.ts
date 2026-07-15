import { boundJudgeText } from '@/types/observation';
import type { CaptureResolution, GateExecutor, GateJob, GateVerdict, ScreenshotResolution } from './types';

type FetchImpl = typeof fetch;
type VisualMode = 'hud' | 'texture' | 'lighting' | 'character';

/** Normalize a resolver return (legacy `string | null` or the richer resolution) to one shape. */
function normalizeResolution(r: ScreenshotResolution): CaptureResolution {
  if (r === null) return { screenshot: null };
  if (typeof r === 'string') return { screenshot: r };
  return r;
}

/**
 * Frame-context evidence markers — WHAT was actually photographed, so the persisted evidence
 * (and the /status audit reading it) can see the entity/map/scenario behind the verdict rather
 * than assuming a generic slice. Carried as `evidence.markers` (the size-bounded evidence field),
 * keeping the change within the observation-testing context (no schema edit).
 */
function frameMarkers(job: GateJob, res: CaptureResolution): string[] {
  const m = [`entity=${job.catalogId}/${job.entityId}`];
  if (res.map) m.push(`map=${res.map}`);
  m.push(`scenario=${res.scenarioDriven ? 'driven' : 'generic'}`);
  return m;
}

export interface VisualExecutorOptions {
  /** Absolute origin where /api/verify/visual lives (the runner is server-side). */
  appOrigin: string;
  fetchImpl?: FetchImpl;
  projectPath?: string;
  /** Force the Gemini check mode; else derived from the catalogId. */
  mode?: VisualMode;
  /**
   * Resolve a screenshot for a job. Returns a bare path (`string | null`, legacy/operator
   * path) or the richer {@link CaptureResolution} (autonomous capture — carries the map
   * actually photographed + an honest `deferredReason` when a declared map can't render).
   * The default resolver returns null and L4 jobs stay deferred until a source is provided.
   */
  screenshotResolver?: (job: GateJob) => Promise<ScreenshotResolution>;
}

/** Map a catalog to the closest Gemini visual-check prompt mode. Pure (tested). */
export function visualModeFor(catalogId: string): VisualMode {
  if (catalogId === 'materials') return 'texture';
  if (catalogId === 'zone-map' || catalogId === 'combat-map') return 'lighting';
  if (catalogId === 'characters' || catalogId === 'bestiary') return 'character';
  return 'hud';
}

/**
 * L4 executor: obtain a screenshot, run it through the existing /api/verify/visual
 * Gemini check (which also records to `visual_verifications`), map to a verdict.
 * Honestly throws (→ the job stays deferred) when no screenshot source is reachable.
 */
export function makeVisualExecutor(opts: VisualExecutorOptions): GateExecutor {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const resolve = opts.screenshotResolver ?? (async () => null);

  return {
    id: 'visual-bridge',
    tier: 'L4',

    async available() {
      return !!opts.appOrigin;
    },

    async run(job: GateJob): Promise<GateVerdict> {
      const res = normalizeResolution(await resolve(job));
      const mode = opts.mode ?? visualModeFor(job.catalogId);
      const at0 = new Date().toISOString();
      // A declared map that couldn't render → honest DEFER (named reason), never a silent
      // fallback to the default lit slice (which would judge the wrong scene). The frame
      // context is stamped so the audit sees which map was attempted.
      if (res.deferredReason) {
        return {
          status: 'deferred',
          detail: `visual ${mode}: ${res.deferredReason}`,
          evidence: { kind: 'visual', at: at0, markers: frameMarkers(job, res) },
        };
      }
      const screenshotPath = res.screenshot;
      if (!screenshotPath) {
        throw new Error('no screenshot source for L4 (render gate still manual — supply a screenshotPath/resolver)');
      }
      const resp = await fetchImpl(`${opts.appOrigin}/api/verify/visual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: job.catalogId,
          itemId: job.entityId,
          screenshotPath,
          ...(opts.projectPath ? { projectPath: opts.projectPath } : {}),
          mode,
        }),
      });
      const env = (await resp.json().catch(() => null)) as { success?: boolean; data?: { verdict?: string; notes?: string }; error?: string } | null;
      const at = new Date().toISOString();
      // Frame-context evidence: WHAT was photographed (entity/map/scenario) travels with the verdict.
      const markers = frameMarkers(job, res);
      if (!resp.ok || !env?.success) {
        // The frame WAS captured — the AUTOMATED judge just couldn't run (bad model, no key,
        // network). A judge OUTAGE is not an observed failure, so the gate stays DEFERRED (not a
        // red `fail` that would fire a false regression). The frame is surfaced anyway so the
        // agent can judge it by eye — losing the frame on a judge hiccup defeats the loop.
        return {
          status: 'deferred',
          detail: `visual ${mode}: auto-judge unavailable (${env?.error ?? resp.status}) — frame captured for review (${screenshotPath})`,
          screenshot: screenshotPath,
          evidence: { kind: 'visual', at, screenshotPath, markers, judgeText: boundJudgeText(`auto-judge unavailable: ${env?.error ?? resp.status}`) },
        };
      }
      const verdict = env.data?.verdict === 'pass' ? 'pass' : 'fail';
      // Surface the frame the verdict was judged from so the agent can READ it — Gemini's
      // single-frame check is the gross-error floor, not the final word on quality. Evidence
      // carries the frame + the judge's notes so the flip keeps its proof.
      return {
        status: verdict,
        detail: `visual ${mode}: ${verdict} (frame: ${screenshotPath})`,
        screenshot: screenshotPath,
        evidence: { kind: 'visual', at, screenshotPath, markers, judgeText: boundJudgeText(env.data?.notes ? `${verdict}: ${env.data.notes}` : verdict) },
        raw: env.data,
      };
    },
  };
}
