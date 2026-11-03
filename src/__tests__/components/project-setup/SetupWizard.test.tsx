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
import { useActiveGameStore } from '@/stores/activeGameStore';

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

  it('offers UE 5.8 and Godot only: no 5.5 / 5.6 / 5.7 toggles', () => {
    render(<SetupWizard />);
    expect(screen.getByTestId('pof-setup-wizard-version-pill-5.8.0')).toBeTruthy();
    expect(screen.getByTestId('pof-setup-wizard-engine-pill-godot')).toBeTruthy();
    for (const value of ['5.5.4', '5.6.1', '5.7.3']) {
      expect(screen.queryByTestId(`pof-setup-wizard-version-pill-${value}`)).toBeNull();
    }
  });

  it('a stale persisted older version is replaced by 5.8 when the UE pill is chosen', () => {
    useProjectStore.setState({ ueVersion: '5.5.4' });
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-version-pill-5.8.0'));
    expect(useProjectStore.getState().ueVersion).toBe('5.8.0');
  });
});

describe('SetupWizard Godot', () => {
  const RTAI = {
    gameId: 'gtai', name: 'RTAI: Uprising', path: 'C:/Users/me/kiro/gtai/project',
    root: 'C:/Users/me/kiro/gtai', engineVersion: '4.7.2', validated: true,
  };
  const routeByAction = () => {
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const data = body.action === 'detect-godot-projects' ? { projects: [RTAI] } : { projects: [] };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
    }) as unknown as typeof fetch;
  };

  it('lists RTAI under Godot and opening it selects the gtai game workspace', async () => {
    routeByAction();
    useActiveGameStore.setState({ gameId: 'pof' });
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-engine-pill-godot'));
    expect(screen.queryByTestId('pof-setup-wizard-tab-fresh')).toBeNull();
    const item = await screen.findByTestId('pof-setup-wizard-godot-item-gtai');
    expect(item.textContent).toContain('RTAI: Uprising');
    fireEvent.click(item);
    await waitFor(() => expect(useProjectStore.getState().isSetupComplete).toBe(true));
    expect(useProjectStore.getState().projectPath).toBe(RTAI.path);
    expect(useProjectStore.getState().isNewProject).toBe(false);
    expect(useActiveGameStore.getState().gameId).toBe('gtai');
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

  it('creates a fresh project under the real projects root and completes setup', async () => {
    // Browse actions share one URL; route by the POSTed action (list '~' -> this user's home).
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const data =
        body.action === 'list' && body.path === '~' ? { path: 'C:\\Users\\me' }
        : body.action === 'list' ? { path: body.path, directories: [] }
        : body.action === 'detect-engines' ? { engines: [{ version: '5.5.4', path: 'C:\\UE_5.5' }] }
        : { projects: [] };
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
    }) as unknown as typeof fetch;
    render(<SetupWizard />);
    fireEvent.click(screen.getByTestId('pof-setup-wizard-tab-fresh'));
    fireEvent.change(screen.getByTestId('pof-setup-wizard-project-name-input'), {
      target: { value: 'FreshGame' },
    });
    await waitFor(() =>
      expect((screen.getByTestId('pof-setup-wizard-create-btn') as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByTestId('pof-setup-wizard-create-btn'));
    await waitFor(() => expect(useProjectStore.getState().isSetupComplete).toBe(true));
    expect(useProjectStore.getState().projectName).toBe('FreshGame');
    expect(useProjectStore.getState().projectPath).toBe('C:\\Users\\me\\Documents\\Unreal Projects\\FreshGame');
  });
});
