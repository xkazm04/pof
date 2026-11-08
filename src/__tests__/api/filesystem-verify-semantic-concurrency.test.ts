/**
 * verify-semantic opens headers in bounded batches like its siblings (scan-project and
 * scan-animbp batch by 20): an unbatched Promise.all over a large Source tree would hit
 * EMFILE, which this route records as "unreadable" and so silently drops from the verdict.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/filesystem/verify-semantic/route';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

function project(headerCount: number): string {
  const root = mkdtempSync(join(tmpdir(), 'pof-verify-conc-'));
  roots.push(root);
  const src = join(root, 'Source', 'Game');
  mkdirSync(src, { recursive: true });
  for (let i = 0; i < headerCount; i++) writeFileSync(join(src, `H${i}.h`), `class H${i} {};`);
  return root;
}

/** Peak number of header reads in flight at once, and how many were issued. */
async function peakReads(headerCount: number) {
  const real = fsPromises.readFile.bind(fsPromises);
  let inFlight = 0;
  let peak = 0;
  let calls = 0;
  vi.spyOn(fsPromises, 'readFile').mockImplementation((async (...args: Parameters<typeof real>) => {
    calls++;
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    try {
      return await real(...args);
    } finally {
      inFlight--;
    }
  }) as typeof fsPromises.readFile);
  const res = await POST(new NextRequest('http://localhost/api/filesystem/verify-semantic', {
    method: 'POST',
    body: JSON.stringify({ projectPath: project(headerCount), items: [{ moduleId: 'arpg-combat', itemId: 'x' }] }),
  }));
  expect(res.status).toBe(200);
  const unreadable = ((await res.json()).data as { unreadable?: string[] }).unreadable ?? [];
  return { peak, calls, unreadable };
}

describe('verify-semantic header read concurrency', () => {
  it('never has more than 20 header reads in flight', async () => {
    const { peak, calls, unreadable } = await peakReads(100);
    expect(calls).toBe(100);
    expect(unreadable).toEqual([]);
    expect(peak).toBeLessThanOrEqual(20);
  });

  it('[guard] fewer headers than a batch are all read', async () => {
    const { peak, calls } = await peakReads(7);
    expect(calls).toBe(7);
    expect(peak).toBe(7);
  });
});
