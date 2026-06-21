import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Bridge connection is a side effect we don't exercise here.
vi.mock('@/hooks/usePofBridge', () => ({ usePofBridge: () => {} }));
vi.mock('@/components/layout-lab/LayoutLab', () => ({ LayoutLab: () => <div data-testid="layout-lab" /> }));
vi.mock('@/components/modules/project-setup/SetupWizard', () => ({ SetupWizard: () => <div data-testid="setup-wizard" /> }));

import { NewHome } from '@/components/layout-lab/NewHome';
import { useProjectStore } from '@/stores/projectStore';

afterEach(() => cleanup());

describe('NewHome project gate', () => {
  it('renders the Blueprint setup wizard when no project is loaded', () => {
    useProjectStore.setState({ isSetupComplete: false });
    render(<NewHome />);
    expect(screen.getByTestId('setup-wizard')).toBeTruthy();
    expect(screen.queryByTestId('layout-lab')).toBeNull();
  });

  it('renders the lab once a project is set up', () => {
    useProjectStore.setState({ isSetupComplete: true });
    render(<NewHome />);
    expect(screen.getByTestId('layout-lab')).toBeTruthy();
    expect(screen.queryByTestId('setup-wizard')).toBeNull();
  });
});
