/**
 * Style-DNA distillation as a BACKGROUND JOB.
 *
 * Distilling a mood board is a vision call over N images, and since the vision chokepoint's
 * ceiling became deliberately generous (`DEFAULT_VISION_TIMEOUT_MS`, 15 minutes — the app runs
 * on one machine and waiting beats racing) the panel can no longer await it: a fifteen-minute
 * spinner with no cancel is a worse experience than the timeout it replaced.
 *
 * The fix is NOT a shorter clock for the UI — that would cut the free local eye short and
 * silently re-route to a metered one. It is this: hand the panel a job id and let it poll,
 * which is the rail `/api/visual-gen/generate` and `view-gate` already run on. This store is
 * deliberately shaped like `view-gate-job-store.ts` so there is one pattern in the codebase
 * rather than two.
 *
 * Pure orchestration over injected deps (no VLM, no SQLite), so the lifecycle is unit-testable
 * without a daemon or a database.
 */
import { getDb } from '@/lib/db';
import { distillStyleDna, type StyleDna } from './style-dna';
import { saveStyleDna, type SaveStyleDnaInput, type StyleDnaProfile } from './style-dna-db';
import type { VisionImage } from '@/lib/anim-critique/critique';

export interface StyleDnaJobSpec {
  images: VisionImage[];
  name?: string;
}

export interface StyleDnaJob {
  id: string;
  status: 'running' | 'done' | 'error';
  /** How many board images this job was given — reported so a caller can size the wait. */
  imageCount: number;
  profile?: StyleDnaProfile;
  /** The distiller's raw reply, kept for the same reason the sync route returned it. */
  raw?: string;
  /** Present only on `error`, and always with the reason. */
  error?: string;
  startedAt: number;
}

type DistilResult = { ok: true; dna: StyleDna; raw: string } | { ok: false; error: string; raw?: string };

export interface StyleDnaJobDeps {
  distil?: (images: VisionImage[]) => Promise<DistilResult>;
  save?: (input: SaveStyleDnaInput) => StyleDnaProfile;
}

// Survives a dev-server module reload, like the view-gate store — a job id handed to the panel
// must still resolve after Next re-evaluates the module under it.
const g = globalThis as unknown as { pofStyleDnaJobs?: Map<string, StyleDnaJob> };
const jobs = g.pofStyleDnaJobs ?? new Map<string, StyleDnaJob>();
if (!g.pofStyleDnaJobs) g.pofStyleDnaJobs = jobs;

function defaultName(): string {
  return `Style ${new Date().toISOString().slice(0, 10)}`;
}

/** Start a distillation (fire-and-forget). Returns the job id immediately. */
export function startStyleDnaJob(spec: StyleDnaJobSpec, deps: StyleDnaJobDeps = {}): string {
  const distil = deps.distil ?? ((images: VisionImage[]) => distillStyleDna(images) as Promise<DistilResult>);
  const save = deps.save ?? ((input: SaveStyleDnaInput) => saveStyleDna(getDb(), input));

  const id = `styledna-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job: StyleDnaJob = {
    id,
    status: 'running',
    imageCount: spec.images.length,
    startedAt: Date.now(),
  };
  jobs.set(id, job);

  void (async () => {
    try {
      const result = await distil(spec.images);
      if (!result.ok) {
        // A distiller that cannot run is an error WITH its reason, never a silently empty
        // profile — an empty profile would be injected into every later generation prompt as
        // though it meant something. This rule is carried over verbatim from the sync route.
        job.status = 'error';
        job.error = `style distillation failed: ${result.error}`;
        if (result.raw !== undefined) job.raw = result.raw;
        return;
      }
      job.profile = save({
        name: spec.name?.trim() || defaultName(),
        dna: result.dna,
        sourceImageCount: spec.images.length,
      });
      job.raw = result.raw;
      job.status = 'done';
    } catch (e) {
      // A throw anywhere — the daemon dying mid-board, the DB refusing the write — must land
      // as a terminal state. A job left `running` forever is a spinner nobody can cancel,
      // which is the exact failure this store exists to remove.
      job.status = 'error';
      job.error = e instanceof Error ? e.message : String(e);
    }
  })();

  return id;
}

export function getStyleDnaJob(id: string): StyleDnaJob | undefined {
  return jobs.get(id);
}
