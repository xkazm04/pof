import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useProjectScan } from '@/components/modules/project-setup/useProjectScan';

afterEach(cleanup);

type Reply = { status: number; body: unknown };

function route(listReply: Reply, probes: { engines?: Reply; tooling?: Reply } = {}) {
  globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    const { action } = JSON.parse(String(init?.body ?? '{}')) as { action: string };
    let reply: Reply = { status: 200, body: { success: true, data: {} } };
    if (action === 'detect-engines') reply = probes.engines ?? { status: 200, body: { success: true, data: { engines: [] } } };
    if (action === 'detect-tooling') reply = probes.tooling ?? { status: 200, body: { success: true, data: { tools: [] } } };
    if (action === 'list') reply = listReply;
    return Promise.resolve({
      ok: reply.status < 400,
      status: reply.status,
      json: () => Promise.resolve(reply.body),
      text: () => Promise.resolve(JSON.stringify(reply.body)),
    });
  }) as unknown as typeof fetch;
}

describe('useProjectScan project folder read', () => {
  it('reports a failed read as a read failure, never as "No .uproject found"', async () => {
    route({ status: 500, body: { success: false, error: 'Cannot read directory C:/p (EPERM)' } });
    const { result } = renderHook(() => useProjectScan('C:/p'));
    await waitFor(() => expect(result.current.scanState).toBe('settled'));

    expect(result.current.projectReadError).toContain('EPERM');
    const uproject = result.current.checklist.find((c) => c.id === 'uproject');
    expect(uproject?.detail).toContain('Could not read');
    expect(result.current.checklist.find((c) => c.id === 'source')?.detail).toBe('Not checked');
    expect(result.current.checklist.find((c) => c.id === 'build')?.detail).toBe('Not checked');
  });

  it('keeps a folder that does not exist yet as a plain "no project" (the create path)', async () => {
    route({
      status: 200,
      body: { success: true, data: { path: 'C:/p', parent: 'C:/', directories: [], uprojectFiles: [], isUEProject: false } },
    });
    const { result } = renderHook(() => useProjectScan('C:/p'));
    await waitFor(() => expect(result.current.scanState).toBe('settled'));

    expect(result.current.projectReadError).toBeNull();
    expect(result.current.checklist.find((c) => c.id === 'uproject')?.detail).toBe('No .uproject found');
  });
});

describe('useProjectScan failed probes', () => {
  const emptyList: Reply = {
    status: 200,
    body: { success: true, data: { path: 'C:/p', parent: 'C:/', directories: [], uprojectFiles: [], isUEProject: false } },
  };
  const oneEngine: Reply = { status: 200, body: { success: true, data: { engines: [{ version: '5.8.0', path: 'C:/UE_5.8' }] } } };
  const fail: Reply = { status: 500, body: { success: false, error: 'boom' } };

  it('marks tooling rows unknown when detect-tooling fails, and counts none as missing', async () => {
    route(emptyList, { tooling: fail, engines: oneEngine });
    const { result } = renderHook(() => useProjectScan('C:/p'));
    await waitFor(() => expect(result.current.scanState).toBe('settled'));

    const tools = result.current.checklist.filter((c) => c.id.startsWith('tool-'));
    expect(tools.length).toBe(4);
    expect(tools.every((t) => t.unknown === true && t.ok === false)).toBe(true);
    expect(result.current.missingToolCount).toBe(0);
    expect(result.current.unknownToolCount).toBe(4);
  });

  it('marks the engine row unknown, not "Not found", when detect-engines fails', async () => {
    route(emptyList, { engines: fail });
    const { result } = renderHook(() => useProjectScan('C:/p'));
    await waitFor(() => expect(result.current.scanState).toBe('settled'));

    const engine = result.current.checklist.find((c) => c.id === 'engine');
    expect(engine?.unknown).toBe(true);
    expect(engine?.detail).not.toBe('Not found');
    expect(result.current.missingToolCount).toBe(0);
  });

  it('keeps a probe that answered "no engine" as plainly missing', async () => {
    route(emptyList);
    const { result } = renderHook(() => useProjectScan('C:/p'));
    await waitFor(() => expect(result.current.scanState).toBe('settled'));

    const engine = result.current.checklist.find((c) => c.id === 'engine');
    expect(engine?.unknown).toBeUndefined();
    expect(engine?.detail).toBe('Not found');
    expect(result.current.missingToolCount).toBe(1);
    expect(result.current.unknownToolCount).toBe(0);
  });
});
