import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

afterEach(cleanup);

vi.mock('@/hooks/useViewportWidth', () => ({ useViewportWidth: () => 1440, useViewportAtLeast: () => true, WIDE_FALLBACK_WIDTH: 1440 }));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

import { TopBar } from '@/components/layout/TopBar';
import { useProjectStore } from '@/stores/projectStore';
import { useActivityFeedStore } from '@/stores/activityFeedStore';
import { ActivityFeedPanel } from '@/components/layout/ActivityFeedPanel';
import { EventBusDevTools } from '@/components/layout/EventBusDevTools';

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

describe('controls have accessible names', () => {
  const nameless = (root: ParentNode) => Array.from(root.querySelectorAll('button')).filter(
    (b) => !(b.textContent ?? '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'),
  );

  it('rename mode: every button is named and the field has its label', () => {
    openDropdown();
    fireEvent.click(screen.getByText('Rename Project'));
    expect(nameless(document.body)).toHaveLength(0);
    expect(screen.getByRole('textbox', { name: 'Project Name' })).toBeTruthy();
  });

  it('switcher: the close button is named', () => {
    openDropdown();
    fireEvent.click(screen.getByText('Switch Project'));
    expect(nameless(document.body)).toHaveLength(0);
  });

  it('activity feed: the close button is named', () => {
    useActivityFeedStore.setState({ events: [], isOpen: true });
    render(<ActivityFeedPanel />);
    expect(nameless(document.body)).toHaveLength(0);
  });

  it('event bus devtools: every button is named', () => {
    render(<EventBusDevTools />);
    act(() => { fireEvent.keyDown(window, { key: 'E', ctrlKey: true, shiftKey: true }); });
    expect(screen.getByText('Event Bus')).toBeTruthy();
    expect(nameless(document.body)).toHaveLength(0);
  });
});
