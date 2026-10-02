/**
 * POST /api/filesystem/verify-semantic reads each header on its own: one unreadable header
 * is disclosed in `unreadable[]` (relative to Source/) instead of failing the whole request,
 * and a {moduleId,itemId} item is verified against its owner's expectations and echoed.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fsPromises from 'fs/promises';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/filesystem/verify-semantic/route';

const ITEM_DEF_H = `#pragma once
UCLASS()
class DID_API UARPGItemDefinition : public UPrimaryDataAsset
{
\tGENERATED_BODY()
public:
\tUPROPERTY(EditAnywhere) FText ItemName;
\tUPROPERTY(EditAnywhere) EItemType ItemType;
\tUPROPERTY(EditAnywhere) EItemRarity Rarity;
\tUPROPERTY(EditAnywhere) int32 MaxStack;
\tUPROPERTY(EditAnywhere) float Weight;
};
`;

const OTHER_H = `#pragma once
UCLASS()
class DID_API UOther : public UObject
{
\tGENERATED_BODY()
};
`;

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'pof-verify-semantic-'));
  dirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/filesystem/verify-semantic', { method: 'POST', body: JSON.stringify(body) }));

describe('verify-semantic — per-file read tolerance', () => {
  it('one unreadable header is disclosed, the rest still verify', async () => {
    const root = project({ 'Source/M/A.h': ITEM_DEF_H, 'Source/M/B.h': OTHER_H });
    const realRead = fsPromises.readFile.bind(fsPromises);
    vi.spyOn(fsPromises, 'readFile').mockImplementation(((p: Parameters<typeof fsPromises.readFile>[0], ...rest: unknown[]) => {
      if (String(p).endsWith('B.h')) return Promise.reject(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
      return (realRead as (...a: unknown[]) => Promise<unknown>)(p, ...rest);
    }) as typeof fsPromises.readFile);

    const res = await post({ projectPath: root, items: [{ moduleId: 'arpg-inventory', itemId: 'ai-1' }] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.unreadable).toEqual(['M/B.h']);
    expect(json.data.results).toHaveLength(1);
    expect(json.data.results[0]).toMatchObject({ moduleId: 'arpg-inventory', itemId: 'ai-1', status: 'full' });
  });

  it('an item whose id another module owns resolves to no-expectations for the asking module', async () => {
    const root = project({ 'Source/M/A.h': ITEM_DEF_H });
    const res = await post({ projectPath: root, items: [{ moduleId: 'ai-behavior', itemId: 'ai-1' }] });
    const json = await res.json();
    expect(json.data.results[0]).toMatchObject({ moduleId: 'ai-behavior', itemId: 'ai-1', status: 'no-expectations' });
    expect(json.data.unreadable).toEqual([]);
  });
});
