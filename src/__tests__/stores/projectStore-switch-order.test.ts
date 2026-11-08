/**
 * Two overlapping switchProject calls: the LAST click wins, whatever order the
 * touch responses return in.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';

const row = (id: string) => ({
  id,
  projectName: id,
  projectPath: `C:/UE/${id}`,
  ueVersion: '5.8.0',
  lastOpenedAt: '',
  checklistTotal: 0,
  checklistDone: 0,
});

function reply(data: unknown) {
  const body = { success: true, data };
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useProjectStore.setState({
    projectName: '',
    projectPath: '',
    isSetupComplete: false,
    recentProjects: [row('B'), row('C')],
    dynamicContext: null,
  });
});
afterEach(async () => {
  await flush();
});

describe('switchProject ordering', () => {
  it('ends on the last project clicked when touch responses return out of order', async () => {
    const pending: Array<(r: unknown) => void> = [];
    globalThis.fetch = vi.fn(() => new Promise((resolve) => { pending.push(resolve); })) as unknown as typeof fetch;

    const first = useProjectStore.getState().switchProject('B');
    const second = useProjectStore.getState().switchProject('C');
    await vi.waitFor(() => expect(pending.length).toBe(2));

    pending[1](reply({ touched: true })); // C returns first
    await flush();
    pending[0](reply({ touched: true })); // then B
    await Promise.all([first, second]);

    expect(useProjectStore.getState().projectPath).toBe('C:/UE/C');
  });

  it('still opens the target for a single switch', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(reply({ touched: true }))) as unknown as typeof fetch;
    await useProjectStore.getState().switchProject('B');
    expect(useProjectStore.getState().projectPath).toBe('C:/UE/B');
  });
});
