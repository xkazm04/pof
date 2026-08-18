import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EnemySourcePanel } from '@/components/modules/core-engine/sub_character/simulator/predictive/EnemySourcePanel';
import {
  hydrateEnemyRegistryFromBestiary,
  HARDCODED_ENEMY_SOURCE,
} from '@/lib/combat/simulation-engine';

afterEach(cleanup);

describe('EnemySourcePanel — the simulator never presents fixtures as authored content', () => {
  it('says the run used the hardcoded fixtures when nothing hydrated', () => {
    const { container } = render(<EnemySourcePanel provenance={HARDCODED_ENEMY_SOURCE} />);
    expect(container.querySelector('[data-enemy-source="hardcoded"]')).not.toBeNull();
    expect(container.textContent).toContain('hardcoded defaults');
    expect(container.textContent).toContain('FIXTURES');
  });

  it('names every bestiary row the adapter refused, with its reason', () => {
    const { provenance } = hydrateEnemyRegistryFromBestiary([
      {
        entityId: 'bestiary-brute',
        name: 'Stone Brute',
        artifacts: [{ step: 'Stat Block', data: { stats: { health: 400, damage: 30, armor: 20 } } }],
      },
      {
        entityId: 'bestiary-wraith',
        artifacts: [{ step: 'Stat Block', data: { stats: { health: 100 } } }],
      },
    ]);
    const { container } = render(<EnemySourcePanel provenance={provenance} />);
    expect(container.querySelector('[data-enemy-source="mixed"]')).not.toBeNull();
    const skipped = container.querySelector('[data-skipped-entity="bestiary-wraith"]');
    expect(skipped).not.toBeNull();
    expect(skipped!.textContent).toContain('Stat Block');
  });

  it('surfaces a catalog read failure rather than pretending the fixtures are the catalog', () => {
    const { container } = render(
      <EnemySourcePanel provenance={HARDCODED_ENEMY_SOURCE} error="bestiary read exploded" />,
    );
    expect(container.textContent).toContain('bestiary read exploded');
    expect(container.textContent).toContain('hardcoded fixtures');
  });
});
