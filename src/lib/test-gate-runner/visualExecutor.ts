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
        throw new Error(`verify/visual failed: ${env?.error ?? res.status}`);
      }
      const verdict = env.data?.verdict === 'pass' ? 'pass' : 'fail';
      return { status: verdict, detail: `visual ${mode}: ${verdict}`, raw: env.data };
    },
  };
}
