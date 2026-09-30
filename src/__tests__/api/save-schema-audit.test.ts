/**
 * POST /api/save-schema/audit — read-only over the UE project's Source/.
 *
 * Walks Source/ with the shared `collectHeaders`, parses every header and returns the
 * USaveGame-derived classes. It must never write: the only UE write this surface makes is
 * the CLI task the Fix button dispatches (see SaveHeaderAudit.test.tsx).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { POST } from '@/app/api/save-schema/audit/route';

const SAVE_H = `#pragma once
#include "GameFramework/SaveGame.h"
#include "ARPGSaveGame.generated.h"

UCLASS()
class DID_API UARPGSaveGame : public USaveGame
{
\tGENERATED_BODY()
public:
\tUPROPERTY(SaveGame) int32 SchemaVersion = 1;
\tUPROPERTY(SaveGame) int32 PlayerLevel;
\tUPROPERTY(Transient) float CachedHealth;
};
`;

const CHAR_H = `#pragma once
UCLASS()
class DID_API AARPGCharacter : public ACharacter
{
\tGENERATED_BODY()
\tUPROPERTY() int32 Level;
};
`;

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'pof-save-audit-'));
  dirs.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/save-schema/audit', { method: 'POST', body: JSON.stringify(body) }));

/** Every file under `root`: relative path -> bytes + mtime, for a byte-identical comparison. */
function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else out[relative(root, full)] = `${statSync(full).mtimeMs}:${readFileSync(full).toString('base64')}`;
    }
  };
  walk(root);
  return out;
}

describe('POST /api/save-schema/audit', () => {
  it('case 8: returns the save class with its header path and properties; empty state is not an error; missing projectPath -> 400', async () => {
    const root = project({ 'Source/Did/Public/ARPGSaveGame.h': SAVE_H });
    const res = await post({ projectPath: root });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.headersScanned).toBe(1);
    expect(json.data.saveClasses).toHaveLength(1);
    const cls = json.data.saveClasses[0];
    expect(cls.name).toBe('UARPGSaveGame');
    expect(cls.headerPath).toBe('Source/Did/Public/ARPGSaveGame.h');
    expect(cls.properties.map((p: { name: string }) => p.name)).toEqual(['SchemaVersion', 'PlayerLevel', 'CachedHealth']);

    const noSave = project({ 'Source/Did/Public/ARPGCharacter.h': CHAR_H, 'Source/Did/Public/Other.h': '#pragma once\n' });
    const empty = await (await post({ projectPath: noSave })).json();
    expect(empty).toEqual({ success: true, data: { headersScanned: 2, saveClasses: [] } });

    const bad = await post({});
    expect(bad.status).toBe(400);
    expect((await bad.json()).success).toBe(false);
  });

  it('click gate (read-only half): the Source/ tree is byte-identical after the audit POST', async () => {
    const root = project({
      'Source/Did/Public/ARPGSaveGame.h': SAVE_H,
      'Source/Did/Private/ARPGSaveGame.cpp': '#include "ARPGSaveGame.h"\n',
      'Source/Did/Public/ARPGCharacter.h': CHAR_H,
    });
    const before = snapshotTree(root);
    const res = await post({ projectPath: root });
    expect((await res.json()).success).toBe(true);
    expect(snapshotTree(root)).toEqual(before);
  });
});
