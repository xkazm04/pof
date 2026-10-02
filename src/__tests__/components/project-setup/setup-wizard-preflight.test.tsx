import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const f = () => ({ className: 'font-mock' });
  return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f };
});

import { SetupWizard } from '@/components/modules/project-setup/SetupWizard';
import { useProjectStore } from '@/stores/projectStore';

const HOME = 'C:\\Users\\me';
const ROOT = `${HOME}\\Documents\\Unreal Projects`;

interface BrowseStub {
  home?: 'ok' | 'fail';
  root?: 'ok' | 'fail';
  dirs?: { name: string; path: string; hasUProject: boolean }[];
  engines?: { version: string; path: string }[];
}

const ok = (data: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data }) });
const fail = () => ({ ok: false, status: 500, json: () => Promise.resolve({ success: false, error: 'EACCES' }) });

/** Routes POST /api/filesystem/browse by action (and list path); every other call succeeds empty. */
function stubBrowse(s: BrowseStub = {}) {
  const calls: { action?: string; path?: string }[] = [];
  const mock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.includes('/api/filesystem/browse')) calls.push(body);
    if (body.action === 'list' && body.path === '~') return Promise.resolve(s.home === 'fail' ? fail() : ok({ path: HOME }));
    if (body.action === 'list') {
      return Promise.resolve(s.root === 'fail' ? fail() : ok({ path: body.path, directories: s.dirs ?? [] }));
    }
    if (body.action === 'detect-engines') return Promise.resolve(ok({ engines: s.engines ?? [{ version: '5.5.4', path: 'C:\\UE_5.5' }] }));
    return Promise.resolve(ok({ projects: [] }));
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return calls;
}

function openFresh() {
  render(<SetupWizard />);
  fireEvent.click(screen.getByTestId('pof-setup-wizard-tab-fresh'));
}

const typeName = (value: string) =>
  fireEvent.change(screen.getByTestId('pof-setup-wizard-project-name-input'), { target: { value } });

const createBtn = () => screen.getByTestId('pof-setup-wizard-create-btn') as HTMLButtonElement;

beforeEach(() => {
  useProjectStore.setState({ projectName: '', projectPath: '', ueVersion: '5.5.4', isSetupComplete: false, isNewProject: true });
});

afterEach(() => cleanup());

describe('SetupWizard Start Fresh preflight', () => {
  it("'My Game' disables Create and offers 'Use MyGame', which fixes the name in one click", async () => {
    stubBrowse();
    openFresh();
    typeName('My Game');
    const chip = await screen.findByTestId('pof-setup-wizard-name-suggestion');
    expect(chip.textContent).toContain('Use MyGame');
    expect(createBtn().disabled).toBe(true);
    fireEvent.click(chip);
    expect((screen.getByTestId('pof-setup-wizard-project-name-input') as HTMLInputElement).value).toBe('MyGame');
    await waitFor(() => expect(createBtn().disabled).toBe(false));
  });

  it("an existing project named 'Arena' offers 'Open it instead' instead of scaffolding over it", async () => {
    const P = `${ROOT}\\Arena`;
    stubBrowse({ dirs: [{ name: 'Arena', path: P, hasUProject: true }] });
    openFresh();
    typeName('Arena');
    const open = await screen.findByTestId('pof-setup-wizard-open-existing');
    expect(open.textContent).toContain('Open it instead');
    expect(createBtn().disabled).toBe(true);
    fireEvent.click(open);
    await waitFor(() => expect(useProjectStore.getState().isSetupComplete).toBe(true));
    expect(useProjectStore.getState().projectPath).toBe(P);
    expect(useProjectStore.getState().isNewProject).toBe(false);
  });

  it.each([
    ['list ~', { home: 'fail' as const }],
    ['list <root>', { root: 'fail' as const }],
  ])('%s rejecting keeps Create disabled with root-unreadable (fails closed, no fallback)', async (_label, stub) => {
    const calls = stubBrowse(stub);
    openFresh();
    typeName('FreshGame');
    const issue = await screen.findByTestId('pof-setup-wizard-issue-root-unreadable');
    expect(issue).toBeTruthy();
    expect(createBtn().disabled).toBe(true);
    fireEvent.click(createBtn());
    fireEvent.keyDown(screen.getByTestId('pof-setup-wizard-project-name-input'), { key: 'Enter' });
    expect(useProjectStore.getState().isSetupComplete).toBe(false);
    expect(useProjectStore.getState().projectPath).toBe('');
    // Never a hard-coded directory: nothing on screen names another user's profile.
    expect(document.body.textContent).not.toMatch(/kazda/i);
    expect(calls.some((c) => c.action === 'list' && c.path !== '~' && !String(c.path).startsWith(HOME))).toBe(false);
  });

  it('a version that is not installed shows a one-click switch to the installed engine', async () => {
    useProjectStore.setState({ ueVersion: '5.8.0' });
    stubBrowse();
    openFresh();
    typeName('FreshGame');
    const sw = await screen.findByTestId('pof-setup-wizard-engine-switch');
    fireEvent.click(sw);
    expect(useProjectStore.getState().ueVersion).toBe('5.5.4');
  });
});
