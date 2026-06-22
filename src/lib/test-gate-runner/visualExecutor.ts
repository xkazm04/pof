import type { GateExecutor, GateJob, GateVerdict } from './types';

type FetchImpl = typeof fetch;
type VisualMode = 'hud' | 'texture' | 'lighting' | 'character';

export interface VisualExecutorOptions {
  /** Absolute origin where /api/verify/visual lives (the runner is server-side). */
  appOrigin: string;
  fetchImpl?: FetchImpl;
  projectPath?: string;
  /** Force the Gemini check mode; else derived from the catalogId. */
  mode?: VisualMode;
  /**
   * Resolve a screenshot PNG path for a job. Autonomous capture of an arbitrary
   * entity's render isn't generically wired (the known "missing render gate"),
   * so the default resolver returns null and L4 jobs stay deferred until a
   * screenshot source is provided.
   */
  screenshotResolver?: (job: GateJob) => Promise<string | null>;
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
      const screenshotPath = await resolve(job);
      if (!screenshotPath) {
        throw new Error('no screenshot source for L4 (render gate still manual — supply a screenshotPath/resolver)');
      }
      const mode = opts.mode ?? visualModeFor(job.catalogId);
      const res = await fetchImpl(`${opts.appOrigin}/api/verify/visual`, {
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
      const env = (await res.json().catch(() => null)) as { success?: boolean; data?: { verdict?: string }; error?: string } | null;
      if (!res.ok || !env?.success) {
        // The frame WAS captured — the AUTOMATED judge just couldn't run (bad model, no key,
        // network). Surface the frame anyway (conservative status: fail, i.e. not verified-pass)
        // so the agent can judge it by eye. Losing the frame on a judge hiccup defeats the loop.
        return {
          status: 'fail',
          detail: `visual ${opts.mode ?? visualModeFor(job.catalogId)}: auto-judge unavailable (${env?.error ?? res.status}) — frame captured for review (${screenshotPath})`,
          screenshot: screenshotPath,
        };
      }
      const verdict = env.data?.verdict === 'pass' ? 'pass' : 'fail';
      // Surface the frame the verdict was judged from so the agent can READ it — Gemini's
      // single-frame check is the gross-error floor, not the final word on quality.
      return { status: verdict, detail: `visual ${mode}: ${verdict} (frame: ${screenshotPath})`, screenshot: screenshotPath, raw: env.data };
    },
  };
}
