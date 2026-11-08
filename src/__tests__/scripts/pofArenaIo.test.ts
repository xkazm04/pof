// @vitest-environment node
/**
 * The smart-low-poly arena's two I/O seams (scripts/visual-gen/pof_arena_io.ts).
 * FAKES ONLY: a scripted child process stands in for python, a stub fetch for the render URL.
 */
import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';

type Script = (child: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter }) => void;
const h = vi.hoisted(() => ({ script: null as null | Script }));

vi.mock('node:child_process', () => ({
  spawn: () => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    setImmediate(() => h.script?.(child));
    return child;
  },
}));

import { runCritiqueScript, downloadToBase64 } from '../../../scripts/visual-gen/pof_arena_io';

describe('runCritiqueScript', () => {
  it('keeps output that arrives after the exit event and before close', async () => {
    h.script = (c) => {
      c.emit('exit', 0);
      setTimeout(() => { c.stdout.emit('data', Buffer.from('LATE_METRICS')); c.emit('close', 0); }, 20);
    };
    const r = await runCritiqueScript('x.glb', { python: 'python' });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('LATE_METRICS');
  });

  it('reports a spawn error as such, with no exit code', async () => {
    h.script = (c) => { c.emit('error', new Error('spawn python ENOENT')); };
    const r = await runCritiqueScript('x.glb', { python: 'python' });
    expect(r.code).toBeNull();
    expect(r.stdout).toContain('could not start');
  });
});

describe('downloadToBase64', () => {
  const stub = (status: number, body: string) =>
    (async () => new Response(body, { status, headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;

  it('refuses a non-OK render instead of encoding the error body', async () => {
    await expect(downloadToBase64('https://cdn.test/r.png', stub(403, 'Forbidden'))).rejects.toThrow('403');
  });

  it('encodes an OK render with its mime', async () => {
    const img = await downloadToBase64('https://cdn.test/r.png', stub(200, 'PNG'));
    expect(img).toEqual({ mime: 'image/png', base64: Buffer.from('PNG').toString('base64') });
  });
});
