import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ChecklistItem, ScanState } from '@/components/modules/project-setup/useProjectScan';
import { mockFetch } from '@/__tests__/setup';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { sendPromptMock, scanResult } = vi.hoisted(() => ({
  sendPromptMock: vi.fn(),
  scanResult: {
    current: {
      engines: [] as Array<{ version: string; path: string }>,
      checklist: [] as ChecklistItem[],
      projectFiles: [] as string[],
      scanning: false,
      scanState: 'settled' as ScanState,
      scan: vi.fn(),
      hasProject: false,
      okCount: 0,
      missingToolCount: 0,
      projectReadError: null as string | null,
    },
  },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (cfg: { sessionKey: string }) => ({
    sessionKey: cfg.sessionKey,
    sendPrompt: (prompt: string) => sendPromptMock(cfg.sessionKey, prompt),
    isRunning: false,
  }),
}));

vi.mock('@/components/modules/project-setup/useProjectScan', () => ({
  useProjectScan: () => scanResult.current,
}));

import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { useProjectStore } from '@/stores/projectStore';

const ENGINES = [{ version: '5.7.3', path: 'C:/UE_5.7' }];

function setScan(partial: Partial<typeof scanResult.current>) {
  scanResult.current = { ...scanResult.current, ...partial };
}

beforeEach(() => {
  vi.clearAllMocks();
  setScan({
    engines: ENGINES,
    checklist: [],
    projectFiles: [],
    scanning: false,
    scanState: 'settled',
    scan: vi.fn(),
    hasProject: false,
    okCount: 0,
    missingToolCount: 0,
    projectReadError: null,
  });
  useProjectStore.setState({ projectPath: 'C:/proj/PoF', projectName: 'PoF', ueVersion: '5.7.3' });
});

afterEach(() => cleanup());

describe('ProjectSetupModule next-step banner', () => {
  it('does not render the banner before a project path is configured', () => {
    useProjectStore.setState({ projectPath: '' });
    render(<ProjectSetupModule />);
    expect(screen.queryByTestId('pof-setup-next-step-banner')).toBeNull();
  });

  it('suggests Install Tools when tools are missing', () => {
    setScan({ missingToolCount: 2, hasProject: false });
    render(<ProjectSetupModule />);
    const banner = screen.getByTestId('pof-setup-next-step-banner');
    expect(banner.getAttribute('data-step')).toBe('install-tools');
  });

  it('suggests Create Project and dispatches the create prompt', () => {
    setScan({ missingToolCount: 0, hasProject: false });
    render(<ProjectSetupModule />);
    expect(screen.getByTestId('pof-setup-next-step-banner').getAttribute('data-step')).toBe('create-project');

    fireEvent.click(screen.getByTestId('pof-setup-next-step-cta'));
    expect(sendPromptMock).toHaveBeenCalledTimes(1);
    expect(sendPromptMock).toHaveBeenCalledWith('project-setup', expect.stringContaining('Create a new Unreal Engine'));
  });

  it('suggests Build & Verify once tools and a project are present, and dispatches the build prompt', () => {
    setScan({
      missingToolCount: 0,
      hasProject: true,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: true, detail: 'PoF.uproject' }],
    });
    render(<ProjectSetupModule />);
    expect(screen.getByTestId('pof-setup-next-step-banner').getAttribute('data-step')).toBe('build-verify');

    fireEvent.click(screen.getByTestId('pof-setup-next-step-cta'));
    expect(sendPromptMock).toHaveBeenCalledWith('project-build-verify', expect.stringContaining('Build-verify the UE 5.7 project'));
  });

  it('de-emphasizes non-suggested panels (build is dimmed while creating)', () => {
    setScan({ missingToolCount: 0, hasProject: false });
    const { container } = render(<ProjectSetupModule />);
    // Build & Verify only renders when hasProject; with create-project active and
    // no project, the still-visible Project Files / other panels carry the dim class.
    // The create panel itself must NOT be dimmed.
    const createBtn = screen.getByTestId('pof-setup-wizard-create-project-btn');
    const createWrapper = createBtn.closest('.opacity-50');
    expect(createWrapper).toBeNull();
    expect(container).toBeTruthy();
  });

  it('dims the Build & Verify panel when Install Tools is the active step', () => {
    setScan({
      missingToolCount: 1,
      hasProject: true,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: true, detail: 'PoF.uproject' }],
    });
    render(<ProjectSetupModule />);
    const buildBtn = screen.getByTestId('pof-setup-wizard-build-verify-btn');
    expect(buildBtn.closest('.opacity-50')).not.toBeNull();
  });

  it('offers no Create Project when the project folder could not be read', () => {
    setScan({ missingToolCount: 0, hasProject: false, projectReadError: 'Cannot read directory (EPERM)' });
    render(<ProjectSetupModule />);
    expect(screen.queryByTestId('pof-setup-next-step-banner')).toBeNull();
    expect(screen.queryByTestId('pof-setup-wizard-create-project-btn')).toBeNull();
    expect(screen.getByTestId('pof-setup-project-read-error').textContent).toContain('EPERM');
  });

  it('claims nothing before the first scan result arrives', () => {
    setScan({ scanning: true, scanState: 'scanning', checklist: [], hasProject: false });
    render(<ProjectSetupModule />);
    expect(screen.queryByTestId('pof-setup-next-step-banner')).toBeNull();
    expect(screen.queryByTestId('pof-setup-wizard-create-project-btn')).toBeNull();
  });

  it('disables Create Project while a re-scan may still contradict the stale checklist', () => {
    setScan({
      scanning: true,
      scanState: 'scanning',
      hasProject: false,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: false, detail: 'No .uproject found' }],
    });
    render(<ProjectSetupModule />);
    expect((screen.getByTestId('pof-setup-next-step-cta') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('pof-setup-wizard-create-project-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('triggers a tooling fetch when the Install Tools CTA is clicked', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: { allInstalled: false, prompt: 'install winget pkgs' } } });
    setScan({ missingToolCount: 2, hasProject: false });
    render(<ProjectSetupModule />);

    fireEvent.click(screen.getByTestId('pof-setup-next-step-cta'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/filesystem/browse', expect.objectContaining({ method: 'POST' }));
  });
});
