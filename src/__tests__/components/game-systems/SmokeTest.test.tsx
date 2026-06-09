import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SmokeTest } from '@/components/modules/game-systems/SmokeTest';

afterEach(cleanup);

const REQUEST = { exePath: 'C:\\out\\PoF.exe', projectName: 'PoF', platform: 'Win64', config: 'Shipping' };

function mockSmoke(result: Record<string, unknown>) {
  const body = { success: true, data: { result, recordedToBuildId: null } };
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as typeof fetch;
}

const PASS = { status: 'pass', gameAlive: true, bootstrapExitCode: null, spawnError: null, observedMs: 25000, gameImage: 'PoF.exe', bootstrapImage: 'PoF.exe' };
const FAIL = { status: 'fail', gameAlive: false, bootstrapExitCode: 1, spawnError: null, observedMs: 25000, gameImage: 'PoF.exe', bootstrapImage: 'PoF.exe' };

describe('SmokeTest — accessibility', () => {
  it('wraps the status in a polite live region', async () => {
    mockSmoke(PASS);
    render(<SmokeTest request={REQUEST} />);
    const region = await screen.findByTestId('pof-smoke-test');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('pairs a pass result with an icon and text, not color alone', async () => {
    mockSmoke(PASS);
    render(<SmokeTest request={REQUEST} />);
    const result = await screen.findByTestId('pof-smoke-test-result');
    expect(result.textContent).toContain('the cooked build runs'); // text conveys outcome
    expect(result.querySelector('svg')).toBeTruthy(); // icon accompanies it
  });

  it('pairs a failure result with text describing the outcome', async () => {
    mockSmoke(FAIL);
    render(<SmokeTest request={REQUEST} />);
    const result = await screen.findByTestId('pof-smoke-test-result');
    expect(result.getAttribute('data-status')).toBe('fail');
    expect(result.textContent).toContain('did not survive');
  });
});
