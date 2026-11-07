/**
 * ComparisonPanel must not diff a stat across incompatible scales. The roster mixes
 * combat-derived enemies (HP/Damage/Speed/Range as % of roster max) with hand-authored
 * ones (raw HP/ATK/DEF/SPD/INT); only HP is shared by both vocabularies. ArchetypeCard
 * already suppresses its pooled average tick for such labels (MIXED_SCALE_STATS); the
 * comparison panel drew a "+10 / -10" HP diff between a %-scaled and a raw enemy.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ComparisonPanel } from '@/components/modules/core-engine/sub_bestiary/archetypes/ComparisonPanel';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';

afterEach(cleanup);

const byId = (id: string) => {
  const a = ARCHETYPES.find(x => x.id === id);
  if (!a) throw new Error(`fixture archetype missing: ${id}`);
  return a;
};
const vocab = (id: string) => byId(id).stats.map(s => s.label).sort().join('|');

/** Diff badges are the spans whose title starts "vs <avg>". */
function diffBadges(container: HTMLElement, label: string) {
  return [...container.querySelectorAll<HTMLElement>('span[title^="vs "]')]
    .filter(el => el.title.endsWith(` define ${label}`) || el.title.endsWith(` defines ${label}`));
}

describe('ComparisonPanel stat scales', () => {
  it('fixtures really are on different stat vocabularies that share HP', () => {
    expect(vocab('melee-grunt')).not.toBe(vocab('rakghoul'));
    expect(byId('melee-grunt').stats.some(s => s.label === 'HP')).toBe(true);
    expect(byId('rakghoul').stats.some(s => s.label === 'HP')).toBe(true);
  });

  it('draws no HP diff between a %-of-max enemy and a raw-stat enemy', () => {
    const { container } = render(
      <ComparisonPanel enemies={[byId('melee-grunt'), byId('rakghoul')]} accent="var(--accent)" />,
    );
    expect(diffBadges(container, 'HP')).toHaveLength(0);
  });

  it('still diffs HP between two enemies on the same scale', () => {
    const { container } = render(
      <ComparisonPanel enemies={[byId('rakghoul'), byId('kinrath')]} accent="var(--accent)" />,
    );
    expect(diffBadges(container, 'HP')).toHaveLength(2);
  });
});
