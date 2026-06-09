import { describe, it, expect, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { EvaluatorModule } from '@/components/modules/evaluator/EvaluatorModule';
import { EVALUATOR_TAB_INFO, EVALUATOR_SECTIONS } from '@/lib/evaluator/tab-glossary';

// jsdom lacks ResizeObserver, which the ScrollableTabBar observes on mount.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// setup.ts has no afterEach(cleanup) and shares one localStorage across tests.
afterEach(cleanup);
beforeEach(() => {
  localStorage.removeItem('pof-evaluator-coachmark-dismissed');
  mockFetch({ body: { success: true, data: {} } });
});

describe('EvaluatorModule plain-language layer', () => {
  it('shows the active tab’s plain alias + description subtitle (default: Overview)', () => {
    render(<EvaluatorModule />);
    const desc = screen.getByTestId('evaluator-active-tab-desc');
    expect(desc.textContent).toContain(EVALUATOR_TAB_INFO.overview.plain);
    expect(desc.textContent).toContain(EVALUATOR_TAB_INFO.overview.description);
  });

  it('renders the first-run coachmark explaining each section on first visit', () => {
    render(<EvaluatorModule />);
    expect(screen.getByRole('note', { name: 'What the evaluator tabs mean' })).toBeTruthy();
    for (const section of EVALUATOR_SECTIONS) {
      expect(screen.getByText(section.blurb)).toBeTruthy();
    }
  });

  it('keeps the cryptic short names as the chip labels', () => {
    render(<EvaluatorModule />);
    // The chip text stays "Nexus"/"Oracle" (character preserved); the plain alias
    // lives in the tooltip + subtitle, not the chip.
    expect(screen.getByRole('tab', { name: /nexus/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /oracle/i })).toBeTruthy();
  });
});
