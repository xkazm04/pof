/**
 * A scan's response belongs to the project it was asked for. A project switch or
 * reset while it is in flight must not let it land on the next project.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

/** Each fetch stays pending until the test resolves it, in the order issued. */
function deferredFetch() {
  const pending: Array<(r: unknown) => void> = [];
  globalThis.fetch = vi.fn(() => new Promise((resolve) => { pending.push(resolve); })) as unknown as typeof fetch;
  return pending;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function open(path: string) {
  useProjectStore.setState({ projectName: path, projectPath: path, dynamicContext: null, isScanning: false, scanError: null });
}

beforeEach(() => open('C:/UE/A'));

describe('scanProject in flight across a project flip', () => {
  it('drops a result that arrives after the open project changed', async () => {
    const pending = deferredFetch();
    const scan = useProjectStore.getState().scanProject();
    open('C:/UE/B');

    pending[0](scanResponse('FromA'));
    await scan;

    expect(useProjectStore.getState().dynamicContext).toBeNull();
    expect(useProjectStore.getState().isScanning).toBe(false);
  });

  it('a stale result does not end the newer project scan still in flight', async () => {
    const pending = deferredFetch();
    const scanA = useProjectStore.getState().scanProject();
    open('C:/UE/B');
    const scanB = useProjectStore.getState().scanProject();

    pending[0](scanResponse('FromA'));
    await scanA;
    expect(useProjectStore.getState().isScanning).toBe(true);

    pending[1](scanResponse('FromB'));
    await scanB;
    expect(useProjectStore.getState().dynamicContext?.classes[0].name).toBe('FromB');
    expect(useProjectStore.getState().isScanning).toBe(false);
  });

  it('a stale failure does not report on the next project', async () => {
    const rejecters: Array<(e: Error) => void> = [];
    globalThis.fetch = vi.fn(() => new Promise((_, reject) => { rejecters.push(reject); })) as unknown as typeof fetch;
    const scan = useProjectStore.getState().scanProject();
    open('C:/UE/B');
    rejecters[0](new Error('boom'));
    await scan;
    await flush();
    expect(useProjectStore.getState().scanError).toBeNull();
  });

  it('clears isScanning when the path moved without a reset of the flag', async () => {
    const pending = deferredFetch();
    const scan = useProjectStore.getState().scanProject();
    useProjectStore.setState({ projectPath: 'C:/UE/B' }); // isScanning stays true, as setProject would leave it
    pending[0](scanResponse('FromA'));
    await scan;
    expect(useProjectStore.getState().isScanning).toBe(false);
    expect(useProjectStore.getState().dynamicContext).toBeNull();
  });

  it('still applies a result for the project that stayed open', async () => {
    const pending = deferredFetch();
    const scan = useProjectStore.getState().scanProject();
    pending[0](scanResponse('FromA'));
    await scan;
    expect(useProjectStore.getState().dynamicContext?.classes[0].name).toBe('FromA');
  });
});
