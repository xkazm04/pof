/**
 * The autonomous L4 screenshot resolver: bridges a GateJob to an autonomously
 * captured rendered frame via `ue-launch`'s `captureScenarioFrame` (a `-game
 * -PoFScenario -RenderOffScreen` run that loads the level + spawns the player and
 * writes a real on-screen `shot_NN.png`). This is the concrete implementation of
 * the `screenshotResolver` seam `visualExecutor` exposes — closing the "render
 * gate still manual" gap with a MEANINGFUL, ENTITY-CONTEXT frame. `capture` is
 * injectable for tests.
 *
 * **Map precedence (entity-context frames):** an explicit operator `mapFor` wins;
 * else the scenario's DECLARED map is honored (so the VLM judges the scene the
 * entity actually lives in, not a generic slice); else the lit `VerticalSlice`
 * fallback (unchanged default).
 *
 * **Repo law — capture needs a LIT map.** A dark/headless map renders a black frame
 * the VLM can't judge (see project memory: "capture needs a LIT map"). So a
 * scenario that DECLARES its own map for L4 must declare a LIT one. If the declared
 * map produces no frame (missing or unlit), the resolver DEFERS with a reason — it
 * does NOT silently fall back to VerticalSlice, which would photograph the wrong scene.
 */
import { captureScenarioFrame, type CaptureScenarioFrameOptions } from '@/lib/ue-launch/capture';
import { resolveScenario } from './scenarioRegistry';
import type { CaptureResolution, GateJob } from './types';

/** The lit default map when nothing else is declared. */
export const DEFAULT_LIT_MAP = '/Game/Maps/VerticalSlice';

export interface UeCaptureResolverConfig {
  uproject: string;
  /** Engine version for the editor binary (default 5.8). */
  engine?: string;
  /** Explicit operator override of the map for a given job — wins over the scenario's. */
  mapFor?: (job: GateJob) => string;
}

export interface UeCaptureResolverDeps {
  capture?: (opts: CaptureScenarioFrameOptions) => Promise<string | null>;
}

export function makeUeCaptureResolver(
  cfg: UeCaptureResolverConfig,
  deps: UeCaptureResolverDeps = {},
): (job: GateJob) => Promise<CaptureResolution> {
  const capture = deps.capture ?? captureScenarioFrame;
  return async (job) => {
    // If a per-gate scenario is registered (e.g. the `abilities` archetype activates the
    // entity's ability), drive it so the frame shows the ACTION; else a generic settle.
    // A GateScenario is structurally assignable to ue-launch's CaptureScenarioSpec.
    const scenario = resolveScenario({
      catalogId: job.catalogId,
      entityId: job.entityId,
      step: job.step,
      ...(job.testName ? { testName: job.testName } : {}),
    });
    // Precedence: explicit operator override → scenario-declared map → lit fallback.
    const explicit = cfg.mapFor?.(job);
    const declared = explicit ?? scenario?.map;
    const map = declared ?? DEFAULT_LIT_MAP;
    const scenarioDriven = !!scenario;

    const screenshot = await capture({
      uproject: cfg.uproject,
      ...(cfg.engine ? { engine: cfg.engine } : {}),
      ...(scenario ? { scenario } : {}),
      map,
    });

    // A DECLARED map (operator or scenario) that produced no frame → defer honestly, naming the
    // map. Never a silent VerticalSlice retry (that would judge the wrong scene). The default lit
    // slice producing nothing keeps the legacy `null` → generic "no screenshot source" path.
    if (!screenshot && declared != null) {
      return {
        screenshot: null,
        map,
        scenarioDriven,
        deferredReason: `declared map ${map} produced no frame — it may not exist or may be unlit (L4 capture needs a LIT map)`,
      };
    }
    return { screenshot, map, scenarioDriven };
  };
}
