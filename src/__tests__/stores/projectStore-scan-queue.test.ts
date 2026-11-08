/**
 * A forced scan that arrives while one is running must still see files written
 * after that scan started: it queues ONE follow-up request and waits for it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';

function scanResponse(marker: string) {
  const body = {
    success: true,
    data: {
      scannedAt: new Date().toISOString(),
      classes: [{ name: marker, prefix: 'U', headerPath: `${marker}.h` }],
      plugins: [],
      buildDependencies: [],
      sourceFileCount: 1,
    },
  };
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function deferredFetch() {
  const pending: Array<(r: unknown) => void> = [];
  const mock = vi.fn(() => new Promise((resolve) => { pending.push(resolve); }));
  globalThis.fetch = mock as unknown as typeof fetch;
  return { pending, mock };
}

beforeEach(() => {
  useProjectStore.setState({
    projectName: 'P', projectPath: 'C:/UE/P', dynamicContext: null, isScanning: false, scanError: null,
  });
});

describe('scanProject force during a running scan', () => {
  it('issues one follow-up request and resolves only after it', async () => {
    const { pending, mock } = deferredFetch();
    const first = useProjectStore.getState().scanProject();
    let forcedDone = false;
    const forced = useProjectStore.getState().scanProject({ force: true }).then(() => { forcedDone = true; });
    await flush();
    expect(mock).toHaveBeenCalledTimes(1);

    pending[0](scanResponse('Before'));
    await first;
    await flush();
    expect(mock).toHaveBeenCalledTimes(2);
    expect(forcedDone).toBe(false);

    pending[1](scanResponse('After'));
    await forced;
    expect(useProjectStore.getState().dynamicContext?.classes[0].name).toBe('After');
  });

  it('two forced callers during one scan share a single follow-up', async () => {
    const { pending, mock } = deferredFetch();
    const first = useProjectStore.getState().scanProject();
    const a = useProjectStore.getState().scanProject({ force: true });
    const b = useProjectStore.getState().scanProject({ force: true });
    pending[0](scanResponse('One'));
    await first;
    await flush();
    pending[1](scanResponse('Two'));
    await Promise.all([a, b]);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('a plain call during a scan still just waits (no follow-up)', async () => {
    const { pending, mock } = deferredFetch();
    const first = useProjectStore.getState().scanProject();
    const plain = useProjectStore.getState().scanProject();
    pending[0](scanResponse('One'));
    await Promise.all([first, plain]);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
