/**
 * Deleting a canon law removes it from every produce prompt its profile writes, and the
 * store's `remove` is optimistic + fire-and-forget. One stray click on a card's Delete used to
 * do it — no confirmation, while the lab's other destructive act (entity Reset) goes through
 * the shared ConfirmDialog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { IBM_Plex_Mono: font, Inter: font, JetBrains_Mono: font };
});

import { CanonView } from '@/components/layout-lab/CanonView';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { LIGHT } from '@/components/layout-lab/theme';
import type { Result } from '@/types/result';

const remove = vi.fn(async (): Promise<Result<void, string>> => ({ ok: true, data: undefined }));
beforeEach(() => {
  remove.mockClear();
  useCanonStore.setState({
    rules: [{ id: 'pof-own', category: 'game', scope: 'global', title: 'PoF own rule', body: 'PoF only' }],
    remove, loadDrift: vi.fn(async () => {}),
  });
});
afterEach(cleanup);

describe('CanonView — deleting a law is confirmed', () => {
  it('Delete asks first; Cancel removes nothing; confirming removes the named rule', () => {
    render(<CanonView t={LIGHT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('PoF own rule');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete law' }));
    expect(remove).toHaveBeenCalledWith('pof-own');
  });
});

describe('CanonView — a refused delete is reported', () => {
  it('keeps the dialog open and names the reason', async () => {
    remove.mockResolvedValueOnce({ ok: false, error: 'db locked' });
    render(<CanonView t={LIGHT} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete law' }));
    await screen.findByText('db locked');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
