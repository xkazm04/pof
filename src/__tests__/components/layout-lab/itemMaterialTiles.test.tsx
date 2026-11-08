import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });

// The Material step's "Texture maps declared" tiles must be drawn from the checker's own
// REQUIRED_PBR_MAPS: a map added to the requirement is graded, so it must get a tile.
vi.mock('@/lib/catalog/acceptance/itemsBespokeCheckers', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/catalog/acceptance/itemsBespokeCheckers')>();
  return { ...real, REQUIRED_PBR_MAPS: ['Albedo', 'Normal', 'ORM', 'Roughness'] as const };
});

const { ItemMaterial } = await import('@/components/layout-lab/steps/ItemArt');
const { LIGHT } = await import('@/components/layout-lab/theme');

afterEach(cleanup);

describe('ItemMaterial map tiles', () => {
  it('shows a tile for a map the checker newly requires', () => {
    const { container } = render(
      <ItemMaterial t={LIGHT} entity={{ id: 'item-test', name: 'Iron Longsword', lifecycle: 'planned', data: {} }} step="Material / Texture" />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Roughness');
    // optional Height tile is kept beside the required ones
    expect(text).toContain('Height');
  });
});
