/**
 * The autonomous L4 screenshot resolver: bridges a GateJob to an autonomously
 * captured rendered frame via `ue-launch`'s `captureScenarioFrame` (a `-game
 * -PoFScenario -RenderOffScreen` run that loads the level + spawns the player and
 * writes a real on-screen `shot_NN.png`). This is the concrete implementation of
 * the `screenshotResolver` seam `visualExecutor` exposes — closing the "render
 * gate still manual" gap with a MEANINGFUL frame. `capture` is injectable for tests.
 */
import { captureScenarioFrame, type CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';
import { resolveScenario } from './scenarioRegistry';
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
  return (job) => {
    // If a per-gate scenario is registered (e.g. the `abilities` archetype activates
    // the entity's ability), drive it so the frame shows the ACTION; else generic.
    // A GateScenario is structurally assignable to ue-launch's CaptureScenarioSpec.
    const scenario = resolveScenario({
      catalogId: job.catalogId,
      entityId: job.entityId,
      step: job.step,
      ...(job.testName ? { testName: job.testName } : {}),
    });
    return capture({
      uproject: cfg.uproject,
      ...(cfg.engine ? { engine: cfg.engine } : {}),
      ...(scenario ? { scenario } : {}),
      // Always a LIT map — wins over the scenario's (L3) map so the L4 frame isn't dark.
      map: cfg.mapFor ? cfg.mapFor(job) : '/Game/Maps/VerticalSlice',
    });
  };
}
