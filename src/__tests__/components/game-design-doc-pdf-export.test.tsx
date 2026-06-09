import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { GDDDocument } from '@/lib/gdd-synthesizer';

// setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fixture: GDDDocument = {
  title: 'Pillars of Fortune — GDD',
  generatedAt: '2026-05-28T10:00:00.000Z',
  sections: [
    { id: 'overview', title: 'Project Overview', updatedAt: '2026-05-28T10:00:00.000Z', content: 'A game.' },
  ],
  stats: {
    totalFeatures: 10, implementedFeatures: 3,
    checklistTotal: 20, checklistDone: 5,
    levelCount: 2, audioSceneCount: 4, buildCount: 6, evalFindingCount: 1,
  },
};

// Provide a ready GDD without hitting the API.
vi.mock('@/hooks/useGameDesignDoc', () => ({
  useGameDesignDoc: () => ({
    gdd: fixture,
    isLoading: false,
    error: null,
    generate: vi.fn(),
    exportMarkdown: vi.fn(),
    exportPitch: vi.fn(),
  }),
}));

import { GameDesignDocView } from '@/components/modules/evaluator/GameDesignDocView';

describe('GameDesignDocView — Export PDF', () => {
  it('opens a print window and writes the printable GDD HTML', () => {
    const writes: string[] = [];
    const fakeWin = {
      document: {
        open: vi.fn(),
        write: (s: string) => writes.push(s),
        close: vi.fn(),
      },
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);

    render(<GameDesignDocView />);
    fireEvent.click(screen.getByRole('button', { name: /Export PDF/i }));

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    const written = writes.join('');
    expect(written).toContain('<!DOCTYPE html>');
    expect(written).toContain('Pillars of Fortune — GDD');
    expect(written).toContain('Compliance Scorecard');
    expect(written).toContain('window.print()');
  });
});
