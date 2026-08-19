/**
 * The smoke panel is what the operator reads after a cook. Two things it owed and
 * did not deliver:
 *
 *   • the request carried no `projectPath`, though `BuildConfigSelector` had one in
 *     scope — so the server chose the build with an UNSCOPED query and the verdict
 *     landed on whichever legacy row was newest;
 *   • when the verdict flipped the build to `failed`, nothing said so. The cook
 *     stream had already emitted `done: success`, so the panel and the DB disagreed
 *     with no way to tell which was true.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { SmokeTest } from '@/components/modules/game-systems/SmokeTest';

afterEach(cleanup);

const PROJECT = 'C:/Users/kazda/Documents/Unreal Projects/PoF';
const REQUEST = {
  exePath: 'C:\\out\\PoF.exe',
  projectName: 'PoF',
  platform: 'Win64',
  config: 'Shipping',
  projectPath: PROJECT,
};

const FAIL = {
  status: 'fail', gameAlive: false, bootstrapExitCode: 1, spawnError: null,
  observedMs: 25000, gameImage: 'PoF-Win64-Shipping.exe', bootstrapExe: 'C:\\out\\PoF.exe',
};
const PASS = { ...FAIL, status: 'pass', gameAlive: true, bootstrapExitCode: null };

function mockSmoke(data: Record<string, unknown>) {
  const body = { success: true, data };
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('the smoke request is scoped', () => {
  it('carries projectPath so the server can find THIS project\'s build', async () => {
    const mock = mockSmoke({ result: PASS, recordedToBuildId: 7, buildStatus: 'success', statusChanged: false, unrecordedReason: null });
    render(<SmokeTest request={REQUEST} />);
    await waitFor(() => expect(mock).toHaveBeenCalled());

    const sent = JSON.parse(String((mock.mock.calls[0][1] as RequestInit).body));
    expect(sent.projectPath).toBe(PROJECT);
  });
});

describe('the panel states the DB outcome — the final smoke verdict', () => {
  it('says the build was re-recorded as failed', async () => {
    mockSmoke({ result: FAIL, recordedToBuildId: 42, buildStatus: 'failed', statusChanged: true, unrecordedReason: null });
    render(<SmokeTest request={REQUEST} />);

    const verdict = await screen.findByTestId('pof-smoke-verdict');
    expect(verdict.getAttribute('data-verdict')).toBe('condemned');
    expect(verdict.textContent).toContain('42');
    expect(verdict.textContent?.toLowerCase()).toContain('failed');
  });

  it('names the build a passing verdict was recorded against', async () => {
    mockSmoke({ result: PASS, recordedToBuildId: 7, buildStatus: 'success', statusChanged: false, unrecordedReason: null });
    render(<SmokeTest request={REQUEST} />);

    const verdict = await screen.findByTestId('pof-smoke-verdict');
    expect(verdict.getAttribute('data-verdict')).toBe('recorded');
    expect(verdict.textContent).toContain('7');
  });

  it('surfaces the reason when nothing in scope could receive the verdict', async () => {
    mockSmoke({
      result: PASS,
      recordedToBuildId: null,
      buildStatus: null,
      statusChanged: false,
      unrecordedReason: 'no successful Win64/Shipping build is recorded under "pof"',
    });
    render(<SmokeTest request={REQUEST} />);

    const verdict = await screen.findByTestId('pof-smoke-verdict');
    expect(verdict.getAttribute('data-verdict')).toBe('unrecorded');
    expect(verdict.textContent).toContain('no successful Win64/Shipping build');
  });
});
