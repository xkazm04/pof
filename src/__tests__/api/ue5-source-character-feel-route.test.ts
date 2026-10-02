import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/ue5-source/character-feel/route';
import { FEEL_UE_BINDINGS, type ParsedFeelDefaults } from '@/lib/character/feel-ue-sync';

interface FeelReadData {
  moduleName: string;
  scannedFiles: number;
  files: string[];
  fields: ParsedFeelDefaults;
}

const post = (body: unknown) => POST(new Request('http://localhost:3000/api/ue5-source/character-feel', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}) as unknown as NextRequest);

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pof-feel-ue-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('POST /api/ue5-source/character-feel (case 8)', () => {
  it('rejects a relative projectPath with 400', async () => {
    const res = await post({ projectPath: 'relative/x' });
    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
  });

  it('reads literal defaults from Source/<Module> of the fixture project', async () => {
    fs.writeFileSync(path.join(tmp, 'Did.uproject'), '{}');
    const charDir = path.join(tmp, 'Source', 'Did', 'Character');
    fs.mkdirSync(charDir, { recursive: true });
    fs.writeFileSync(path.join(charDir, 'ARPGCharacterBase.cpp'), 'MoveComp->MaxWalkSpeed = 600.f;');
    // Not a character/dodge/camera path — never scanned.
    fs.mkdirSync(path.join(tmp, 'Source', 'Did', 'Loot'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'Source', 'Did', 'Loot', 'LootTable.cpp'), 'MaxWalkSpeed = 1.f;');

    const res = await post({ projectPath: tmp });
    const json = await res.json();
    expect(json.success).toBe(true);
    const data = json.data as FeelReadData;
    expect(data.moduleName).toBe('Did');
    expect(data.scannedFiles).toBe(1);
    expect(data.files).toEqual(['Character/ARPGCharacterBase.cpp']);
    expect(data.fields['movement.maxWalkSpeed']).toMatchObject({
      status: 'found', value: 600, path: 'Character/ARPGCharacterBase.cpp', line: 1,
    });
  });

  it('a project without Source/ answers scannedFiles 0 and every row absent — never an empty map', async () => {
    fs.writeFileSync(path.join(tmp, 'Did.uproject'), '{}');
    const res = await post({ projectPath: tmp });
    const json = await res.json();
    expect(json.success).toBe(true);
    const data = json.data as FeelReadData;
    expect(data.scannedFiles).toBe(0);
    const rows = Object.values(data.fields);
    expect(rows).toHaveLength(FEEL_UE_BINDINGS.length);
    expect(rows.every((r) => r.status === 'absent')).toBe(true);
  });
});
