/**
 * Canon conformance linter — a PURE check that flags where a simulation (or the
 * shipped defaults feeding it) VIOLATES the ARPG-LAWS canon. Sims can silently
 * drift from the design laws (the shipped `loot-driven` economy default runs the
 * faucet hot and the sink cold, which breaks the ±15% balance law); nothing else
 * catches that. This does.
 *
 * Thresholds are READ from the canon seed (`src/lib/catalog/canon/canon-seed.ts`),
 * never hardcoded — if the canon prose changes a number, the linter follows it
 * (and `canon-conformance.test.ts` asserts the parse still resolves). This is not
 * a competing canon module: it reads the ONE seed.
 *
 * Laws checked (≥5):
 *   1. faucet/sink balance ±15%     (proj-economy)      — economy result metrics
 *   2. per-type resist cap 75%      (arpg-resists)      — defender resist values
 *   3. no one-shot ≥33% of EHP      (arpg-defenses)     — biggest hit vs EHP
 *   4. XP curve is geometric        (arpg-leveling)     — curve shape vs ~1.08^level
 *   5. price/power ratio 0.8–1.2    (proj-balance)      — item price vs power
 */

import type { ProjectRule } from '@/lib/catalog/canon/types';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import type { SimulationResult, XPCurvePoint, EconomyMetrics } from '@/types/economy-simulator';

// ── Threshold extraction (read from canon, never hardcoded) ─────────────────

export interface CanonThresholds {
  /** faucet/sink balance tolerance as a fraction (0.15 from "±15%"). */
  faucetSinkTolerance: number;
  /** per-type resist cap as a fraction (0.75 from "capped at 75%"). */
  resistCap: number;
  /** one-shot ceiling as a fraction of EHP (0.33 from "< 33% of a capped … EHP"). */
  oneShotEhpFraction: number;
  /** canon geometric XP growth base (1.08 from "≈ base × 1.08^level"). */
  xpGeometricBase: number;
  /** price/power ratio bounds ([0.8, 1.2] from "0.8–1.2×"). */
  pricePowerBounds: [number, number];
}

function ruleBody(rules: ProjectRule[], id: string): string {
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error(`canon-conformance: rule "${id}" not found in canon seed`);
  return rule.body;
}

function firstNumber(body: string, re: RegExp, ctx: string): number {
  const m = body.match(re);
  if (!m) throw new Error(`canon-conformance: could not read ${ctx} from canon prose`);
  return parseFloat(m[1]);
}

/** Parse every threshold out of the canon seed. Pure; deterministic. */
export function readCanonThresholds(rules: ProjectRule[] = CANON_SEED): CanonThresholds {
  const balance = ruleBody(rules, 'proj-balance');
  const priceLow = firstNumber(balance, /(\d+\.\d+)\s*[–-]\s*\d+\.\d+\s*×/, 'price/power lower bound');
  const priceHigh = firstNumber(balance, /\d+\.\d+\s*[–-]\s*(\d+\.\d+)\s*×/, 'price/power upper bound');
  return {
    faucetSinkTolerance: firstNumber(ruleBody(rules, 'proj-economy'), /±\s*(\d+(?:\.\d+)?)\s*%/, 'faucet/sink tolerance') / 100,
    resistCap: firstNumber(ruleBody(rules, 'arpg-resists'), /capped at (\d+(?:\.\d+)?)\s*%/, 'resist cap') / 100,
    oneShotEhpFraction: firstNumber(ruleBody(rules, 'arpg-defenses'), /<\s*(\d+(?:\.\d+)?)\s*%/, 'one-shot EHP fraction') / 100,
    xpGeometricBase: firstNumber(ruleBody(rules, 'arpg-leveling'), /(\d+\.\d+)\s*\^\s*level/, 'XP geometric base'),
    pricePowerBounds: [priceLow, priceHigh],
  };
}

// ── Violation shape ──────────────────────────────────────────────────────────

