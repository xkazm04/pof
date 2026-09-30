import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { settleRunCallbacks, sanitizeCallbackDescriptors, type CallbackPost } from '@/lib/claude-terminal/run-callbacks';
import type { TaskCallback } from '@/lib/cli-task';

// scan-sweep --challenge cli-terminal-system/A — the server settles a terminal run's
// @@CALLBACKs; the browser tab no longer POSTs them.

const CB1: TaskCallback = {
  id: 'cb-1', url: 'http://h/api/checklist/complete', method: 'POST', staticFields: { moduleId: 'm' }, schemaHint: '',
};
const MARKER = '@@CALLBACK:cb-1\n{"completed":true}\n@@END_CALLBACK';

function okPost() {
  return vi.fn<CallbackPost>(async () => ({ success: true }));
}

describe('settleRunCallbacks', () => {
  it('POSTs a declared marker once to its own-origin /api/ path, static fields winning', async () => {
    const post = okPost();
    const out = await settleRunCallbacks({
      text: `working...\n${MARKER}`, callbacks: [CB1], appOrigin: 'http://h',
      post,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({
      url: 'http://h/api/checklist/complete', method: 'POST', body: { completed: true, moduleId: 'm' },
    });
    expect(out).toEqual({ status: 'confirmed', failed: [] });
  });

  it('static fields override a payload that tries to set them', async () => {
    const post = okPost();
    await settleRunCallbacks({
      text: '@@CALLBACK:cb-1\n{"completed":true,"moduleId":"evil"}\n@@END_CALLBACK',
      callbacks: [CB1], appOrigin: 'http://h', post,
    });
    expect(post.mock.calls[0][0].body).toEqual({ completed: true, moduleId: 'm' });
  });

  it('[revision] a descriptor naming another host is failed and never POSTed — the server is no relay', async () => {
    const post = okPost();
    const evil: TaskCallback = { ...CB1, url: 'http://evil:1/api/x' };
    const out = await settleRunCallbacks({ text: MARKER, callbacks: [evil], appOrigin: 'http://h', post });
    expect(post).not.toHaveBeenCalled();
    expect(out.status).toBe('failed');
    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].callbackId).toBe('cb-1');
  });

  it('[revision] a same-origin path outside /api/ (or escaping it) is failed and never POSTed', async () => {
    const post = okPost();
    for (const url of ['http://h/admin', 'http://h/api/../secret', '/apix/y']) {
      const out = await settleRunCallbacks({ text: MARKER, callbacks: [{ ...CB1, url }], appOrigin: 'http://h', post });
      expect(out.status).toBe('failed');
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('a relative /api/ descriptor resolves against the app origin', async () => {
    const post = okPost();
    await settleRunCallbacks({ text: MARKER, callbacks: [{ ...CB1, url: '/api/checklist/complete' }], appOrigin: 'http://h:3000', post });
    expect(post.mock.calls[0][0].url).toBe('http://h:3000/api/checklist/complete');
  });

  it('the same marker twice (pre-hide copy + replayed copy) POSTs exactly once', async () => {
    const post = okPost();
    const out = await settleRunCallbacks({ text: `${MARKER}\n...\n${MARKER}`, callbacks: [CB1], appOrigin: 'http://h', post });
    expect(post).toHaveBeenCalledTimes(1);
    expect(out.status).toBe('confirmed');
  });

  it('a rejected POST is failed with its payload and error', async () => {
    const post = vi.fn<CallbackPost>(async () => ({ success: false, error: 'bad' }));
    const out = await settleRunCallbacks({ text: MARKER, callbacks: [CB1], appOrigin: 'http://h', post });
    expect(out).toEqual({ status: 'failed', failed: [{ callbackId: 'cb-1', payload: '{"completed":true}', error: 'bad' }] });
  });

  it('declared callbacks with no marker in the text are missing — nothing is POSTed', async () => {
    const post = okPost();
    const out = await settleRunCallbacks({ text: 'I did it but forgot the marker', callbacks: [CB1], appOrigin: 'http://h', post });
    expect(out).toEqual({ status: 'missing', failed: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it('[guard] no callbacks declared -> status null, nothing POSTed (interactive / one-shot / batch-review unchanged)', async () => {
    const post = okPost();
    const out = await settleRunCallbacks({ text: MARKER, callbacks: [], appOrigin: 'http://h', post });
    expect(out).toEqual({ status: null, failed: [] });
    expect(post).not.toHaveBeenCalled();
  });

  it('a marker whose id was not declared is ignored (never POSTed)', async () => {
    const post = okPost();
    const out = await settleRunCallbacks({
      text: '@@CALLBACK:cb-other\n{"a":1}\n@@END_CALLBACK', callbacks: [CB1], appOrigin: 'http://h', post,
    });
    expect(post).not.toHaveBeenCalled();
    expect(out.status).toBe('missing');
  });

  it('[guard] every registered callback route in cli-task-handlers settles through its own-origin /api/ path exactly once', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/cli-task-handlers.ts'), 'utf8');
    const registrations = src.match(/registerCallback\(/g) ?? [];
    const urls = [...src.matchAll(/url:\s*`\$\{\w+\.appOrigin\}(\/api\/[^`]*)`/g)].map((m) => m[1]);
    // Every registration builds its url as `${appOrigin}/api/...` — the shape the server accepts.
    expect(registrations.length).toBeGreaterThan(0);
    expect(urls).toHaveLength(registrations.length);
    for (const [i, apiPath] of urls.entries()) {
      const post = okPost();
      const cb: TaskCallback = { id: `cb-${i}`, url: `http://localhost:3000${apiPath}`, method: 'POST', staticFields: { k: i }, schemaHint: '' };
      const m = `@@CALLBACK:cb-${i}\n{"ok":true}\n@@END_CALLBACK`;
      const out = await settleRunCallbacks({ text: `${m}\n${m}`, callbacks: [cb], appOrigin: 'http://localhost:3000', post });
      expect(out.status).toBe('confirmed');
      expect(post).toHaveBeenCalledTimes(1);
      expect(post.mock.calls[0][0].url).toBe(`http://localhost:3000${apiPath}`);
    }
  });
});

describe('sanitizeCallbackDescriptors', () => {
  it('keeps well-formed descriptors unchanged and drops malformed ones', () => {
    expect(sanitizeCallbackDescriptors([CB1, { id: 5 }, null, 'x', { ...CB1, id: 'cb-2', method: 'DELETE' }])).toEqual([CB1]);
    expect(sanitizeCallbackDescriptors(undefined)).toEqual([]);
  });
});
