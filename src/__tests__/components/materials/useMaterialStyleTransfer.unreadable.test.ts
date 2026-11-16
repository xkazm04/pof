import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useMaterialStyleTransfer } from '@/components/modules/content/materials/MaterialStyleTransfer/useMaterialStyleTransfer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * A non-JSON reply (a dev-server HTML error page, a proxy 502) made res.json()
 * throw a SyntaxError, and the catch printed its message verbatim:
 * "Analysis failed: Unexpected token '<', "<!DOCTYPE "... is not valid JSON".
 * The banner must say the server's answer was unreadable, with its status.
 */

function stubReply(status: number, json: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json })));
}

async function analyzeOnce() {
  const { result } = renderHook(() => useMaterialStyleTransfer(() => {}));
  act(() => result.current.setReferenceDescription('brushed metal'));
  await act(async () => { await result.current.handleAnalyze(); });
  return result.current;
}

describe('useMaterialStyleTransfer — an unreadable reply is named, not parsed aloud', () => {
  it('an HTML error page reports the HTTP status, not the JSON parser message', async () => {
    stubReply(502, async () => { throw new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`); });
    const s = await analyzeOnce();
    expect(s.analyzeError).not.toMatch(/Unexpected token|not valid JSON/);
    expect(s.analyzeError).toMatch(/HTTP 502/);
    expect(s.isAnalyzing).toBe(false);
  });

  it('control: an envelope error still shows the server message', async () => {
    stubReply(400, async () => ({ success: false, error: 'Unknown action' }));
    expect((await analyzeOnce()).analyzeError).toBe('Unknown action');
  });

  it('control: a network failure still shows its own message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect((await analyzeOnce()).analyzeError).toBe('Failed to fetch');
  });
});
