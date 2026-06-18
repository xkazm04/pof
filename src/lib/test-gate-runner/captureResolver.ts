/**
 * The autonomous L4 screenshot resolver: bridges a GateJob to an autonomously
 * captured rendered frame via `ue-launch`'s `captureFrame`. This is the concrete
 * implementation of the `screenshotResolver` seam `visualExecutor` exposes —
 * closing the "render gate still manual" gap. `capture` is injectable for tests.
 */
import { captureFrame, type CaptureFrameOptions } from '@/lib/ue-launch/capture';
import type { GateJob } from './types';

export interface UeCaptureResolverConfig {
  uproject: string;
  /** Engine version for the editor binary (default 5.8). */
  engine?: string;
}

export interface UeCaptureResolverDeps {
  capture?: (opts: CaptureFrameOptions) => Promise<string | null>;
}

/**
 * The job is currently captured as a generic editor frame (per-job/per-level
 * framing is the noted follow-up via the `-game -PoFScenario` Observation Spine),
 * so it's accepted but unused — the seam is here for that future framing.
 */
export function makeUeCaptureResolver(
  cfg: UeCaptureResolverConfig,
  deps: UeCaptureResolverDeps = {},
): (job: GateJob) => Promise<string | null> {
  const capture = deps.capture ?? captureFrame;
  // 0-arg is assignable to (job) => … — the job isn't used until per-job framing lands.
  return () =>
    capture({
      uproject: cfg.uproject,
      ...(cfg.engine ? { engine: cfg.engine } : {}),
    });
}
