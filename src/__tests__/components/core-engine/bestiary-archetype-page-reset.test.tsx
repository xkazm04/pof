/**
 * The archetype page index resets on EVERY filter change, not only when the
 * filtered count changes (scan-sweep Lane B, card bestiary-archetypes-ai).
 *
 * The real roster has no two same-dimension filter values with equal counts
 * above one page, so the roster is re-roled here: 30 melee, 30 ranged, rest
 * tank. Switching melee -> ranged keeps the count at 30 (> PAGE_SIZE 24).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ACCENT_ORANGE } from '@/lib/chart-colors';

vi.mock('@/components/modules/core-engine/sub_bestiary/_shared/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_bestiary/_shared/data')>();
  const ARCHETYPES = actual.ARCHETYPES.map((a, i) => ({
    ...a,
    role: i < 30 ? 'melee' : i < 60 ? 'ranged' : 'tank',
  }));
  return { ...actual, ARCHETYPES };
});

import { ArchetypesTab } from '@/components/modules/core-engine/sub_bestiary/archetypes/ArchetypesTab';

afterEach(cleanup);
const noop = () => {};

function renderTab() {
  return render(
    <ArchetypesTab
      featureMap={new Map()} compareIds={[]} toggleCompare={noop}
      expandedArchetype={null} toggleArchetype={noop}
      cardModifiers={{}} toggleCardModifier={noop} setCodegenMod={noop}
      radarOverlays={{}} onToggleOverlay={noop} accent={ACCENT_ORANGE}
    />,
  );
}

describe('ArchetypesTab pagination reset', () => {
  it('returns to page 1 when a filter change leaves the match count unchanged', () => {
    const { container, getByLabelText } = renderTab();
    const role = getByLabelText('Filter by role') as HTMLSelectElement;
    fireEvent.change(role, { target: { value: 'melee' } });
    expect(container.textContent).toContain('Page 1 / 2 · 30 enemies');
    fireEvent.click(getByLabelText('Next page'));
    expect(container.textContent).toContain('Page 2 / 2 · 30 enemies');
    fireEvent.change(role, { target: { value: 'ranged' } });
    expect(container.textContent).toContain('Page 1 / 2 · 30 enemies');
  });
});
