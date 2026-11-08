import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

afterEach(cleanup);

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { TopBar } from '@/components/layout/TopBar';
import { useProjectStore } from '@/stores/projectStore';

beforeEach(() => {
  useProjectStore.setState({
    projectName: 'Demo', projectPath: '/demo', isSetupComplete: true, recentProjects: [],
    loadRecentProjects: vi.fn(async () => {}),
  });
});

function openDropdown() {
  render(<TopBar />);
  fireEvent.click(screen.getByRole('button', { name: 'Project: Demo' }));
}

describe('project dropdown', () => {
  it('Escape in the rename field cancels the rename and keeps the dropdown open', () => {
    openDropdown();
    fireEvent.click(screen.getByText('Rename Project'));
    const field = screen.getByRole('textbox');
    act(() => { fireEvent.keyDown(field, { key: 'Escape' }); });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Rename Project')).toBeTruthy();
  });

  it('Escape outside the field still closes the dropdown', async () => {
    openDropdown();
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    await waitFor(() => expect(screen.queryByText('Rename Project')).toBeNull());
  });
});
