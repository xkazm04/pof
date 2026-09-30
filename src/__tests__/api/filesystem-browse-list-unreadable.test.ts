import { describe, it, expect, vi, beforeEach } from 'vitest';

// A directory that exists (stat says so) but whose listing is refused. The
// Start Fresh collision check reads this listing, so an unreadable root must
// surface as an error, never as "no entries" (which reads as "no collision").
const fsMock = vi.hoisted(() => ({
  stat: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  access: vi.fn(),
}));
vi.mock('fs/promises', () => ({ default: fsMock, ...fsMock }));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/filesystem/browse/route';

function list(path: string): NextRequest {
  return new NextRequest('http://localhost/api/filesystem/browse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list', path }),
  });
}

const reject = (code: string) => () => Promise.reject(Object.assign(new Error(code), { code }));

describe('filesystem/browse list fails closed on an unreadable directory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.readFile.mockImplementation(reject('ENOENT'));
    fsMock.access.mockImplementation(reject('ENOENT'));
  });

  it('an existing directory whose listing is refused answers an error, not an empty listing', async () => {
    fsMock.stat.mockResolvedValue({ isDirectory: () => true });
    fsMock.readdir.mockImplementation(reject('EACCES'));

    const res = await POST(list('C:\\Users\\me\\Documents\\Unreal Projects'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/cannot read directory/i);
    expect(body.data).toBeUndefined();
  });

  it('[guard] a directory that does not exist still answers an empty listing', async () => {
    fsMock.stat.mockImplementation(reject('ENOENT'));
    fsMock.readdir.mockImplementation(reject('ENOENT'));

    const res = await POST(list('C:\\Users\\me\\Documents\\Unreal Projects'));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.directories).toEqual([]);
    expect(body.data.isUEProject).toBe(false);
  });

  it('[guard] a readable directory lists its subdirectories', async () => {
    fsMock.stat.mockResolvedValue({ isDirectory: () => true });
    fsMock.readdir.mockImplementation(async (dir: string) =>
      dir.endsWith('Unreal Projects')
        ? [{ name: 'MyGame', isDirectory: () => true, isFile: () => false }]
        : [],
    );

    const res = await POST(list('C:\\Users\\me\\Documents\\Unreal Projects'));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.directories.map((d: { name: string }) => d.name)).toEqual(['MyGame']);
  });
});
