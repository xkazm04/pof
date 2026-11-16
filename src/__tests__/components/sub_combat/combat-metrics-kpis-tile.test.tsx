import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { renderCombatMetric } from '@/components/modules/core-engine/sub_combat/metrics';
import { WEAPONS } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import { MATCHUP_TARGETS, rankForTarget } from '@/lib/combat/weapon-matchup';

// The KPIs tile carries one computed figure instead of three constant lights
// (scan-sweep 2026-11-08, ui-perfectionist): best weapon TTK against the first enemy.

afterEach(() => cleanup());

describe('KPIs feature-map tile', () => {
  it('prints the best-weapon time-to-kill from the matchup law', () => {
    const target = MATCHUP_TARGETS.find((t) => t.hp !== null)!;
    const best = rankForTarget(WEAPONS, target).rows[0];
    const { container } = render(<>{renderCombatMetric('kpis')}</>);
    expect(container.textContent).toContain(`${best.ttkSec!.toFixed(1)} s`);
    expect(container.textContent).toContain(target.name);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });
});
