/**
 * The autonomous L4 screenshot resolver: bridges a GateJob to an autonomously
 * captured rendered frame via `ue-launch`'s `captureScenarioFrame` (a `-game
 * -PoFScenario -RenderOffScreen` run that loads the level + spawns the player and
 * writes a real on-screen `shot_NN.png`). This is the concrete implementation of
 * the `screenshotResolver` seam `visualExecutor` exposes — closing the "render
 * gate still manual" gap with a MEANINGFUL frame. `capture` is injectable for tests.
 */
import { captureScenarioFrame, type CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';
import type { GateJob } from './types';

export interface UeCaptureResolverConfig {
  uproject: string;
  /** Engine version for the editor binary (default 5.8). */
  engine?: string;
  /** Map to render for a given job (default '/Game/Maps/VerticalSlice'). A real -game arg. */
  mapFor?: (job: GateJob) => string;
}

export interface UeCaptureResolverDeps {
  capture?: (opts: CaptureScenarioFrameOptions) => Promise<string | null>;
}

export function makeUeCaptureResolver(
  cfg: UeCaptureResolverConfig,
  deps: UeCaptureResolverDeps = {},
): (job: GateJob) => Promise<string | null> {
  const capture = deps.capture ?? captureScenarioFrame;
  return (job) =>
    capture({
      uproject: cfg.uproject,
      ...(cfg.engine ? { engine: cfg.engine } : {}),
      ...(cfg.mapFor ? { map: cfg.mapFor(job) } : {}),
    });
}
