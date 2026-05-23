import { describe, it, expect, vi } from 'vitest';
import {
  buildKeepAliveLaunchArgs, KeepAliveEditor, type EditorTransport,
} from './keep-alive-editor';

function fakeTransport(overrides: Partial<EditorTransport> = {}) {
  const calls = { start: 0, send: [] as string[], stop: 0 };
  const transport: EditorTransport = {
    start: vi.fn(async () => { calls.start += 1; }),
    send: vi.fn(async (cmd: string) => { calls.send.push(cmd); return `out:${cmd}`; }),
    stop: vi.fn(async () => { calls.stop += 1; }),
    ...overrides,
  };
  return { transport, calls };
}

describe('buildKeepAliveLaunchArgs', () => {
  it('opens the slice, enables Python, and bootstraps a ready marker', () => {
    const args = buildKeepAliveLaunchArgs();
    expect(args.some((a) => a.includes('PoF.uproject'))).toBe(true);
    expect(args).toContain('/Game/Maps/VerticalSlice');
    expect(args.some((a) => a.includes('POF_KEEPALIVE_READY'))).toBe(true);
    expect(args).toContain('-EnablePlugins=PythonScriptPlugin');
    expect(args).toContain('-unattended');
  });

  it('honours overrides', () => {
    const args = buildKeepAliveLaunchArgs({ uproject: 'X.uproject', map: '/Game/Foo', extraExecCmds: ['py print(1)'] });
    expect(args).toContain('X.uproject');
    expect(args).toContain('/Game/Foo');
    expect(args.find((a) => a.startsWith('-ExecCmds='))).toContain('py print(1)');
  });
});

describe('KeepAliveEditor', () => {
  it('starts the editor lazily and only once across multiple runs', async () => {
    const { transport, calls } = fakeTransport();
    const editor = new KeepAliveEditor(transport);

    expect(editor.getState()).toBe('idle');
    const a = await editor.run('cmd1');
    const b = await editor.run('cmd2');

    expect(a).toBe('out:cmd1');
    expect(b).toBe('out:cmd2');
    expect(calls.start).toBe(1);          // reused, not relaunched
    expect(editor.getReuseCount()).toBe(2);
    expect(editor.getState()).toBe('ready');
  });

  it('serializes concurrent runs and still starts once', async () => {
    const { transport, calls } = fakeTransport();
    const editor = new KeepAliveEditor(transport);

    const [r1, r2] = await Promise.all([editor.run('a'), editor.run('b')]);
    expect([r1, r2].sort()).toEqual(['out:a', 'out:b']);
    expect(calls.start).toBe(1);
    expect(editor.getReuseCount()).toBe(2);
  });

  it('stop() terminates the transport and blocks further runs', async () => {
    const { transport, calls } = fakeTransport();
    const editor = new KeepAliveEditor(transport);
    await editor.run('x');
    await editor.stop();

    expect(calls.stop).toBe(1);
    expect(editor.getState()).toBe('stopped');
    await expect(editor.run('y')).rejects.toThrow(/stopped/);
  });

  it('stop() is idempotent', async () => {
    const { transport, calls } = fakeTransport();
    const editor = new KeepAliveEditor(transport);
    await editor.stop();
    await editor.stop();
    expect(calls.stop).toBe(1);
  });
});
