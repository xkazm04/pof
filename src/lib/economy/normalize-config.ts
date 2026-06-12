import type { SimulationConfig } from '@/types/economy-simulator';

/**
 * Coerce a client-supplied numeric config field to a finite integer within [min, max].
 * The server is the real trust boundary: the UI's `min=` attrs are bypassable (curl,
 * replayed requests, the load-run re-simulate path, or stored runs predating a clamp).
 * Without a lower bound + NaN guard, `agentCount: 0` reaches the engine and divides
 * `0/0`, poisoning every metric and the emitted UE5 C++ with NaN/undefined.
 */
export function clampConfigInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/**
 * Normalize a raw client config — the single source of truth for EVERY
 * `runSimulation` entry point (`simulate`, `generate-code`'s re-simulate
 * branch, and the `/sweep` route). Clamping at one call site and not the
 * others reopens the NaN-codegen hole, and the sweep route amplifies an
 * oversized config 31× (1 + 2×15 full simulations per request).
 */
export function normalizeSimulationConfig(raw: unknown): SimulationConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;
  const seed = Number(cfg.seed);
  return {
    agentCount: clampConfigInt(cfg.agentCount, 1, 500, 100),
    maxLevel: clampConfigInt(cfg.maxLevel, 1, 100, 25),
    maxPlayHours: clampConfigInt(cfg.maxPlayHours, 1, 200, 80),
    philosophy: (cfg.philosophy as SimulationConfig['philosophy']) ?? 'loot-driven',
    seed: Number.isFinite(seed) ? seed : Math.floor(Math.random() * 999999),
    flowOverrides: cfg.flowOverrides as SimulationConfig['flowOverrides'],
    itemOverrides: cfg.itemOverrides as SimulationConfig['itemOverrides'],
  };
}
