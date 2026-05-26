import { makeBridgeExecutor } from './bridgeExecutor';
import { makeSpawnExecutor } from './spawnExecutor';
import { makeVisualExecutor } from './visualExecutor';
import type { GateExecutor, GateJob } from './types';

export interface ExecutorConfig {
  /** L3 mechanism — bridge (default, running editor) or spawn (headless, gated). */
  executor?: 'bridge' | 'spawn';
  port?: number;
  allowSpawn?: boolean;
  /** Absolute origin for the L4 visual executor's /api/verify/visual call. */
  appOrigin?: string;
  projectPath?: string;
  screenshotResolver?: (job: GateJob) => Promise<string | null>;
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
    list.push(
      makeVisualExecutor({
        appOrigin: cfg.appOrigin,
        ...(cfg.projectPath ? { projectPath: cfg.projectPath } : {}),
        ...(cfg.screenshotResolver ? { screenshotResolver: cfg.screenshotResolver } : {}),
      }),
    );
  }
  return list;
}
