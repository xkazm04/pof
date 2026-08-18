import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const fixture: GDDDocument = {
  title: 'PoF GDD',
  generatedAt: '2026-08-18T00:00:00.000Z',
  sections: [{ id: 'overview', title: 'Project Overview', updatedAt: '2026-08-18T00:00:00.000Z', content: 'Body.' }],
  stats: {
    totalFeatures: 10, implementedFeatures: 3, checklistTotal: 20, checklistDone: 5,
    levelCount: 2, audioSceneCount: 4, buildCount: 6, evalFindingCount: 1,
  },
};

const exportMarkdown = vi.fn((doc: GDDDocument) => Promise.resolve(doc ? '# md' : null));
const exportPitch = vi.fn((doc: GDDDocument) => Promise.resolve(doc ? '<html></html>' : null));
const printable = vi.fn((doc: GDDDocument) => `<!DOCTYPE html><html>${doc.title}</html>`);

vi.mock('@/lib/gdd-pitch', () => ({
  exportGDDAsPrintableHTML: (d: GDDDocument) => printable(d),
  exportGDDAsPitchHTML: () => '',
}));

vi.mock('@/hooks/useGameDesignDoc', () => ({
  useGameDesignDoc: () => ({
    gdd: fixture,
    isLoading: false,
    error: null,
    exportError: null,
    clearExportError: vi.fn(),
    generate: vi.fn(),
    exportMarkdown,
    exportPitch,
  }),
}));

import { GameDesignDocView } from '@/components/modules/evaluator/GameDesignDocView';

beforeEach(() => {
  exportMarkdown.mockClear();
  exportPitch.mockClear();
  printable.mockClear();
  // Downloads: jsdom has no object-URL support.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

function click(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('GameDesignDocView — all exports derive from ONE document instance', () => {
  it('hands .md, Pitch and PDF the very object the view renders', async () => {
    vi.spyOn(window, 'open').mockReturnValue({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
    } as unknown as Window);

    render(<GameDesignDocView />);

    await act(async () => { click(/Export \.md/i); });
    await act(async () => { click(/Export Pitch/i); });
    await act(async () => { click(/Export PDF/i); });

    // Object identity — a document changed between generate and export cannot
    // produce disagreeing artifacts, because there is only one document.
    expect(exportMarkdown.mock.calls[0][0]).toBe(fixture);
    expect(exportPitch.mock.calls[0][0]).toBe(fixture);
    expect(printable.mock.calls[0][0]).toBe(fixture);
  });

  it('sends the same instance to Copy as to the file exports', async () => {
    render(<GameDesignDocView />);
    await act(async () => { click(/Copy/i); });
    expect(exportMarkdown.mock.calls[0][0]).toBe(fixture);
  });
});

describe('GameDesignDocView — copy-feedback timers', () => {
  it('clears pending feedback timeouts on unmount', async () => {
    vi.useFakeTimers();
    const view = render(<GameDesignDocView />);

    // No clipboard in jsdom → the error-feedback timeout is armed.
    await act(async () => { click(/Copy/i); });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
