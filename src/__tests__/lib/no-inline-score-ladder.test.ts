/**
 * Guard: no new inline 0-100 score ladder.
 *
 * The 0-100 score -> colour mapping lives in ONE table, `SCORE_BANDS` in
 * `@/lib/chart-colors`, read through `scoreBandToken` (4-band severity) or
 * `scoreStatusToken` / `successRateColor` (3-level ok/warn/bad). A component
 * that writes its own `x >= 70 ? STATUS_SUCCESS : x >= 40 ? STATUS_WARNING :
 * STATUS_ERROR` picks a private threshold and the same number reads a different
 * band on the next surface — five such ladders disagreed on 45 of 101 scores.
 *
 * The migrated files are held at zero; the rest of `src/components` is a
 * ratchet: BASELINE is today's debt, and the count may only go down. When you
 * burn one down, lower BASELINE in the same change.
 *
 * It is a smell test, not a parser: it matches the ternary and `if (...) return`
 * spellings whose first arm is a green token and whose second arm is
 * STATUS_WARNING, with integer thresholds in 1..100 (0-1 fractions are a
 * different scale and are not counted).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const COMPONENTS_ROOT = join(process.cwd(), 'src', 'components');

/** Remaining inline ladders under src/components. Lower it as they are migrated; never raise it. */
const BASELINE = 6;

/** Files migrated onto the host helpers, and the delegation each must keep. */
const MIGRATED: Record<string, RegExp[]> = {
  'modules/evaluator/UnifiedSummaryView/helpers.ts': [/scoreBandToken\(score\)/],
  'modules/evaluator/NexusView/NodeDeepDivePanel.tsx': [/scoreStatusToken\(node\.healthScore\)/],
  'modules/shared/RoadmapChecklist/NBABanner.tsx': [/scoreStatusToken\(pct\)/],
  'modules/evaluator/HolisticHealthView/index.tsx': [
    /scoreStatusToken\(summary\.overallCompletion\)/,
    /scoreStatusToken\(summary\.currentQualityScore\)/,
  ],
  'modules/evaluator/HolisticHealthView/PerformanceStatCard.tsx': [/scoreStatusToken\(score\)/],
  'modules/game-director/SessionDetail/CoverageView.tsx': [/scoreStatusToken\(pct\)/],
};

const GREEN = String.raw`(?:STATUS_SUCCESS|ACCENT_EMERALD|ACCENT_GREEN|STATUS_LIME)`;
const OPERAND = String.raw`[\w.()[\]?!]+`;
const TERNARY = new RegExp(
  String.raw`>=\s*(\d{1,3})\s*\?\s*${GREEN}\s*:\s*${OPERAND}\s*>=\s*(\d{1,3})\s*\?\s*STATUS_WARNING\s*:\s*(?:STATUS_ERROR|STATUS_BLOCKER)\b`,
  'g',
);
const IF_LADDER = new RegExp(
  String.raw`>=\s*(\d{1,3})\s*\)\s*return\s+${GREEN}\s*;\s*if\s*\(\s*${OPERAND}\s*>=\s*(\d{1,3})\s*\)\s*return\s+STATUS_WARNING\b`,
  'g',
);

function countLadders(src: string): number {
  return [...src.matchAll(TERNARY), ...src.matchAll(IF_LADDER)].filter((m) => {
    const hi = Number(m[1]);
    const lo = Number(m[2]);
    return hi >= 1 && hi <= 100 && lo >= 1 && lo <= 100;
  }).length;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function ladderFiles(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const full of walk(COMPONENTS_ROOT)) {
    const n = countLadders(readFileSync(full, 'utf8'));
    if (n > 0) out[relative(COMPONENTS_ROOT, full).split(sep).join('/')] = n;
  }
  return out;
}

describe('no inline 0-100 score ladders', () => {
  it('[guard] the detector recognises both spellings and ignores 0-1 fractions', () => {
    expect(countLadders('c = s >= 70 ? STATUS_SUCCESS : s >= 40 ? STATUS_WARNING : STATUS_ERROR;')).toBe(1);
    expect(countLadders('c = s >= 70\n  ? ACCENT_EMERALD\n  : s >= 40\n    ? STATUS_WARNING\n    : STATUS_ERROR;')).toBe(1);
    expect(countLadders('if (s >= 70) return STATUS_SUCCESS;\n  if (s >= 45) return STATUS_WARNING;')).toBe(1);
    expect(countLadders('c = r >= 0.7 ? STATUS_SUCCESS : r >= 0.4 ? STATUS_WARNING : STATUS_ERROR;')).toBe(0);
  });

  it('the migrated files hold zero inline ladders and delegate to the host helper', () => {
    const offenders: string[] = [];
    for (const [rel, delegations] of Object.entries(MIGRATED)) {
      const src = readFileSync(join(COMPONENTS_ROOT, rel), 'utf8');
      if (countLadders(src) > 0) offenders.push(`${rel}: inline ladder`);
      for (const d of delegations) if (!d.test(src)) offenders.push(`${rel}: missing ${d}`);
    }
    expect(offenders).toEqual([]);
  });

  it(`src/components holds at most BASELINE (${BASELINE}) inline ladders — ratchet, fails on increase`, () => {
    const files = ladderFiles();
    const total = Object.values(files).reduce((a, b) => a + b, 0);
    expect(total, `inline score ladders: ${JSON.stringify(files, null, 2)}`).toBeLessThanOrEqual(BASELINE);
  });
});
