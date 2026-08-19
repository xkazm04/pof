/**
 * `BuildConfigSelector` is where the post-cook smoke request is built, and it had the
 * active `projectPath` in scope (line 34) yet did not put it in the request. The
 * server therefore chose the build to record against with an UNSCOPED query — with
 * the live DB's legacy rows that means build #6 from May.
 *
 * `CookProgress` is mocked to complete a Win64 cook immediately, and `SmokeTest` is
 * mocked to capture the request prop, so this asserts the WIRING without spawning
 * anything.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const captured = vi.hoisted(() => ({ request: null as Record<string, unknown> | null }));

vi.mock('@/components/modules/game-systems/CookProgress', () => ({
  CookProgress: ({ request, onComplete }: {
    request: unknown;
    onComplete: (r: { status: 'success' | 'failed'; exePath?: string }) => void;
  }) => {
    if (request) {
      queueMicrotask(() => onComplete({ status: 'success', exePath: 'C:\\out\\PoF.exe' }));
    }
    return null;
  },
}));

vi.mock('@/components/modules/game-systems/SmokeTest', () => ({
  SmokeTest: ({ request }: { request: Record<string, unknown> | null }) => {
    if (request) captured.request = request;
    return null;
  },
}));

// Unrelated siblings on the same panel; stubbed so this test fails only for the
// wiring it is about.
vi.mock('@/components/modules/game-systems/NightlyBuildScheduler', () => ({
  NightlyBuildScheduler: () => null,
}));
vi.mock('@/components/modules/game-systems/GateNotifySettings', () => ({
  GateNotifySettings: () => null,
}));
vi.mock('@/components/modules/game-systems/PreflightPanel', () => ({
  PreflightPanel: () => null,
}));

import { BuildConfigSelector } from '@/components/modules/game-systems/BuildConfigSelector';
import { useProjectStore } from '@/stores/projectStore';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';

afterEach(cleanup);

const PROJECT_PATH = 'C:/Users/kazda/Documents/Unreal Projects/PoF';

const PROFILE = {
  ...createDefaultProfile('Win64'),
  id: 'win64-shipping',
  name: 'Win64 Shipping',
  config: 'Shipping' as const,
  isDefault: true,
};

beforeEach(() => {
  captured.request = null;
  useProjectStore.setState({ projectPath: PROJECT_PATH, projectName: 'PoF', ueVersion: '5.8' });
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const data = String(url).includes('/api/packaging/profiles') ? { profiles: [PROFILE] } : {};
    const body = { success: true, data };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }) as unknown as typeof fetch;
});

describe('the post-cook smoke request is scoped to the open project', () => {
  it('carries projectPath, so the verdict cannot land on another project\'s build', async () => {
    render(<BuildConfigSelector />);
    fireEvent.click(await screen.findByTestId(`pof-module-packaging-start-cook-${PROFILE.id}`));

    await waitFor(() => expect(captured.request).not.toBeNull());
    expect(captured.request!.projectPath).toBe(PROJECT_PATH);
    // The fields it already carried are unchanged.
    expect(captured.request!.platform).toBe('Win64');
    expect(captured.request!.config).toBe('Shipping');
    expect(captured.request!.exePath).toBe('C:\\out\\PoF.exe');
  });
});
