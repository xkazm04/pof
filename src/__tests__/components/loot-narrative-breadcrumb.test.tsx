import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NarrativeBreadcrumb } from '@/components/modules/core-engine/sub_loot/NarrativeBreadcrumb';

afterEach(cleanup);

// The active step was marked by colour, weight and opacity only; assistive tech heard
// six identical buttons. It is a navigation trail: one aria-current step, inside a nav.
describe('Loot NarrativeBreadcrumb', () => {
  it('marks exactly the active step aria-current and sits in a named nav', () => {
    const { container } = render(<NarrativeBreadcrumb activeTab="affix" onNavigate={vi.fn()} />);
    const current = Array.from(container.querySelectorAll('button')).filter((b) => b.getAttribute('aria-current') === 'step');
    expect(current.map((b) => b.textContent)).toEqual(['Roll Affixes']);
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Loot workflow');
  });
});
