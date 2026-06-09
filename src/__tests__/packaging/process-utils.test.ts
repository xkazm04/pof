import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { spawnCapture, type SpawnFn } from '@/lib/packaging/process-utils';

/**
 * Build a fake ChildProcess: an EventEmitter (for `error`/`exit`) with
 * `stdout`/`stderr` emitters and a spy `kill`. Lets us drive spawnCapture's
 * accumulate/timeout/abort wiring without launching a real process.
 */
function makeFakeChild() {
  const child = new EventEmitter() as unknown as {
    stdout: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
    stderr: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
    emit: EventEmitter['emit'];
  };
  const stdout = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
  stdout.setEncoding = vi.fn();
  const stderr = new EventEmitter() as EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
  stderr.setEncoding = vi.fn();
  child.stdout = stdout;
  child.stderr = stderr;
  child.kill = vi.fn();
  return child;
}

describe('spawnCapture', () => {
  it('accumulates stdout and stderr then resolves on exit', async () => {
    const child = makeFakeChild();
    const spawnFn = vi.fn(() => child) as unknown as SpawnFn;
    const p = spawnCapture('cmd', ['a'], { spawnFn });

    child.stdout.emit('data', 'out1 ');
    child.stderr.emit('data', 'err1 ');
    child.stdout.emit('data', 'out2');
    child.emit('exit', 0);

    const result = await p;
    expect(result).toEqual({ output: 'out1 err1 out2', spawnError: null });
    expect(spawnFn).toHaveBeenCalledWith('cmd', ['a'], { stdio: ['ignore', 'pipe', 'pipe'] });
  });

  it('resolves with spawnError when the process cannot be launched', async () => {
    const spawnFn = vi.fn(() => { throw new Error('ENOENT spawn'); }) as unknown as SpawnFn;
    const result = await spawnCapture('missing', [], { spawnFn });
    expect(result.output).toBe('');
    expect(result.spawnError).toContain('ENOENT spawn');
  });

  it('resolves with the captured output and spawnError when the child errors', async () => {
    const child = makeFakeChild();
    const p = spawnCapture('cmd', [], { spawnFn: (() => child) as unknown as SpawnFn });

    child.stdout.emit('data', 'partial');
    child.emit('error', new Error('boom'));

    const result = await p;
    expect(result.output).toBe('partial');
    expect(result.spawnError).toContain('boom');
  });

  it('kills the child when the timeout elapses', async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      const p = spawnCapture('cmd', [], {
        spawnFn: (() => child) as unknown as SpawnFn,
        timeoutMs: 1000,
      });
      vi.advanceTimersByTime(1000);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      child.emit('exit', null);
      await p;
    } finally {
      vi.useRealTimers();
    }
  });

  it('kills the child when the abort signal fires', async () => {
    const child = makeFakeChild();
    const controller = new AbortController();
    const p = spawnCapture('cmd', [], {
      spawnFn: (() => child) as unknown as SpawnFn,
      signal: controller.signal,
    });
    controller.abort();
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.emit('exit', null);
    await p;
  });
});
