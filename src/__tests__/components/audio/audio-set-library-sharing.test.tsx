import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, cleanup, act } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/lib/api-utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/api-utils')>()),
  apiFetch: (url: string) => apiFetch(url),
}));

import { useAudioSetLibrary } from '@/components/modules/content/audio/AudioPropertyPanel/useAudioSetLibrary';

/**
 * LISTEN mode (AuditionReadout) and the emitter panel's AssetSetPicker each call
 * useAudioSetLibrary; the picker is keyed by emitter id, so every bound-emitter
 * selection remounts it. The library read must be shared while the painter tab
 * stays mounted, and re-read once it was left.
 */

const gets = (path: string) => apiFetch.mock.calls.filter(([u]) => u === path).length;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });

const retryHolder: { fn: () => Promise<void> } = { fn: async () => {} };
function Consumer({ capture }: { capture?: boolean }) {
  const lib = useAudioSetLibrary(true);
  useEffect(() => { if (capture) retryHolder.fn = lib.retry; });
  return <span data-testid="n">{lib.options.length}</span>;
}
function Tree({ emitterId, listen = true }: { emitterId: string; listen?: boolean }) {
  return (
    <>
      {listen && <Consumer capture />}
      <Consumer key={emitterId} />
    </>
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockImplementation(async (url: string) => (url === '/api/audio-gen'
    ? { sets: [{ id: 's1', name: 'Rain', kind: 'ambient', loopable: false }], assets: [] }
    : { bySet: {} }));
});
afterEach(cleanup);

describe('useAudioSetLibrary - one shared read', () => {
  it('LISTEN + a bound emitter reads the library once, not once per consumer', async () => {
    render(<Tree emitterId="e1" />);
    await flush();
    expect(gets('/api/audio-gen')).toBe(1);
    expect(gets('/api/audio/import-result')).toBe(1);
  });

  it('selecting 3 bound emitters in a row costs no extra reads', async () => {
    const { rerender, getAllByTestId } = render(<Tree emitterId="e1" />);
    await flush();
    for (const id of ['e2', 'e3', 'e4']) { rerender(<Tree emitterId={id} />); await flush(); }
    expect(gets('/api/audio-gen')).toBe(1);
    expect(getAllByTestId('n').every((n) => n.textContent === '1')).toBe(true);
  });

  it('keyed remounts alone (no LISTEN consumer) still share one read', async () => {
    const { rerender } = render(<Tree emitterId="e1" listen={false} />);
    await flush();
    for (const id of ['e2', 'e3']) { rerender(<Tree emitterId={id} listen={false} />); await flush(); }
    expect(gets('/api/audio-gen')).toBe(1);
  });

  it('leaving the tab drops the cache: the next mount reads fresh', async () => {
    const first = render(<Tree emitterId="e1" />);
    await flush();
    first.unmount();
    await flush();
    render(<Tree emitterId="e1" />);
    await flush();
    expect(gets('/api/audio-gen')).toBe(2);
  });

  it('retry forces a new read', async () => {
    render(<Tree emitterId="e1" />);
    await flush();
    await act(async () => { await retryHolder.fn(); });
    expect(gets('/api/audio-gen')).toBe(2);
  });
});
