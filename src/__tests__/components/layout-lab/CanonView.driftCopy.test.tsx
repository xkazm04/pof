/**
 * The Canon drift banner counted with a fixed plural ("1 laws changed upstream…") and a
 * hedge ("1 adopted law(s) can still be undone"). The count is known, so the noun agrees.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { IBM_Plex_Mono: font, Inter: font, JetBrains_Mono: font };
});

import { CanonView } from '@/components/layout-lab/CanonView';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(cleanup);

const finding = (id: string) => ({ id }) as never;

function renderWithDrift(changed: number, adopted: number) {
  useCanonStore.setState({
    rules: [],
    loadDrift: vi.fn(async () => {}),
    drift: {
      byProfile: { pof: changed ? { changed: Array.from({ length: changed }, (_, i) => finding(`r${i}`)) } : {} },
      adopted: Array.from({ length: adopted }, (_, i) => ({ profile: 'pof', id: `a${i}` })),
    } as never,
  });
  render(<CanonView t={LIGHT} />);
  return screen.getAllByRole('status').map((s) => s.textContent ?? '').join(' ');
}

describe('CanonView drift banner agrees in number', () => {
  it('one changed law reads singular', () => {
    const text = renderWithDrift(1, 0);
    expect(text).toContain('1 law changed upstream');
    expect(text).not.toContain('1 laws');
  });

  it('several changed laws read plural', () => {
    expect(renderWithDrift(3, 0)).toContain('3 laws changed upstream');
  });

  it('one undoable adoption reads singular, without a (s) hedge', () => {
    const text = renderWithDrift(0, 1);
    expect(text).toContain('1 adopted law can still be undone');
    expect(text).not.toContain('law(s)');
  });

  it('several undoable adoptions read plural', () => {
    expect(renderWithDrift(0, 2)).toContain('2 adopted laws can still be undone');
  });
});
