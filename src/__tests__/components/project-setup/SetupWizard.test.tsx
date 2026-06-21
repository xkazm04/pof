import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// next/font is a Next compiler transform; stub it for the vitest environment
// (the Blueprint wizard imports labFontVars from layout-lab/fonts).
vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { mockFetch } from '@/__tests__/setup';
import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useProjectStore } from '@/stores/projectStore';

beforeEach(() => {
  // Mount fires a detect-projects scan; default to an empty result.
  mockFetch({ body: { success: true, data: { projects: [] } } });
  // Reset transient project fields. ueVersion is deliberately left at the store's
  // source default so the "defaults to UE 5.8" test observes the real default.
  useProjectStore.setState({ projectName: '', projectPath: '', isSetupComplete: false, isNewProject: true });
});

afterEach(() => cleanup());

describe('SetupWizard version switcher', () => {
  it('defaults to UE 5.8 as the latest version', () => {
    render(<SetupWizard />);
    expect(useProjectStore.getState().ueVersion).toBe('5.8.0');
    const pill = screen.getByTestId('pof-setup-wizard-version-pill-5.8.0');
    expect(pill.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders all four version pills including UE 5.8', () => {
    render(<SetupWizard />);
    for (const value of ['5.5.4', '5.6.1', '5.7.3', '5.8.0']) {
      expect(screen.getByTestId(`pof-setup-wizard-version-pill-${value}`)).toBeTruthy();
    }
  });

  it('switching to UE 5.5 updates the selected version in the store', () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-version-pill-5.5.4'));
    expect(useProjectStore.getState().ueVersion).toBe('5.5.4');
    expect(screen.getByTestId('pof-setup-wizard-version-pill-5.5.4').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('SetupWizard open/create flow', () => {
  it('lists detected projects matching the selected UE version', async () => {
    useProjectStore.setState({ ueVersion: '5.8.0' });
    mockFetch({
      body: {
        success: true,
        data: {
          projects: [
            { name: 'MyGame', path: 'C:/UP/MyGame', uprojectFile: 'MyGame.uproject', engineVersion: '5.8.0', validated: true },
          ],
        },
      },
    });
    render(<SetupWizard />);
    expect(await screen.findByText('MyGame')).toBeTruthy();
  });

  it('creates a fresh project and completes setup', async () => {
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-tab-fresh'));
    fireEvent.change(screen.getByTestId('pof-setup-wizard-project-name-input'), {
      target: { value: 'FreshGame' },
    });
    fireEvent.click(screen.getByTestId('pof-setup-wizard-create-btn'));
    await waitFor(() => expect(useProjectStore.getState().isSetupComplete).toBe(true));
    expect(useProjectStore.getState().projectName).toBe('FreshGame');
  });
});
