/**
 * What changed since a scenario's previous run — derived from its retained,
 * report-graded run history (newest first), never stored.
 *
 *   no runs                         -> never-run
 *   one run, or both last two pass  -> steady-pass
 *   last two both not passing       -> steady-fail   (failed and error both count as not passing)
 *   passing -> not passing          -> regressed
 *   not passing -> passing          -> fixed
 *
 * `afterEdit` says the scenario's definition (description + stimuli + expected
 * actions) changed between the two runs, separating "my edit changed the
 * expectation" from "my BT change broke it".
 *
 * There is deliberately no "flaky" kind: a pass/fail flip on an unchanged
 * scenario definition is not evidence of non-determinism, because the BT/C++
 * under test is not fingerprinted — the designer's ordinary break/fix loop
 * produces exactly that pattern. Pure; client-safe.
 */
import type { ScenarioRunRecord, TestScenario } from '@/types/ai-testing';

export type TrendKind = 'never-run' | 'steady-pass' | 'steady-fail' | 'regressed' | 'fixed';

export interface ScenarioTrend {
  kind: TrendKind;
  afterEdit: boolean;
}

export interface TrendSummary {
  regressed: number;
  fixed: number;
}

type TrendInput = Pick<ScenarioRunRecord, 'status' | 'definitionHash'>;

export function classifyTrend(history: readonly TrendInput[] | undefined): ScenarioTrend {
  const [latest, previous] = history ?? [];
  if (!latest) return { kind: 'never-run', afterEdit: false };
  const nowPass = latest.status === 'passed';
  if (!previous) return { kind: nowPass ? 'steady-pass' : 'steady-fail', afterEdit: false };
  const wasPass = previous.status === 'passed';
  const afterEdit = latest.definitionHash !== previous.definitionHash;
  if (wasPass && !nowPass) return { kind: 'regressed', afterEdit };
  if (!wasPass && nowPass) return { kind: 'fixed', afterEdit };
  return { kind: nowPass ? 'steady-pass' : 'steady-fail', afterEdit };
}

export function summarizeTrends(scenarios: readonly Pick<TestScenario, 'history'>[]): TrendSummary {
  const out: TrendSummary = { regressed: 0, fixed: 0 };
  for (const s of scenarios) {
    const { kind } = classifyTrend(s.history);
    if (kind === 'regressed') out.regressed += 1;
    else if (kind === 'fixed') out.fixed += 1;
  }
  return out;
}

/** Stable FNV-1a (32-bit, hex) of what a run grades a scenario against. */
export function scenarioDefinitionHash(
  def: Pick<TestScenario, 'description' | 'stimuli' | 'expectedActions'>,
): string {
  const text = JSON.stringify([def.description, def.stimuli, def.expectedActions]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
