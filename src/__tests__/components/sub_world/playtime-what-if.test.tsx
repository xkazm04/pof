import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PlaytimeBudgetTargeter } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeBudgetTargeter';
import { PlaytimeTopologyOverlay } from '@/components/modules/core-engine/sub_world/playtime/PlaytimeTopologyOverlay';
import { STATIC_WORLD } from '@/components/modules/core-engine/sub_world/_shared/data';
import { applyLevers, type WorldLever } from '@/lib/world/playtime-scenario';
import { formatPlaytime, DEFAULT_PLAYTIME_COSTS } from '@/lib/world/world-model';

describe('PlaytimeBudgetTargeter — Try / Undo a lever', () => {
  it('Try dispatches the structured lever; applied, the verdict shows the delta vs baseline and the button reads Undo', () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <PlaytimeBudgetTargeter mode="critical" world={STATIC_WORLD} baseline={STATIC_WORLD} applied={[]} dispatch={dispatch} />,
    );
    // 45 min target: Bandit Camp (3 of 10 level-span units on the binding chain) is over its 13m 30s budget.
    fireEvent.change(screen.getByLabelText('Target minutes'), { target: { value: '45' } });

    const row = screen.getByTestId('playtime-zone-z4');
    fireEvent.click(within(row).getAllByRole('button', { name: /^Try/ })[0]);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'toggle', lever: expect.objectContaining({ zoneId: 'z4', kind: 'enemies' }),
    });

    const lever = dispatch.mock.calls[0][0].lever as WorldLever;
    const savesSec = -lever.amount * DEFAULT_PLAYTIME_COSTS.secPerEnemy;
    rerender(
      <PlaytimeBudgetTargeter
        mode="critical" world={applyLevers(STATIC_WORLD, [lever])} baseline={STATIC_WORLD}
        applied={[lever]} dispatch={dispatch}
      />,
    );
    expect(screen.getByTestId('playtime-vs-baseline').textContent).toContain(formatPlaytime(Math.abs(savesSec)));
    const undo = within(screen.getByTestId('playtime-zone-z4')).getAllByRole('button', { name: /^Undo/ })[0];
    expect(undo.textContent).toBe('Undo');
  });
});

describe('PlaytimeTopologyOverlay — baseline total', () => {
  it('[guard] with no levers applied the critical total reads 47m 43s, as today', () => {
    render(<PlaytimeTopologyOverlay mode="critical" onModeChange={() => {}} world={STATIC_WORLD} />);
    expect(formatPlaytime(2863.4)).toBe('47m 43s');
    expect(screen.getByText('47m 43s', { selector: 'span.font-bold' })).toBeTruthy();
  });
});
