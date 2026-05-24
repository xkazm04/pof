import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SessionRow } from '@/components/ecw/cli/SessionRow';
import type { CLISessionState } from '@/components/cli/store/cliPanelStore';

const baseSession: CLISessionState = {
  id: 'tab-1',
  label: 'Gen Fireball',
  projectPath: null,
  claudeSessionId: null,
  currentExecutionId: null,
  currentTaskId: null,
  isRunning: false,
  lastTaskSuccess: null,
  accentColor: '#00ff88',
  createdAt: Date.now() - 60_000,
  lastActivityAt: Date.now() - 5_000,
  enabledSkills: [],
};

describe('SessionRow', () => {
  afterEach(cleanup);

  it('renders the session label', () => {
    render(<SessionRow session={baseSession} onSelect={() => {}} />);
    expect(screen.getByText('Gen Fireball')).toBeTruthy();
  });

  it('shows a running indicator when session is running', () => {
    render(<SessionRow session={{ ...baseSession, isRunning: true }} onSelect={() => {}} />);
    expect(screen.getByLabelText(/running/i)).toBeTruthy();
  });

  it('shows a success indicator when last task succeeded', () => {
    render(<SessionRow session={{ ...baseSession, lastTaskSuccess: true }} onSelect={() => {}} />);
    expect(screen.getByLabelText(/succeeded/i)).toBeTruthy();
  });

  it('shows a failed indicator when last task failed', () => {
    render(<SessionRow session={{ ...baseSession, lastTaskSuccess: false }} onSelect={() => {}} />);
    expect(screen.getByLabelText(/failed/i)).toBeTruthy();
  });

  it('shows idle indicator when no task has run yet', () => {
    render(<SessionRow session={baseSession} onSelect={() => {}} />);
    expect(screen.getByLabelText(/idle/i)).toBeTruthy();
  });

  it('invokes onSelect with session id on click', () => {
    const onSelect = vi.fn();
    render(<SessionRow session={baseSession} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Gen Fireball/ }));
    expect(onSelect).toHaveBeenCalledWith('tab-1');
  });
});
