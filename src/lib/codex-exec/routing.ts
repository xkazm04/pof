/**
 * Which Codex model and reasoning effort a delegated task gets.
 *
 * The operator's policy (2026-09-22), as tiers:
 *  - `bulk`    — high volume, low-to-medium complexity → GPT-5.6-Sol at low/medium effort.
 *  - `complex` — harder engineering → GPT-5.6-Sol at HIGH effort (xhigh when marked hardest).
 *  - `visual`  — understanding or designing 2D images / 3D models → GPT-6-Astra.
 *
 * Treat the `visual` tier as a hypothesis the loop measures, not a settled fact: a 2026-09-07
 * research run found Astra's "best at 3D" claim resting on one vendor benchmark that the
 * runtime-verified GameEngineBench inverts. Its image READING was verified live on 2026-09-22
 * (correct genre call on a real PoF icon, one feature misread). The ledger's per-tier
 * acceptance rate is what should move this table, not the table's own say-so.
 *
 * Slugs are the ones `codex debug models` lists on this account (codex-cli 0.155.1).
 */

export type CodexTier = 'bulk' | 'complex' | 'visual';
export type CodexEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface CodexRoute {
  model: string;
  effort: CodexEffort;
  why: string;
}

export const CODEX_MODELS = { sol: 'gpt-5.6-sol', astra: 'gpt-6-astra' } as const;

export interface RouteHints {
  /** bulk only: the task is trivially mechanical (rename, fixture, one-line mapping). */
  trivial?: boolean;
  /** complex only: the hardest class — cross-module design, subtle invariants. */
  hardest?: boolean;
  /** visual only: the task DESIGNS (writes a prompt/spec/geometry), not just reads an image. */
  design?: boolean;
}

export function routeTask(tier: CodexTier, hints: RouteHints = {}): CodexRoute {
  switch (tier) {
    case 'bulk':
      return hints.trivial
        ? { model: CODEX_MODELS.sol, effort: 'low', why: 'bulk, mechanical' }
        : { model: CODEX_MODELS.sol, effort: 'medium', why: 'bulk, low-to-medium complexity' };
    case 'complex':
      return hints.hardest
        ? { model: CODEX_MODELS.sol, effort: 'xhigh', why: 'complex, hardest class' }
        : { model: CODEX_MODELS.sol, effort: 'high', why: 'complex' };
    case 'visual':
      return hints.design
        ? { model: CODEX_MODELS.astra, effort: 'high', why: '2D/3D design' }
        : { model: CODEX_MODELS.astra, effort: 'medium', why: '2D/3D understanding' };
  }
}
