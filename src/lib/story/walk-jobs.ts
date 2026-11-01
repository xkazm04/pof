/**
 * In-memory background jobs for the walker (modelled on `src/lib/ue-experiment/job-store.ts`).
 *
 * A walk over a 10k-node graph takes seconds, so `POST /api/story/walk` never runs it inside the
 * request: `startWalkJob` registers a job and returns its id at once; the walk then runs in chunks
 * of `WALK_CHUNK` walks, yielding to the event loop (`setImmediate`) between chunks so the server
 * stays responsive and `progress` advances. Chunking never changes the result: every walk has its
 * own seeded stream (`walker.ts`).
 *
 * Module-global (survives Next dev HMR), ephemeral (nothing is persisted), and bounded: past
 * `WALK_JOB_CAP` jobs the oldest FINISHED ones are evicted. Timing lives here, never in the walker.
 */

import { randomUUID } from 'node:crypto';
import type { StoryGraph, WalkerOptions, WalkerReport } from '@/lib/story/types';
import { createWalker } from '@/lib/story/walker';
import { logger } from '@/lib/logger';

export type WalkJobState = 'queued' | 'running' | 'done' | 'failed';

export interface WalkJob {
  id: string;
  state: WalkJobState;
  graphId: string;
  project: string;
  progress: { done: number; total: number };
  report?: WalkerReport;
  error?: string;
  createdAt: number;
  finishedAt?: number;
  /** Wall-clock walk time, measured here (the walker itself has no clock). */
  durationMs?: number;
}

/** Walks per cohort when a request names none (the standard's own example size, §8). */
export const DEFAULT_WALK_SAMPLES = 2000;
/** Upper bound per cohort, so one request cannot pin the server for minutes. */
export const MAX_WALK_SAMPLES = 20000;
/** Walks per chunk between event-loop yields. */
export const WALK_CHUNK = 50;
/** Jobs kept in memory; past this, the oldest finished jobs are evicted. */
export const WALK_JOB_CAP = 50;

const g = globalThis as unknown as { pofStoryWalkJobs?: Map<string, WalkJob> };
const jobs = g.pofStoryWalkJobs ?? new Map<string, WalkJob>();
if (!g.pofStoryWalkJobs) g.pofStoryWalkJobs = jobs;

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function evict(): void {
  if (jobs.size <= WALK_JOB_CAP) return;
  const finished = [...jobs.values()]
    .filter((j) => j.state === 'done' || j.state === 'failed')
    .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0));
  for (const j of finished) {
    if (jobs.size <= WALK_JOB_CAP) break;
    jobs.delete(j.id);
  }
}

async function run(job: WalkJob, graph: StoryGraph, opts: WalkerOptions): Promise<void> {
  await tick(); // the request returns before any walking starts
  const t0 = performance.now();
  try {
    job.state = 'running';
    const walker = createWalker(graph, opts);
    job.progress = { done: 0, total: walker.total };
    while (walker.done() < walker.total) {
      walker.run(WALK_CHUNK);
      job.progress = { done: walker.done(), total: walker.total };
      await tick();
    }
    job.report = walker.report();
    job.state = 'done';
  } catch (e) {
    job.error = e instanceof Error ? e.message : String(e);
    job.state = 'failed';
    logger.warn(`[story/walk] job ${job.id} failed: ${job.error}`);
  } finally {
    job.durationMs = Math.round((performance.now() - t0) * 100) / 100;
    job.finishedAt = Date.now();
    evict();
  }
}

/** Register a walk and start it in the background. Returns the job at once (state `queued`). */
export function startWalkJob(graph: StoryGraph, opts: WalkerOptions): WalkJob {
  const job: WalkJob = {
    id: `walk-${randomUUID()}`,
    state: 'queued',
    graphId: graph.graphId,
    project: graph.project,
    progress: { done: 0, total: opts.samples * Math.max(1, opts.cohorts?.length ?? 1) },
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  evict();
  void run(job, graph, opts);
  return job;
}

export function getWalkJob(id: string): WalkJob | undefined {
  return jobs.get(id);
}

/** Test seam: forget every job. */
export function clearWalkJobs(): void {
  jobs.clear();
}
