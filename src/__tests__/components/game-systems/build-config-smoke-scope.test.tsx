/**
 * `BuildConfigSelector` is where the post-cook smoke request is built. It used to
 * re-send the exe path, project name, platform and config the browser held, so the
 * server re-identified the build after the fact (and launched whatever path it was
 * given). The cook stream already names the row it recorded; that id is now the
 * ONLY thing the smoke request carries. A cook that could not be recorded has
 * nothing to condemn, so no smoke run starts and the panel says why.
 *
 * `CookProgress` is mocked to complete a Win64 cook immediately, and `SmokeTest` is
 * mocked to capture its props, so this asserts the WIRING without spawning anything.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const captured = vi.hoisted(() => ({
  request: null as Record<string, unknown> | null,
  skippedReason: null as string | null,
  outcome: null as Record<string, unknown> | null,
}));

vi.mock('@/components/modules/game-systems/CookProgress', () => ({
  CookProgress: ({ request, onComplete }: {
    request: unknown;
    onComplete: (r: Record<string, unknown>) => void;
  }) => {
    if (request) {
      queueMicrotask(() => onComplete(captured.outcome!));
    }
    return null;
  },
}));

vi.mock('@/components/modules/game-systems/SmokeTest', () => ({
  SmokeTest: ({ request, skippedReason }: { request: Record<string, unknown> | null; skippedReason?: string | null }) => {
    if (request) captured.request = request;
    if (skippedReason) captured.skippedReason = skippedReason;
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
// The Package flow only cooks on a fast pre-flight verdict for the pressed profile's
// maps, so the stub reports a measured, passing gate for whatever maps it is given.
vi.mock('@/components/modules/game-systems/PreflightPanel', async () => {
  const { useEffect } = await import('react');
  return {
    PreflightPanel: ({ cookMaps, onStatusChange }: {
      cookMaps?: string[];
      onStatusChange?: (s: Record<string, unknown>) => void;
    }) => {
      const mapsKey = (cookMaps ?? []).join('|');
      useEffect(() => {
        onStatusChange?.({
          canCook: true, overall: 'pass', fullyCovered: true, notRunLabels: [], notRunKinds: [],
          coverage: { ran: 4, total: 4 }, mapsKey, failing: [], failingKinds: [], running: [],
        });
      }, [mapsKey, onStatusChange]);
      return null;
    },
  };
});

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
  captured.skippedReason = null;
  captured.outcome = { status: 'success', exePath: 'C:\out\PoF.exe', buildId: 42 };
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

async function cookOnce() {
  render(<BuildConfigSelector />);
  fireEvent.click(await screen.findByTestId(`pof-module-packaging-start-cook-${PROFILE.id}`));
}

describe('the post-cook smoke request names the recorded build, nothing else', () => {
  it('sends exactly { buildId } — no exe path, name, platform or config travels', async () => {
    await cookOnce();
    await waitFor(() => expect(captured.request).not.toBeNull());
    expect(captured.request).toEqual({ buildId: 42 });
  });

  it('a cook whose record failed starts no smoke run and says why', async () => {
    captured.outcome = { status: 'success', exePath: 'C:\out\PoF.exe', recordError: 'SQLITE_BUSY' };
    await cookOnce();
    await waitFor(() => expect(captured.skippedReason).not.toBeNull());
    expect(captured.skippedReason).toContain('SQLITE_BUSY');
    expect(captured.request).toBeNull();
  });
});