export interface CanonViolation {
  /** Canon rule id (canon-seed) that was violated. */
  lawId: string;
  /** Human-readable law title. */
  law: string;
  /** What was measured. */
  metric: string;
  /** The actual measured value. */
  actual: number;
  /** The allowed envelope, human-readable (e.g. "≤15%", "0.8–1.2"). */
  allowed: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

// ── Linter input (facets — a check runs only when its data is present) ──────

export interface CanonLintInput {
  /** Economy sim result — used for the faucet/sink balance law (its metrics). */
  economyResult?: SimulationResult;
  /** XP curve — used for the geometric-curve law. */
  xpCurve?: XPCurvePoint[];
  /** Defender per-type resist fractions (0–1) — used for the resist-cap law. */
  resists?: { type: string; value: number }[];
  /** EHP + biggest incoming non-boss hit — used for the one-shot law. */
  defense?: { ehp: number; biggestHit: number };
  /** Item price vs power pairs — used for the price/power law. */
  itemPowers?: { name: string; price: number; power: number }[];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ── Per-law checkers (each pure, each independently testable) ───────────────

/** Law 1 — faucet vs sink must balance within ±tolerance (proj-economy). */
export function checkFaucetSinkBalance(metrics: EconomyMetrics[], t: CanonThresholds): CanonViolation[] {
  if (metrics.length === 0) return [];
  const m = metrics[metrics.length - 1]; // endgame, stabilised cumulative averages
  const inflow = m.inflowPerHour;
  const outflow = m.outflowPerHour;
  const denom = Math.max(inflow, outflow, 1);
  const imbalance = Math.abs(inflow - outflow) / denom;
  if (imbalance <= t.faucetSinkTolerance) return [];
  return [{
    lawId: 'proj-economy',
    law: 'Faucet/sink balance',
    metric: 'faucet-vs-sink imbalance',
    actual: imbalance,
    allowed: `≤${pct(t.faucetSinkTolerance)}`,
    severity: imbalance > t.faucetSinkTolerance * 2 ? 'critical' : 'warning',
    message: `Faucet/sink imbalance ${pct(imbalance)} (inflow ${inflow}/hr vs sink ${outflow}/hr) exceeds the ±${pct(t.faucetSinkTolerance)} law`,
  }];
}

/** Law 2 — no per-type resist above the cap (arpg-resists). */
export function checkResistCap(resists: { type: string; value: number }[], t: CanonThresholds): CanonViolation[] {
  return resists
    .filter((r) => r.value > t.resistCap + 1e-9)
    .map((r) => ({
      lawId: 'arpg-resists',
      law: 'Resist cap',
      metric: `${r.type} resist`,
      actual: r.value,
      allowed: `≤${pct(t.resistCap)}`,
      severity: 'warning' as const,
      message: `${r.type} resist ${pct(r.value)} exceeds the ${pct(t.resistCap)} player cap`,
    }));
}

/** Law 3 — the biggest non-boss hit must stay below the one-shot EHP fraction (arpg-defenses). */
export function checkOneShot(defense: { ehp: number; biggestHit: number }, t: CanonThresholds): CanonViolation[] {
  if (defense.ehp <= 0) return [];
  const frac = defense.biggestHit / defense.ehp;
  if (frac < t.oneShotEhpFraction) return [];
  return [{
    lawId: 'arpg-defenses',
    law: 'No one-shots below the EHP floor',
    metric: 'biggest hit / EHP',
    actual: frac,
    allowed: `<${pct(t.oneShotEhpFraction)}`,
    severity: frac >= 1 ? 'critical' : 'warning',
    message: `Biggest hit is ${pct(frac)} of EHP (${defense.biggestHit}/${defense.ehp}) — at/above the ${pct(t.oneShotEhpFraction)} one-shot threshold`,
  }];
}

/**
 * Law 4 — the XP curve must grow roughly geometrically (arpg-leveling ≈1.08^level).
 * A geometric curve has a near-constant consecutive ratio; the shipped polynomial
 * `100·level^1.8` has ratios that start far above the canon base and decay — a high
 * coefficient of variation. We flag a non-geometric shape.
 */
export function checkXpCurveShape(xpCurve: XPCurvePoint[], t: CanonThresholds): CanonViolation[] {
  const xs = xpCurve.map((p) => p.xpRequired).filter((x) => x > 0);
  if (xs.length < 3) return [];
  const ratios: number[] = [];
  for (let i = 1; i < xs.length; i++) ratios.push(xs[i] / xs[i - 1]);
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const variance = ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length;
  const cov = mean > 0 ? Math.sqrt(variance) / mean : 0;
  // A true geometric curve → ratio constant → CoV ≈ 0. Tolerance 0.15.
  if (cov <= 0.15) return [];
  return [{
    lawId: 'arpg-leveling',
    law: 'XP curve is geometric',
    metric: 'consecutive-ratio coefficient of variation',
    actual: cov,
    allowed: `geometric (~${t.xpGeometricBase}^level, ~constant ratio)`,
    severity: 'warning',
    message: `XP curve is not geometric (ratio CoV ${pct(cov)}); canon wants roughly ×${t.xpGeometricBase}/level, not a polynomial`,
  }];
}

/** Law 5 — every item's price/power ratio must sit in [low, high] (proj-balance). */
export function checkPricePower(items: { name: string; price: number; power: number }[], t: CanonThresholds): CanonViolation[] {
  const [low, high] = t.pricePowerBounds;
  const out: CanonViolation[] = [];
  for (const it of items) {
    if (it.power <= 0) continue;
    const ratio = it.price / it.power;
    if (ratio >= low && ratio <= high) continue;
    out.push({
      lawId: 'proj-balance',
      law: 'Price/power ratio',
      metric: `${it.name} price/power`,
      actual: ratio,
      allowed: `${low}–${high}`,
      severity: 'info',
      message: `${it.name} price/power ratio ${ratio.toFixed(2)} is outside the ${low}–${high} balance envelope`,
    });
  }
  return out;
}

// ── Top-level linter ─────────────────────────────────────────────────────────

/**
 * Run every applicable canon check over whatever facets are present. Pure.
 * Returns each violation with its canon law id + actual-vs-allowed.
 */
export function lintCanonConformance(input: CanonLintInput, rules: ProjectRule[] = CANON_SEED): CanonViolation[] {
  const t = readCanonThresholds(rules);
  const violations: CanonViolation[] = [];
  if (input.economyResult) violations.push(...checkFaucetSinkBalance(input.economyResult.metrics, t));
  if (input.resists) violations.push(...checkResistCap(input.resists, t));
  if (input.defense) violations.push(...checkOneShot(input.defense, t));
  if (input.xpCurve) violations.push(...checkXpCurveShape(input.xpCurve, t));
  if (input.itemPowers) violations.push(...checkPricePower(input.itemPowers, t));
  return violations;
}
