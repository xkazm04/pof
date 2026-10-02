/**
 * useTestRunner delivers the spec (acceptance case 6 of ue5-bridge-monitoring/B).
 *
 * The proxy at /api/pof-bridge/test reads `{ action, spec }` and forwards `body.spec` to
 * /pof/test/run; the hook used to post the raw spec as the body, so the plugin received
 * `undefined` and no Test Harness scenario ever reached UE.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTestRunner } from '@/hooks/useTestRunner';
import { TEMPLATE_SCENARIO } from '@/components/modules/project-setup/TestHarnessPanel/constants';

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe('useTestRunner body shape', () => {
  it('posts { action: "run", spec } so the route forwards the spec', async () => {
    const spec = { ...TEMPLATE_SCENARIO, testId: 'test-body-shape' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { testId: spec.testId, status: 'passed', startTime: '', assertions: [], logs: [], errors: [] },
    })));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { result } = renderHook(() => useTestRunner());
    await act(async () => { await result.current.runTest(spec); });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/pof-bridge/test');
    const body = JSON.parse(String(init.body));
    expect(body.spec).toEqual(spec);
    expect(body.action).toBe('run');
  });
});
