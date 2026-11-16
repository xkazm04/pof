/**
 * Stat comparability has ONE derivation (scan-sweep Lane B, card
 * bestiary-archetypes-ai). ArchetypeCard and ComparisonPanel used to each build
 * the stat vocabulary by hand; both now read src/lib/bestiary/stat-vocabulary.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArchetypeCard } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypeCard';
import { ARCHETYPES } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import { statVocabulary, sameStatScale, mixedScaleStatLabels } from '@/lib/bestiary/stat-vocabulary';

afterEach(cleanup);

const SRC = join(process.cwd(), 'src/components/modules/core-engine/sub_bestiary/archetypes');

describe('stat vocabulary helper', () => {
  const pct = { stats: [{ label: 'HP' }, { label: 'Damage' }] };
  const raw = { stats: [{ label: 'HP' }, { label: 'ATK' }] };

  it('names a vocabulary order-independently', () => {
    expect(statVocabulary({ stats: [{ label: 'HP' }, { label: 'ATK' }] })).toBe('ATK|HP');
    expect(statVocabulary({ stats: [{ label: 'ATK' }, { label: 'HP' }] })).toBe('ATK|HP');
  });

  it('compares scales and flags only the shared label as mixed', () => {
    expect(sameStatScale(pct, raw)).toBe(false);
    expect(sameStatScale(pct, pct)).toBe(true);
    expect([...mixedScaleStatLabels([pct, raw])]).toEqual(['HP']);
    expect(mixedScaleStatLabels([pct, pct]).size).toBe(0);
  });

  it('the real roster mixes only HP', () => {
    expect([...mixedScaleStatLabels(ARCHETYPES)]).toEqual(['HP']);
  });
});

describe('one derivation, two consumers', () => {
  it('neither component re-derives the vocabulary by hand', () => {
    for (const f of ['ArchetypeCard.tsx', 'ComparisonPanel.tsx']) {
      const src = readFileSync(join(SRC, f), 'utf-8');
      expect(src, f).not.toMatch(/\.sort\(\)\s*\.join\(/);
      expect(src, f).toContain('@/lib/bestiary/stat-vocabulary');
    }
  });

  it('ArchetypeCard draws no average tick on HP', () => {
    const arch = ARCHETYPES.find(a => a.id === 'melee-grunt')!;
    const { container } = render(
      <ArchetypeCard archetype={arch} featureMap={new Map()} expanded={false} onToggle={() => {}}
        activeModifiers={[]} onToggleModifier={() => {}} onViewCodegen={() => {}} />,
    );
    const hp = [...container.querySelectorAll('[title*="avg" i]')].filter(el => /HP/.test(el.getAttribute('title') ?? ''));
    expect(hp).toHaveLength(0);
  });
});
