/**
 * The watcher must not report this process's own writes as source changes.
 *
 * `startWatching` watches `<project>/Source` recursively, and `applyWrite`
 * (the Blueprint transpiler's write door) writes `.h`/`.cpp` INTO
 * `Source/<Module>/`. Every emitted declaration reaches
 * `useFileWatcher.autoVerify`, which marks the matching checklist item done
 * and forces a project re-scan — so our own output is counted as evidence
 * that the user's project grew.
 *
 * This file is the instrument for that claim, and it imports nothing that
 * only one side of the change has: it runs byte-identical against the
 * unfiltered watcher (where the target assertion must FAIL — a test that
 * passes on both sides measured nothing) and against the filtered one.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startWatching, stopWatching, subscribe, type FileChangeEvent } from '@/lib/file-watcher';
import { applyWrite } from '@/lib/blueprint-transpiler-write';

const SETTLE_MS = 1500;
const MODULE = 'PoF';

const settle = () => new Promise((r) => setTimeout(r, SETTLE_MS));

function header(cls: string, marker: string): string {
  return [
    '#pragma once',
    '#include "CoreMinimal.h"',
    `// ${marker}`,
    'UCLASS()',
    `class POF_API ${cls} : public AActor`,
    '{',
    '  GENERATED_BODY()',
    '};',
    '',
  ].join('\n');
}

function source(cls: string): string {
  return [`#include "${cls}.h"`, '', `${cls}::${cls}() {}`, ''].join('\n');
}

describe('own writes do not re-enter the watch stream', () => {
  let root: string | null = null;
  let unsubscribe: (() => void) | null = null;

  afterEach(async () => {
    stopWatching();
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (root) await fsp.rm(root, { recursive: true, force: true }).catch(() => {});
    root = null;
  });

  it('reports foreign edits and suppresses its own output', async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), 'pof-echo-'));
    await fsp.writeFile(path.join(root, 'Fake.uproject'), '{}', 'utf8');
    const moduleDir = path.join(root, 'Source', MODULE);
    await fsp.mkdir(moduleDir, { recursive: true });

    const seen: FileChangeEvent[] = [];
    unsubscribe = subscribe((events) => { seen.push(...events); });
    expect(startWatching(root)).toBe(true);

    const countFor = (stem: string) =>
      seen.filter((e) => e.relativePath.startsWith(`${MODULE}/${stem}`)).length;

    // PC1 — the listener can hear: a hand-authored header nobody claimed.
    await fsp.writeFile(
      path.join(moduleDir, 'AHandAuthored.h'),
      header('AHandAuthored', 'written by a human'),
      'utf8',
    );
    await settle();
    const pc1 = countFor('AHandAuthored');

    // TARGET — our own write door, through the real `applyWrite`.
    const own = 'AGeneratedThing';
    await applyWrite({
      projectPath: root,
      moduleName: MODULE,
      className: own,
      header: header(own, 'written by the transpiler'),
      source: source(own),
    });
    await settle();
    const echoes = countFor(own);

    // PC4 — the suppression is one-shot: the same path, edited by a foreign
    // hand after our write was accounted for.
    await fsp.writeFile(
      path.join(moduleDir, `${own}.h`),
      header(own, 'edited by a human afterwards'),
      'utf8',
    );
    await settle();
    const pc4 = countFor(own) - echoes;

    const foreign = pc1 + pc4;
    // eslint-disable-next-line no-console
    console.log(`[c26] echoes=${echoes} pc1=${pc1} pc4=${pc4} foreign=${foreign}`);

    // Floor — the foreign-origin events must survive the change.
    expect(pc1, 'PC1: an unclaimed hand-authored header must reach subscribers').toBeGreaterThanOrEqual(1);
    expect(pc4, 'PC4: a later foreign edit to a path we wrote must emit').toBeGreaterThanOrEqual(1);
    expect(foreign, 'floor: two foreign-origin events reach subscribers').toBe(2);

    // Target — neither of our own two files may be reported as a source change.
    expect(echoes, 'target: our own .h/.cpp must not be reported as source changes').toBe(0);
  }, 60_000);
});
