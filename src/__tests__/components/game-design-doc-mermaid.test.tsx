import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useNavigationStore } from '@/stores/navigationStore';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  useNavigationStore.setState({ activeCategory: null, activeSubModule: null });
});

// Mermaid resolves to an SVG carrying one architecture node so click-to-jump is exercised.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg id="g"><g class="node" id="flowchart-arpg_combat-1"><text>Combat</text></g></svg>',
    }),
  },
}));

const fixture: GDDDocument = {
  title: 'PoF GDD',
  generatedAt: '2026-05-28T10:00:00.000Z',
  sections: [
    {
      id: 'core-systems', title: 'Core Systems', updatedAt: '2026-05-28T10:00:00.000Z',
      content: 'Overview.',
      mermaid: 'graph TD\n    arpg_combat["Combat"]',
    },
  ],
  stats: {
    totalFeatures: 10, implementedFeatures: 3, checklistTotal: 20, checklistDone: 5,
    levelCount: 2, audioSceneCount: 4, buildCount: 6, evalFindingCount: 1,
  },
};

vi.mock('@/hooks/useGameDesignDoc', () => ({
  useGameDesignDoc: () => ({
    gdd: fixture, isLoading: false, error: null,
    generate: vi.fn(), exportMarkdown: vi.fn(), exportPitch: vi.fn(),
  }),
}));

import { GameDesignDocView } from '@/components/modules/evaluator/GameDesignDocView';

function sectionHeader() {
  return screen.getAllByRole('button', { name: /Core Systems/i }).find((b) => b.hasAttribute('aria-controls'))!;
}

describe('GameDesignDocView — live architecture diagram', () => {
  it('navigates to the module when an architecture node is clicked', async () => {
    const { container } = render(<GameDesignDocView />);
    fireEvent.click(sectionHeader()); // expand to mount the diagram

    await waitFor(() => expect(container.querySelector('.node')).toBeTruthy());
    const node = container.querySelector('.node') as HTMLElement;
    expect(node.getAttribute('role')).toBe('button'); // module nodes are interactive

    fireEvent.click(node);
    expect(useNavigationStore.getState().activeSubModule).toBe('arpg-combat');
  });

  it('renders the architecture diagram region as an interactive group with a hint', async () => {
    render(<GameDesignDocView />);
    fireEvent.click(sectionHeader());
    expect(await screen.findByText(/Click a system to open its module/i)).toBeTruthy();
    expect(screen.getByRole('group', { name: /Core Systems diagram/i })).toBeTruthy();
  });
});
