/**
 * Every editor-mutating bridge action leaves exactly one logger.info line naming the action and
 * its target, and never the value written. The editor, the connection and the plugin are stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { NextRequest } from 'next/server';

const info = vi.fn();
vi.mock('@/lib/logger', () => ({ logger: { info, warn: vi.fn(), debug: vi.fn(), log: vi.fn(), error: vi.fn() } }));

const client = {
  setProperty: vi.fn(async () => ({ ok: true, data: 1 })),
  callFunction: vi.fn(async () => ({ ok: true, data: {} })),
  executeConsoleCommand: vi.fn(async () => ({ ok: true, data: {} })),
};
vi.mock('@/lib/ue5-bridge/connection-manager', () => ({
  ue5Connection: { getClient: () => client, getState: () => ({ status: 'connected' }) },
}));

const query = (await import('@/app/api/ue5-bridge/query/route')).POST;
const inject = (await import('@/app/api/ue5-inject-item/route')).POST;
const hotPatch = (await import('@/app/api/pof-bridge/compile/hot-patch/route')).POST;
const compile = (await import('@/app/api/pof-bridge/compile/route')).POST;

const realFetch = globalThis.fetch;
function req(path: string, body: unknown) {
  return new NextRequest(`http://localhost:3001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', host: 'localhost:3001' },
    body: JSON.stringify(body),
  });
}
const lines = () => info.mock.calls.map((c) => c.join(' '));

beforeEach(() => {
  info.mockClear();
  globalThis.fetch = vi.fn(async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }),
  })) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

describe('mutating bridge actions are logged once, without values', () => {
  it('setProperty logs action and target, not the value', async () => {
    await query(req('/api/ue5-bridge/query', { action: 'setProperty', objectPath: '/Game/X', propertyName: 'Hp', value: 'SECRET-VALUE' }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('setProperty');
    expect(lines()[0]).toContain('/Game/X.Hp');
    expect(lines()[0]).not.toContain('SECRET-VALUE');
  });

  it('callFunction logs the function, not its parameters', async () => {
    await query(req('/api/ue5-bridge/query', { action: 'callFunction', objectPath: '/Game/X', functionName: 'Heal', parameters: { Amount: 'SECRET-VALUE' } }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('/Game/X::Heal');
    expect(lines()[0]).not.toContain('SECRET-VALUE');
  });

  it('consoleCommand logs the command name, not its arguments', async () => {
    await query(req('/api/ue5-bridge/query', { action: 'consoleCommand', command: 'stat SECRET-VALUE' }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('consoleCommand');
    expect(lines()[0]).toContain('stat');
    expect(lines()[0]).not.toContain('SECRET-VALUE');
  });

  it('inject logs the definition asset once for a two-call injection', async () => {
    await inject(req('/api/ue5-inject-item', {
      definitionAsset: 'DA_Iron_Sword', itemLevel: 5,
      affixes: [{ tag: 'Affix.Fire', displayName: 'Fiery', magnitude: 1.5, bIsPrefix: true }],
    }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('DA_Iron_Sword');
  });

  it('hot-patch logs the file path, not the file content', async () => {
    await hotPatch(req('/api/pof-bridge/compile/hot-patch', { filePath: 'Source/PoF/A.cpp', fileContent: 'SECRET-VALUE' }));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('Source/PoF/A.cpp');
    expect(lines()[0]).not.toContain('SECRET-VALUE');
  });

  it('compile logs one line', async () => {
    await compile(req('/api/pof-bridge/compile', {}));
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('compile');
  });

  it('a refused request logs nothing', async () => {
    await query(req('/api/ue5-bridge/query', { action: 'setProperty', objectPath: '/Game/X' }));
    expect(lines()).toHaveLength(0);
  });
});
