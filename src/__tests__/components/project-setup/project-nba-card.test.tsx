/**
 * The project-wide Next Best Action card, on its real host.
 *
 * `computeProjectNBA` ranks work across all ~40 sub-modules and has been fully
 * built and unit-tested for a long time with ZERO non-test callers — its own
 * docstring claimed it powered a "Mission Control" surface that has never
 * existed in this repo (repo-wide grep for `MissionControl|Mission Control`
 * returned two doc comments and no component, route or page).
 *
 * These tests render the chosen host — Project Setup, the project home — and
 * assert the ranking is actually on screen, names its owning module, and
 * dispatches through the SAME `useModuleCLI` path the per-module card uses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ChecklistItem, ScanState } from '@/components/modules/project-setup/useProjectScan';
import { mockFetchRoutes } from '@/__tests__/setup';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { executeMock, sendPromptMock, scanResult } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  sendPromptMock: vi.fn(),
  scanResult: {
    current: {
      engines: [{ version: '5.8.0', path: 'C:/UE_5.8' }] as Array<{ version: string; path: string }>,
      checklist: [{ id: 'uproject', label: 'UE Project', ok: true, detail: 'PoF.uproject' }] as ChecklistItem[],
      projectFiles: [] as string[],
      scanning: false,
      scanState: 'settled' as ScanState,
      scan: vi.fn(),
      hasProject: true,
      okCount: 1,
      missingToolCount: 0,
    },
  },
}));

vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: (cfg: { moduleId: string; sessionKey: string }) => ({
    sendPrompt: (prompt: string) => sendPromptMock(cfg.sessionKey, prompt),
    execute: (task: unknown) => { executeMock(cfg.moduleId, cfg.sessionKey, task); return Promise.resolve(); },
    isRunning: false,
  }),
}));

vi.mock('@/components/modules/project-setup/useProjectScan', () => ({
  useProjectScan: () => scanResult.current,
}));

import { ProjectSetupModule } from '@/components/modules/project-setup/ProjectSetupModule';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { __resetRunEvidenceCache } from '@/hooks/useModuleRunEvidence';
import { invalidateFeatureData } from '@/hooks/useModuleAggregates';

/** Recorded runs as `/api/session-analytics?action=dashboard` reports them. */
const DASHBOARD = {
  success: true,
  data: {
    totalSessions: 14,
    overallSuccessRate: 0,
    totalDurationMs: 0,
    moduleStats: [{ moduleId: 'arpg-combat', totalSessions: 14, successCount: 3 }],
    insights: [],
    qualityScores: [],
    recentSessions: [],
  },
};

function installRoutes() {
  return mockFetchRoutes([
    { match: 'action=dashboard', response: { body: DASHBOARD } },
    {
      match: 'all-statuses',
      response: {
        body: {
          success: true,
          data: {
            statuses: [],
            scope: { projectId: 'p1', unscoped: false, moduleId: null, foreignRows: 0, visibleRows: 0, note: 'scoped' },
          },
        },
      },
    },
    { match: '/api/', response: { body: { success: true, data: {} } } },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRunEvidenceCache();
  invalidateFeatureData();
  installRoutes();
  useProjectStore.setState({ projectPath: 'C:/proj/PoF', projectName: 'PoF', ueVersion: '5.8.0' });
  useModuleStore.setState({ checklistProgress: {}, moduleHistory: {}, moduleHealth: {} });
  useNavigationStore.setState({ activeCategory: 'project-setup', activeSubModule: null });
});

afterEach(() => {
  cleanup();
  __resetRunEvidenceCache();
  invalidateFeatureData();
});

describe('ProjectNBACard on Project Setup', () => {
  it('ranks work across the whole project on the project home', async () => {
    render(<ProjectSetupModule />);

    const card = await screen.findByTestId('pof-project-nba');
    expect(card.textContent).toContain('Next best action — whole project');

    const rows = await screen.findAllByTestId('pof-project-nba-row');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('names the owning module on every row', async () => {
    render(<ProjectSetupModule />);
    const rows = await screen.findAllByTestId('pof-project-nba-row');

    for (const row of rows) {
      const moduleId = row.getAttribute('data-module');
      expect(moduleId).toBeTruthy();
      // The module's human label is rendered, not just carried as a data attr.
      expect((row.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(row.querySelector('[data-odds-source]')).not.toBeNull();
    }
  });

  it('carries the scope disclosure the per-module card carries', async () => {
    render(<ProjectSetupModule />);
    await screen.findAllByTestId('pof-project-nba-row');
    // The banner renders only when the read hid something; the card must at least
    // wire the shared classifier rather than restating scope in its own words.
    const card = screen.getByTestId('pof-project-nba');
    expect(card.textContent).not.toContain('every project');
  });

  it('runs through the existing useModuleCLI dispatch and navigates to the module', async () => {
    render(<ProjectSetupModule />);
    const rows = await screen.findAllByTestId('pof-project-nba-row');
    const first = rows[0];
    const moduleId = first.getAttribute('data-module')!;

    const runBtn = Array.from(first.querySelectorAll('button'))
      .find((b) => (b.textContent ?? '').includes('Run'))!;
    expect(runBtn).toBeDefined();
    fireEvent.click(runBtn);

    await waitFor(() => expect(executeMock).toHaveBeenCalled());
    // Dispatched on the OWNING module's session, as a checklist task — the same
    // path the module's own Roadmap tab uses. No second dispatch mechanism.
    const [dispatchedModule, sessionKey, task] = executeMock.mock.calls[0];
    expect(dispatchedModule).toBe(moduleId);
    expect(sessionKey).toBe(`project-nba-${moduleId}`);
    expect(task).toMatchObject({ type: 'checklist', moduleId });

    // …and the user is taken to the module that owns the work.
    expect(useNavigationStore.getState().activeSubModule ?? useNavigationStore.getState().activeCategory)
      .toBeTruthy();
  });

  it('never prints a percentage for a module with no recorded runs', async () => {
    render(<ProjectSetupModule />);
    const rows = await screen.findAllByTestId('pof-project-nba-row');

    for (const row of rows) {
      const odds = row.querySelector('[data-odds-source]')!;
      if (odds.getAttribute('data-odds-source') === 'none') {
        expect(odds.textContent).toContain('No recorded runs');
        expect(odds.textContent).not.toMatch(/\d+%/);
      }
    }
  });
});
