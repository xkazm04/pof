import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { CombatAbility, EnemyArchetype, GearLoadout } from '@/types/combat-simulator';
import { ScenarioBuilder } from '@/components/modules/evaluator/CombatSimulatorView/ScenarioBuilder';

// Every Scenario caption must activate or name its control: htmlFor on the two numeric
// fields (pointer label activation), a labelled group for the Abilities / Enemies sets.

afterEach(() => cleanup());

function renderBuilder() {
  const noop = vi.fn();
  return render(
    <ScenarioBuilder
      playerLevel={5} setPlayerLevel={noop}
      gearId="starter" setGearId={noop}
      gearLoadouts={[{ id: 'starter', name: 'Starter', bonuses: {} } as GearLoadout]}
      selectedAbilities={['ga-melee-attack']} setSelectedAbilities={noop}
      abilities={[{ id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee' } as CombatAbility]}
      enemySetup={[{ archetypeId: 'melee-grunt', count: 3, level: 5 }]} setEnemySetup={noop}
      enemyArchetypes={[{ id: 'melee-grunt', name: 'Grunt' } as EnemyArchetype]}
      iterations={1000} setIterations={noop}
    />,
  );
}

describe('Scenario captions are bound to their controls', () => {
  it('the Player Level and Iterations labels resolve to their inputs', () => {
    renderBuilder();
    for (const name of ['Player Level', 'Iterations']) {
      const label = screen.getByText(name) as HTMLLabelElement;
      expect(label.tagName).toBe('LABEL');
      const control = label.control as HTMLInputElement | null;
      expect(control?.tagName).toBe('INPUT');
    }
  });

  it('Abilities and Enemies are named groups, not orphan labels', () => {
    const { container } = renderBuilder();
    expect(screen.getByRole('group', { name: /^Abilities/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Enemies' })).toBeTruthy();
    const orphans = Array.from(container.querySelectorAll('label')).filter(
      (l) => !l.getAttribute('for'),
    );
    expect(orphans.length).toBe(0);
  });
});
