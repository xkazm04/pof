/**
 * "Copied!" was set before and regardless of the clipboard write, while every
 * other copy surface goes through the verified `copyToClipboard`.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ExtraTab } from '@/components/modules/shared/ReviewableModuleView';

vi.mock('@/components/modules/shared/ReviewableModuleView', () => ({
  ReviewableModuleView: ({ extraTabs }: { extraTabs: ExtraTab[] }) => <div>{extraTabs[0].render({} as never)}</div>,
}));

import { ImportAutomationView } from '@/components/modules/visual-gen/import-automation/ImportAutomationView';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubClipboard(writeText: () => Promise<void>) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
}

describe('ImportAutomationView copy', () => {
  it('never claims Copied! when the write is rejected', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    render(<ImportAutomationView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByText('Copy failed')).toBeTruthy());
    expect(screen.queryByText('Copied!')).toBeNull();
  });

  it('says Copied! after a verified write', async () => {
    stubClipboard(() => Promise.resolve());
    render(<ImportAutomationView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByText('Copied!')).toBeTruthy());
  });
});
