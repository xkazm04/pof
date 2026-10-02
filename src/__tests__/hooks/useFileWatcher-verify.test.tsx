/**
 * useFileWatcher's auto-verify writes a checklist tick ONLY from a verify-semantic verdict
 * of full/partial for an item the expectation table binds to the changed class. A failed
 * verification (non-ok response, rejected fetch) writes nothing, and a declaration no
 * expectation names (UPROPERTY, UAnimInstance) sends no request and ticks nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useProjectStore } from '@/stores/projectStore';
import { useModuleStore } from '@/stores/moduleStore';
import type { FileChangeEvent, ScannedDeclaration } from '@/lib/file-watcher';

afterEach(cleanup);

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  close() { /* noop */ }
  push(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

const setChecklistItem = vi.fn();
const setVerification = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;

function changes(...decls: ScannedDeclaration[]): { type: 'changes'; events: FileChangeEvent[] } {
  return {
    type: 'changes',
    events: [{
      type: 'modified',
      relativePath: 'Did/Changed.h',
      absolutePath: 'C:/Proj/Source/Did/Changed.h',
      declarations: decls,
      timestamp: '2026-09-29T00:00:00.000Z',
    }],
  };
}

const decl = (name: string): ScannedDeclaration => ({ name, kind: 'UCLASS', prefix: name[0] as 'A' | 'U' });

async function emit(frame: unknown) {
  renderHook(() => useFileWatcher());
  const es = FakeEventSource.instances.at(-1);
  if (!es) throw new Error('no SSE stream opened');
  await act(async () => {
    es.push(frame);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

const verifyCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('verify-semantic'));

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource;
  setChecklistItem.mockReset();
  setVerification.mockReset();
  useModuleStore.setState({ setChecklistItem, setVerification });
  useProjectStore.setState({
    projectPath: 'C:/Proj',
    isSetupComplete: true,
    dynamicContext: null,
    scanProject: vi.fn().mockResolvedValue(undefined),
  });
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('useFileWatcher auto-verify — a failure never ticks', () => {
  it('verify-semantic answering 500 writes nothing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ success: false, error: 'boom' }) });
    await emit(changes(decl('AARPGCharacterBase')));
    expect(verifyCalls()).toHaveLength(1);
    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(setVerification).not.toHaveBeenCalled();
  });

  it('a rejected fetch writes nothing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await emit(changes(decl('AARPGCharacterBase')));
    expect(verifyCalls()).toHaveLength(1);
    expect(setChecklistItem).not.toHaveBeenCalled();
    expect(setVerification).not.toHaveBeenCalled();
  });

  it('declarations no expectation names (UPROPERTY, UAnimInstance) send no request and tick nothing', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data: { results: [] } }) });
    await emit(changes(decl('UPROPERTY'), decl('UAnimInstance')));
    expect(verifyCalls()).toHaveLength(0);
    expect(setChecklistItem).not.toHaveBeenCalled();
  });

  it('a module-scoped verdict writes to its own module only, and the request names {moduleId,itemId}', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data: {
          results: [{ moduleId: 'arpg-inventory', itemId: 'ai-1', status: 'full', completeness: 1, missingMembers: [], details: [] }],
          unreadable: [],
        },
      }),
    });
    await emit(changes(decl('UARPGItemDefinition')));

    expect(verifyCalls()).toHaveLength(1);
    const body = JSON.parse(String((verifyCalls()[0][1] as RequestInit).body));
    expect(body.items).toEqual([{ moduleId: 'arpg-inventory', itemId: 'ai-1' }]);

    expect(setVerification).toHaveBeenCalledWith('arpg-inventory', 'ai-1', expect.objectContaining({ status: 'full' }));
    expect(setChecklistItem).toHaveBeenCalledWith('arpg-inventory', 'ai-1', true);
    for (const call of [...setVerification.mock.calls, ...setChecklistItem.mock.calls]) {
      expect(call[0]).not.toBe('ai-behavior');
    }
  });
});
