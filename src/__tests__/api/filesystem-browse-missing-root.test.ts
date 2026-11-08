/**
 * A filesystem root has no parent. The listing of an existing directory says so with
 * `parent: null`; the branch for a directory that does not exist (an unplugged drive)
 * answered the root as its own parent, leaving the picker's Up button enabled on a no-op.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const fsMock = vi.hoisted(() => ({ stat: vi.fn(), readdir: vi.fn(), readFile: vi.fn(), access: vi.fn() }));
vi.mock('fs/promises', () => ({ default: fsMock, ...fsMock }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/filesystem/browse/route';

const list = (p: string) => POST(new NextRequest('http://localhost/api/filesystem/browse', {
  method: 'POST',
  body: JSON.stringify({ action: 'list', path: p }),
}));

describe('filesystem/browse list of a missing path', () => {
  beforeEach(() => {
    fsMock.stat.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  });

  it('a missing filesystem root has no parent', async () => {
    const root = path.parse(process.cwd()).root;
    const body = await (await list(root)).json();
    expect(body.data.directories).toEqual([]);
    expect(body.data.parent).toBeNull();
  });

  it('[guard] a missing directory below the root keeps its parent', async () => {
    const root = path.parse(process.cwd()).root;
    const body = await (await list(path.join(root, 'nope', 'child'))).json();
    expect(body.data.parent).toBe(path.join(root, 'nope'));
  });
});
