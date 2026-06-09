import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// jsdom doesn't implement scrollIntoView — TOC clicks call it.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mermaid needs a browser layout engine jsdom lacks; mock it so the diagram falls
// back to its readable source (role="img" wrapper unaffected).
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockRejectedValue(new Error('jsdom')) },
}));

const fixture: GDDDocument = {
  title: 'PoF GDD',
  generatedAt: '2026-05-28T10:00:00.000Z',
  sections: [
    {
      id: 'overview', title: 'Project Overview', updatedAt: '2026-05-28T10:00:00.000Z',
      content: 'Body.',
      mermaid: 'graph TD; A-->B',
      subsections: [
        { id: 'sub1', title: 'Combat Loop', updatedAt: '2026-05-28T10:00:00.000Z', content: 'Sub body.' },
      ],
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

/** The section header is the "Project Overview" button that controls a panel; the
 *  TOC entry is the one that does not (it only scrolls). */
function sectionHeader() {
  return screen.getAllByRole('button', { name: /Project Overview/i }).find((b) => b.hasAttribute('aria-controls'))!;
}
function tocEntry() {
  return screen.getAllByRole('button', { name: /Project Overview/i }).find((b) => !b.hasAttribute('aria-controls'))!;
}

describe('GameDesignDocView accessibility', () => {
  it('makes a section with children a labeled disclosure that flips aria-expanded', () => {
    render(<GameDesignDocView />);
    const btn = sectionHeader();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('labels the mermaid diagram region once the section is expanded', () => {
    render(<GameDesignDocView />);
    fireEvent.click(sectionHeader());
    expect(screen.getByRole('img', { name: /Project Overview diagram/i })).toBeTruthy();
  });

  it('exposes subsections as nested disclosures', () => {
    render(<GameDesignDocView />);
    fireEvent.click(sectionHeader()); // reveal subsection
    const subBtn = screen.getByRole('button', { name: /Combat Loop/i });
    expect(subBtn.getAttribute('aria-expanded')).toBe('false');
    expect(subBtn.getAttribute('aria-controls')).toBeTruthy();
    fireEvent.click(subBtn);
    expect(subBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('marks the active TOC entry with aria-current', () => {
    render(<GameDesignDocView />);
    const toc = tocEntry();
    expect(toc.getAttribute('aria-current')).toBeNull();
    fireEvent.click(toc);
    expect(toc.getAttribute('aria-current')).toBe('true');
  });
});
