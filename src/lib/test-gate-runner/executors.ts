import { makeBridgeExecutor } from './bridgeExecutor';
import { makeSpawnExecutor } from './spawnExecutor';
import { makeVisualExecutor } from './visualExecutor';
import { makeUeCaptureResolver } from './captureResolver';
import type { GateExecutor, GateJob } from './types';

export interface ExecutorConfig {
  /** L3 mechanism — bridge (default, running editor) or spawn (headless, gated). */
  executor?: 'bridge' | 'spawn';
  port?: number;
  allowSpawn?: boolean;
  /** Absolute origin for the L4 visual executor's /api/verify/visual call. */
  appOrigin?: string;
  projectPath?: string;
  /** L4: an operator-supplied screenshot path. */
  screenshotPath?: string;
  visualMode?: 'hud' | 'texture' | 'lighting' | 'character';
  screenshotResolver?: (job: GateJob) => Promise<string | null>;
  /**
   * L4 AUTONOMOUS capture — when set (and no explicit resolver/path), the visual
   * gate captures its own frame via a headless UE launch (`ue-launch` captureFrame),
   * so L4 runs end-to-end with no operator. Off unless configured.
   */
  autoCapture?: { uproject: string; engine?: string };
}

/**
 * Pick the L4 screenshot resolver by precedence: explicit resolver → a trivial
 * screenshotPath resolver → an autonomous `autoCapture` resolver → undefined
 * (the L4 job stays deferred). Pure — building the autoCapture resolver does not
 * launch anything.
 */
export function selectScreenshotResolver(cfg: ExecutorConfig): ((job: GateJob) => Promise<string | null>) | undefined {
  if (cfg.screenshotResolver) return cfg.screenshotResolver;
  if (cfg.screenshotPath) return async () => cfg.screenshotPath!;
  if (cfg.autoCapture) return makeUeCaptureResolver(cfg.autoCapture);
  return undefined;
}

/** Assemble the tier-matched executor set for a drain run (one L3 + the L4 visual). */
export function buildExecutors(cfg: ExecutorConfig): GateExecutor[] {
  const list: GateExecutor[] = [];
  list.push(
    cfg.executor === 'spawn'
      ? makeSpawnExecutor({ allowSpawn: cfg.allowSpawn ?? false })
      : makeBridgeExecutor({ ...(cfg.port ? { port: cfg.port } : {}) }),
  );
  if (cfg.appOrigin) {
    // Resolver precedence (explicit → screenshotPath → autoCapture → none); with
    // autoCapture the L4 gate captures its own frame, running end-to-end autonomously.
    const resolver = selectScreenshotResolver(cfg);
    list.push(
      makeVisualExecutor({
        appOrigin: cfg.appOrigin,
        ...(cfg.projectPath ? { projectPath: cfg.projectPath } : {}),
        ...(cfg.visualMode ? { mode: cfg.visualMode } : {}),
        ...(resolver ? { screenshotResolver: resolver } : {}),
      }),
    );
  }
  return list;
}
