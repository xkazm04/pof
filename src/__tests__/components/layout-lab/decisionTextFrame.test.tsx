/** A text frame (a lane's TTK table) is read on first open, not on mount, and a failed read says why. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock', variable: 'font-var' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { DecisionMediaItem } from '@/components/layout-lab/game/decisions/decisionMedia';
import { LIGHT } from '@/components/layout-lab/theme';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const media = { kind: 'text' as const, name: 'ttk.md', url: '/api/x/media?ask=a&opt=A&n=0' };

describe('DecisionMediaItem text frame', () => {
  it('fetches the table only when opened, then shows it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('| pistol | 0.08 |') });
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<DecisionMediaItem t={LIGHT} media={media} />);
    expect(fetchMock).not.toHaveBeenCalled();
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(screen.getByTestId('decision-text').textContent).toBe('| pistol | 0.08 |'));
    expect(fetchMock).toHaveBeenCalledWith(media.url);
  });

  it('says why when the file cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { container } = render(<DecisionMediaItem t={LIGHT} media={media} />);
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(container.textContent).toContain('HTTP 404'));
  });
});
