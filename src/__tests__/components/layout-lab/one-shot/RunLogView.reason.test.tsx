import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { RunLogView } from '@/components/layout-lab/one-shot/RunLogView';
import { LIGHT } from '@/components/layout-lab/theme';

/**
 * A failed step's reason is the only account the run log gives of why it failed (catalog Rule 4).
 * It used to sit in a 180px single-line ellipsis with no title, so all but its first words were
 * unreachable on screen.
 */
afterEach(cleanup);

const REASON = 'Criterion not met: the Concept Brief has no pillars section, so the checker cannot grade it';

describe('RunLogView — a step reason is readable in full', () => {
  it('does not clip the reason to one line', () => {
    render(<RunLogView t={LIGHT} phase="failed" steps={[{ step: 'Concept Brief', outcome: 'fail', reason: REASON }]} />);
    const reason = screen.getByText(REASON) as HTMLElement;
    expect(reason.style.whiteSpace).not.toBe('nowrap');
    expect(reason.style.textOverflow).not.toBe('ellipsis');
    expect(reason.style.maxWidth).toBe('');
  });
});
