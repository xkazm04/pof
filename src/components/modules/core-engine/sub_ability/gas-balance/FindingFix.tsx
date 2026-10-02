'use client';

import { useState } from 'react';
import { Calculator, Check, Ban } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_NEUTRAL, OPACITY_10, OPACITY_40, withOpacity } from '@/lib/chart-colors';
import { yieldToEventLoop } from '@/lib/combat/simulation-engine';
import {
  applyFix, fixJobs, hasFixFor, rankFixes, formatMetric, GAS_LEVERS, SOLVE_ITERATIONS,
  type FixSolution, type FixSpec,
} from './balanceFixes';
import type { HealthFinding } from './balanceHealth';
import type { CombatantStats, SimScenario } from './data';

/** "(500→2844)" — the first stat a lever moves, when one combatant row carries it. */
function statChange(scenario: SimScenario, spec: FixSpec): string {
  const next = applyFix(scenario, spec);
  if (spec.lever === 'playerArmor') return `${scenario.player.armor}→${next.player.armor}`;
  const lever = GAS_LEVERS[spec.lever];
  const key = lever.stats[0];
  const pick = (s: SimScenario): CombatantStats | undefined =>
    lever.side === 'player' ? s.player : s.enemies.length === 1 ? s.enemies[0].stats : undefined;
  const from = pick(scenario), to = pick(next);
  return from && to ? `(${from[key]}→${to[key]})` : '';
}

function FixRow({ fix, scenario, onApply }: {
  fix: FixSolution; scenario: SimScenario; onApply: (next: SimScenario, label: string) => void;
}) {
  const spec = fix.applicable ? fix.spec : null;
  if (!spec || !fix.after) {
    return (
      <li data-testid={`fix-row-${fix.lever}`} className="flex items-start gap-1.5 text-2xs text-text-muted">
        <Ban className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: STATUS_NEUTRAL }} />
        <span><span className="font-semibold text-text">{fix.label}:</span> {fix.reason}</span>
      </li>
    );
  }
  const head = spec.lever === 'playerArmor'
    ? `${fix.label} ${statChange(scenario, spec)}`
    : `${fix.label} ×${spec.multiplier.toFixed(2)} ${statChange(scenario, spec)}`;
  const moved = fix.metric ? `${fix.metric} ${formatMetric(fix.metric, fix.before.metric)}→${formatMetric(fix.metric, fix.after.metric)}, ` : '';
  const text = `${head}: ${moved}grade ${fix.before.grade}→${fix.after.grade}`;
  return (
    <li
      data-testid={`fix-row-${fix.lever}`}
      data-multiplier={spec.lever === 'playerArmor' ? undefined : spec.multiplier}
      className="flex items-center gap-2 text-2xs text-text"
    >
      <span className="flex-1 min-w-0 font-mono" title={fix.reason}>{text}</span>
      <button
        type="button"
        onClick={() => onApply(applyFix(scenario, spec), head.trim())}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
        style={{ color: STATUS_SUCCESS, backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_10), border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_40)}` }}
      >
        <Check className="w-3 h-3" /> Apply
      </button>
    </li>
  );
}

/**
 * Solve + Apply for one Balance Health finding. Solve runs each candidate lever on
 * the seeded sim (yielding between levers), shows the measured before/after per
 * lever, and Apply hands the applied scenario to the caller — only on click, and
 * only for a lever whose solve landed.
 */
export function FindingFix({ finding, scenario, color, onApply, onSolved }: {
  finding: HealthFinding;
  scenario: SimScenario;
  color?: string;
  onApply: (next: SimScenario, label: string) => void;
  onSolved?: (findingId: string, fixes: FixSolution[]) => void;
}) {
  const [solved, setSolved] = useState<{ for: SimScenario; fixes: FixSolution[] } | null>(null);
  const [solving, setSolving] = useState(false);
  const fixes = solved?.for === scenario ? solved.fixes : null;

  if (!finding.suggestion) return null;
  if (!hasFixFor(finding.id)) {
    return <p className="text-2xs text-text-muted mt-1">Not solvable by a single stat: change it by hand and re-run.</p>;
  }

  const solve = async () => {
    setSolving(true);
    const out: FixSolution[] = [];
    for (const job of fixJobs(scenario, finding.id)) {
      await yieldToEventLoop();
      out.push(job());
    }
    const ranked = rankFixes(out);
    setSolved({ for: scenario, fixes: ranked });
    setSolving(false);
    onSolved?.(finding.id, ranked);
  };

  const accent = color ?? STATUS_SUCCESS;
  return (
    <div className="mt-1 space-y-1">
      {!fixes && (
        <button
          type="button"
          onClick={solve}
          disabled={solving}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold disabled:opacity-50"
          style={{ color: accent, backgroundColor: withOpacity(accent, OPACITY_10), border: `1px solid ${withOpacity(accent, OPACITY_40)}` }}
        >
          <Calculator className="w-3 h-3" /> {solving ? 'Solving…' : 'Solve'}
        </button>
      )}
      {fixes && (
        <>
          <ul className="space-y-1">
            {fixes.map(f => <FixRow key={f.lever} fix={f} scenario={scenario} onApply={onApply} />)}
          </ul>
          <p className="text-2xs text-text-muted">
            Measured on {SOLVE_ITERATIONS} seeded fights; best grade change first. Apply re-runs the full simulation.
          </p>
        </>
      )}
    </div>
  );
}
