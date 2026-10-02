/**
 * POST /api/localization-pipeline — scans the configured UE project's Source/ read-only
 * (scan-sweep challenge localization-pipeline/A).
 *
 * With a projectPath the route reads `<projectPath>/Source` through the shared walker and
 * reports what it read (`provenance {kind:'project', filesScanned}`); a projectPath with no
 * Source/ is a 400, never a silent fall back to the demo corpus; no projectPath answers the
 * demo corpus labelled `provenance.kind 'fixture'`. The scan never writes and never leaves
 * the project root (a junction under Source/ pointing outside contributes nothing).
 *
 * Fixtures live only in OS temp dirs. Junctions are removed on the LINK itself before any
 * recursive delete — a recursive delete through a junction would wipe its target.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync, symlinkSync, lstatSync, unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { POST } from '@/app/api/localization-pipeline/route';
import { DEFAULT_CONFIG } from '@/lib/localization/definitions';
import { collectHeaders } from '@/lib/ue-source/collect-headers';
import { readProjectUnits } from '@/lib/localization/project-source';

const MENU_CPP = [
  '#include "WBP_Menu.h"',                                                  // 1
  '',                                                                       // 2
  'void UWBP_Menu::NativeConstruct()',                                      // 3
  '{',                                                                      // 4
  '  Super::NativeConstruct();',                                            // 5
  '  TitleText->SetText(FText::FromString(TEXT("Main Menu")));',            // 6
  '  StartButtonText->SetText(FText::FromString("Start Game"));',           // 7
  '  QuitLabel->SetText(NSLOCTEXT("Game.UI", "QuitKey", "Quit"));',         // 8
  '}',                                                                      // 9
].join('\n');
const LINE_OF: Record<string, number> = { 'Main Menu': 6, 'Start Game': 7, Quit: 8 };

const MENU_H = '#pragma once\nUCLASS()\nclass UWBP_Menu : public UUserWidget\n{\n\tGENERATED_BODY()\n};\n';

const dirs: string[] = [];
const links: string[] = [];

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  return d;
}

function project(files: Record<string, string>): string {
  const root = tmp('pof-loc-scan-');
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

afterEach(() => {
  // Remove every junction on the LINK first; refuse to recurse while one still exists.
  // (rmSync refuses a junction as "a directory" on Node 24; unlink removes only the link.)
  while (links.length) {
    const link = links.pop()!;
    unlinkSync(link);
    let stillThere = true;
    try { lstatSync(link); } catch { stillThere = false; }
    if (stillThere) throw new Error(`junction ${link} survived removal; refusing recursive cleanup`);
  }
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/localization-pipeline', { method: 'POST', body: JSON.stringify(body) }));

/** Every regular file under `root`: relative path -> mtime + bytes. Never follows links. */
function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(full);
      else out[relative(root, full)] = `${statSync(full).mtimeMs}:${readFileSync(full).toString('base64')}`;
    }
  };
  walk(root);
  return out;
}

describe('POST /api/localization-pipeline', () => {
  it('case 5: scans <projectPath>/Source and reports real lines + provenance', async () => {
    const root = project({ 'Source/Game/UI/WBP_Menu.cpp': MENU_CPP });
    const res = await post({ action: 'scan', config: DEFAULT_CONFIG, projectPath: root });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.provenance).toMatchObject({ kind: 'project', filesScanned: 1 });
    expect(json.data.totalStringsFound).toBe(3);
    expect(json.data.alreadyLocalizedCount).toBe(1);
    for (const s of json.data.strings) {
      expect(s.locations[0].lineNumber).toBe(LINE_OF[s.sourceText]);
      expect(s.locations[0].filePath).toBe('Source/Game/UI/WBP_Menu.cpp');
    }
  });

  it('case 6: a projectPath with no Source/ is a 400 naming Source, never the demo corpus', async () => {
    const root = tmp('pof-loc-nosrc-');
    const res = await post({ action: 'full-pipeline', config: DEFAULT_CONFIG, projectPath: root });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Source/);
  });

  it('case 7: no projectPath -> the demo corpus, labelled as a fixture', async () => {
    const res = await post({ action: 'scan', config: DEFAULT_CONFIG });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.provenance.kind).toBe('fixture');
    expect(json.data.totalStringsFound).toBe(39);
  });

  it('case 8 [guard]: read-only, collectHeaders unchanged, and a junction out of the project contributes nothing', async () => {
    const root = project({ 'Source/Game/UI/WBP_Menu.cpp': MENU_CPP });
    const before = snapshotTree(root);
    const res = await post({ action: 'scan', config: DEFAULT_CONFIG, projectPath: root });
    expect((await res.json()).success).toBe(true);
    expect(snapshotTree(root)).toEqual(before);

    // An outside dir holding a hardcoded string, linked into Source/ by a junction.
    const outside = tmp('pof-loc-outside-');
    writeFileSync(join(outside, 'Evil.cpp'), 'void Evil() { Label->SetText(FText::FromString(TEXT("Pwned"))); }\n');
    const link = join(root, 'Source', 'Game', 'Linked');
    symlinkSync(outside, link, 'junction');
    links.push(link);

    const read = await readProjectUnits(root);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.units).toHaveLength(3);
    expect(read.data.units.some((u) => u.text === 'Pwned')).toBe(false);
    expect(read.data.provenance.filesScanned).toBe(1);
    for (const u of read.data.units) {
      expect(u.filePath.startsWith('Source/')).toBe(true);
      expect(u.filePath).not.toContain('\\');
      expect(u.filePath.split('/')).not.toContain('..');
    }

    const viaRoute = await (await post({ action: 'scan', config: DEFAULT_CONFIG, projectPath: root })).json();
    expect(viaRoute.data.provenance.filesScanned).toBe(1);
    expect(viaRoute.data.totalStringsFound).toBe(3);

    // The shared header walker is unchanged by the generalisation: .h only, never .cpp.
    writeFileSync(join(root, 'Source/Game/UI/WBP_Menu.h'), MENU_H);
    const headers = await collectHeaders(join(root, 'Source'));
    expect(headers).toHaveLength(1);
    expect(headers[0].endsWith(join('UI', 'WBP_Menu.h'))).toBe(true);
  });
});
