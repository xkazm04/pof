import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { LabJobsChip } from '@/components/layout-lab/LabJobsChip';
import { useOneShotJobStore } from '@/stores/oneShotJobStore';
import { useOneShotLabStore } from '@/stores/oneShotLabStore';

describe('LabJobsChip', () => {
  beforeEach(() => {
    localStorage.clear();
    useOneShotJobStore.getState().reset();
    useOneShotLabStore.setState({ panelOpen: false, pendingNavigation: null });
  });

  afterEach(() => cleanup());

  it('renders nothing when phase is idle', () => {
    const { container } = render(<LabJobsChip />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the analyzing label when phase is analyzing', () => {
    useOneShotJobStore.setState({ phase: 'analyzing', catalogId: 'items' });
    render(<LabJobsChip />);
    expect(screen.getByText(/Jobs · items · scanning/)).toBeTruthy();
  });

  it('shows step counter when phase is running', () => {
    useOneShotJobStore.setState({ phase: 'running', catalogId: 'spellbook', currentStepIndex: 2, totalSteps: 10 });
    render(<LabJobsChip />);
    expect(screen.getByText(/Jobs · spellbook · 3\/10/)).toBeTruthy();
  });

  it('shows done label when phase is completed', () => {
    useOneShotJobStore.setState({ phase: 'completed', catalogId: 'items' });
    render(<LabJobsChip />);
    expect(screen.getByText(/Jobs · items · ✓ done/)).toBeTruthy();
  });

  it('has aria-label for accessibility', () => {
    useOneShotJobStore.setState({ phase: 'proposing', catalogId: 'items' });
    render(<LabJobsChip />);
    expect(screen.getByLabelText('open one-shot panel')).toBeTruthy();
  });
});
