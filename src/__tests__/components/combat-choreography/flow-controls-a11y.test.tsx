import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/stores/catalogStore', () => ({ useCatalogEntities: () => [] }));
vi.mock('@/hooks/useGeneration', () => ({
  useGeneration: () => ({ isRunning: false, nextStep: null, generate: () => {} }),
}));

import { LaneSection } from '@/components/modules/core-engine/sub_combat/flow/LaneSection';
import { ComboChainDiagram } from '@/components/modules/core-engine/sub_combat/flow/ComboChainDiagram';
import { LANES } from '@/components/modules/core-engine/sub_combat/_shared/data';

afterEach(cleanup);

describe('Combat flow controls expose state to assistive tech', () => {
  it('LaneSection feature rows report aria-expanded', () => {
    const lane = LANES[0];
    const { container, rerender } = render(
      <LaneSection lane={lane} featureMap={new Map()} defs={[]} expanded={null} onToggle={() => {}} />,
    );
    const rows = [...container.querySelectorAll('button')];
    expect(rows.map((b) => b.getAttribute('aria-expanded'))).toEqual(lane.featureNames.map(() => 'false'));
    rerender(<LaneSection lane={lane} featureMap={new Map()} defs={[]} expanded={lane.featureNames[0]} onToggle={() => {}} />);
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('ComboChainDiagram: pager arrows are named, page + filter chips expose current state', () => {
    const { container } = render(<ComboChainDiagram status="implemented" />);
    const buttons = [...container.querySelectorAll('button')];
    const unnamed = buttons.filter((b) => !b.getAttribute('aria-label') && !(b.textContent ?? '').trim());
    expect(unnamed).toHaveLength(0);
    const chips = buttons.filter((b) => b.getAttribute('aria-pressed') !== null);
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['All']);
    const current = buttons.filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current.map((b) => b.textContent)).toEqual(['1']);
    fireEvent.click(buttons.find((b) => b.getAttribute('aria-label') === 'Next page')!);
    expect([...container.querySelectorAll('button[aria-current="page"]')].map((b) => b.textContent)).toEqual(['2']);
  });
});
