/**
 * Named harness scenarios — curated `ModuleArea` sets that swap in for the
 * auto-generated registry plan. Shared so EVERY control surface (CLI
 * `run-harness.ts`, HTTP `POST /api/harness`, MCP `pof_harness_start`) selects
 * from the SAME map instead of the CLI owning it privately.
 *
 * Adding an entry here makes `--scenario <name>` (CLI) and `scenario: <name>`
 * (API/MCP) real everywhere at once.
 */

import type { ModuleArea } from './types';
import { UI_OVERHAUL_AREAS, UI_OVERHAUL_SUMMARY } from './ui-overhaul-areas';
import { CONTENT_OVERHAUL_AREAS, CONTENT_OVERHAUL_SUMMARY } from './content-overhaul-areas';

export interface ScenarioDef {
  /** Human-readable name shown when the scenario loads. */
  label: string;
  /** Curated areas fed to the orchestrator as `config.areas`. */
  areas: ModuleArea[];
  /** Per-phase area counts, printed as a breakdown on load. */
  phases: Array<{ label: string; count: number }>;
  /** Total area count (== areas.length). */
  total: number;
}

export const SCENARIOS: Record<string, ScenarioDef> = {
  'ui-overhaul': {
    label: 'UI Overhaul',
    areas: UI_OVERHAUL_AREAS,
    phases: [
      { label: 'Phase 0 — Infrastructure', count: UI_OVERHAUL_SUMMARY.phase0_infrastructure },
      { label: 'Phase 1 — Feature Metrics', count: UI_OVERHAUL_SUMMARY.phase1_featureMetrics },
      { label: 'Phase 2 — Scaling', count: UI_OVERHAUL_SUMMARY.phase2_scaling },
      { label: 'Phase 3 — Flow Redesign', count: UI_OVERHAUL_SUMMARY.phase3_flow },
      { label: 'Phase 4 — Visual Polish', count: UI_OVERHAUL_SUMMARY.phase4_visual },
      { label: 'Phase 5 — Integration', count: UI_OVERHAUL_SUMMARY.phase5_integration },
    ],
    total: UI_OVERHAUL_SUMMARY.total,
  },
  'content-overhaul': {
    label: 'Content Overhaul',
    areas: CONTENT_OVERHAUL_AREAS,
    phases: [
      { label: 'Phase 0 — Infrastructure', count: CONTENT_OVERHAUL_SUMMARY.phase0_infrastructure },
      { label: 'Phase 1 — Animations', count: CONTENT_OVERHAUL_SUMMARY.phase1_animations },
      { label: 'Phase 1 — Audio', count: CONTENT_OVERHAUL_SUMMARY.phase1_audio },
      { label: 'Phase 1 — Level Design', count: CONTENT_OVERHAUL_SUMMARY.phase1_level },
      { label: 'Phase 1 — Materials', count: CONTENT_OVERHAUL_SUMMARY.phase1_materials },
      { label: 'Phase 1 — Models', count: CONTENT_OVERHAUL_SUMMARY.phase1_models },
      { label: 'Phase 1 — UI/HUD', count: CONTENT_OVERHAUL_SUMMARY.phase1_uihud },
      { label: 'Phase 2 — Audit', count: CONTENT_OVERHAUL_SUMMARY.phase2_audit },
    ],
    total: CONTENT_OVERHAUL_SUMMARY.total,
  },
};

/** Available scenario names, for validation + error messages. */
export function scenarioNames(): string[] {
  return Object.keys(SCENARIOS);
}
