import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CooldownFlow } from '@/components/modules/core-engine/sub_ability/abilities/CooldownFlow';
import { CooldownWheel } from '@/components/modules/core-engine/sub_ability/abilities/CooldownWheel';
import { SpellbookDataCtx, useSpellbookData } from '@/components/modules/core-engine/sub_ability/_shared/context';
import type { SpellbookCooldownRow, SpellbookLiveData } from '@/components/modules/core-engine/sub_ability/_shared/types';

/**
 * Acceptance (component half) for scan-sweep --challenge card ability-spellbook-core/A:
 * Cooldown Flow survives an empty or shrinking live list, and a live-only ability
 * (cooldown authored in a GE blueprint, not the catalog) never draws a NaN wheel.
 */

afterEach(cleanup);

const row = (i: number, cd: number | null = i): SpellbookCooldownRow => ({
  id: `row-${i}`, name: `Ability ${i}`, cd, color: 'var(--text)',
});

function Harness({ rows }: { rows: SpellbookCooldownRow[] }) {
  const base = useSpellbookData();
  const value: SpellbookLiveData = { ...base, COOLDOWN_ABILITIES: rows };
  return (
    <SpellbookDataCtx.Provider value={value}>
      <CooldownFlow />
    </SpellbookDataCtx.Provider>
  );
}

describe('CooldownWheel / CooldownFlow — honest cooldowns', { timeout: 30_000 }, () => {
  it('case 2 (wheel): cd null renders "CD in GE" and no NaN in strokeDashoffset', () => {
    const { container } = render(<CooldownWheel ability={row(1, null)} maxCd={8} index={0} />);
    expect(screen.getByText('CD in GE')).toBeTruthy();
    const offsets = Array.from(container.querySelectorAll('circle'))
      .map((c) => c.getAttribute('stroke-dashoffset'))
      .filter((v): v is string => v !== null);
    expect(offsets.length).toBeGreaterThan(0);
    for (const v of offsets) expect(v).not.toMatch(/NaN/);
  });

  it('case 8: empty list shows an empty state; a stale selection clamps to the last row', () => {
    const { rerender } = render(<Harness rows={[]} />);
    expect(screen.getByTestId('cooldown-flow-empty')).toBeTruthy();

    rerender(<Harness rows={[row(1), row(2), row(3), row(4)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ability 4' }));
    expect(screen.getByTestId('cooldown-detail').textContent).toContain('Ability 4');

    expect(() => rerender(<Harness rows={[row(1), row(2)]} />)).not.toThrow();
    const detail = screen.getByTestId('cooldown-detail').textContent ?? '';
    expect(detail).toContain('Ability 2');
    expect(detail).not.toMatch(/NaN|undefined/);
  });

  it('highlights the overview wheel matching the selected ability, and only that one', () => {
    const { container } = render(<Harness rows={[row(1), row(2), row(3)]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ability 2' }));

    const selectedWheels = container.querySelectorAll('[data-selected="true"]');
    expect(selectedWheels.length).toBe(1);
    expect(selectedWheels[0].textContent).toContain('Ability 2');
  });
});
