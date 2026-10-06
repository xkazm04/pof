/**
 * Readiness route — which way a cell below R3 can be worked. Pure, no side effects.
 *
 * Rules, applied in order (first match wins):
 *   1. 'at-r3'         state is 'reached' and level is R3, R4 or R5.
 *   2. 'model-blocked' engineClass is gen2d / gen3d / audio — the producer needs a commercial or
 *                      local model.
 *   3. 'text'          engineClass is 'llm' OR judge is 'llm-panel' — the Claude engine or the
 *                      Claude judge runs through the claude CLI.
 *   4. 'model-blocked' judge is 'vlm' — the judge needs a vision model.
 *   5. 'other-gate'    everything else: UE runtime, deterministic code, packaging, human gates.
 *
 * 2026-10-07 operator boundary: text LLM through the claude CLI ONLY. Model-blocked cells are
 * recorded, never attempted. The rule is a classification, not a target — never tune it to a count.
 */
import { engineClass } from '@/lib/status/statusModel';
import type { StepFact } from '@/lib/status/statusModel';
import type { ReadinessLevel } from '@/lib/status/readiness';

export type ReadinessRoute = 'at-r3' | 'text' | 'model-blocked' | 'other-gate';

export const ROUTES: readonly ReadinessRoute[] = ['at-r3', 'text', 'model-blocked', 'other-gate'] as const;

export interface RouteInput {
  engine: string;
  judge?: StepFact['judge'];
  level: ReadinessLevel;
  state: 'reached' | 'waiting' | 'blocked';
}

export function routeOf({ engine, judge, level, state }: RouteInput): ReadinessRoute {
  if (state === 'reached' && (level === 'R3' || level === 'R4' || level === 'R5')) return 'at-r3';
  const cls = engineClass(engine);
  if (cls === 'gen2d' || cls === 'gen3d' || cls === 'audio') return 'model-blocked';
  if (cls === 'llm' || judge === 'llm-panel') return 'text';
  if (judge === 'vlm') return 'model-blocked';
  return 'other-gate';
}

export type RouteSummary = Record<ReadinessRoute, number> & { total: number };

export function summarizeRoutes(rows: readonly { route: ReadinessRoute }[]): RouteSummary {
  const out: RouteSummary = { 'at-r3': 0, text: 0, 'model-blocked': 0, 'other-gate': 0, total: 0 };
  for (const r of rows) {
    out[r.route] += 1;
    out.total += 1;
  }
  return out;
}
