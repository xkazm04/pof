# Write Transpiled C++ to UE Project (clean core) — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A server-side lib + API route that resolves `Source/<Module>/<Class>.h|.cpp`, produces a dry-run diff vs disk, and writes on confirm — with a path-traversal guard. UI button deferred.

**Spec:** `docs/superpowers/specs/2026-05-28-transpiler-write-to-project-design.md`

---

## Task 1: Write lib (resolve / plan / apply)

**Files:**
- Create: `src/lib/blueprint-transpiler-write.ts`
- Test: `src/__tests__/lib/blueprint-transpiler-write.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/blueprint-transpiler-write.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { resolveTargetPaths, planWrite, applyWrite } from '@/lib/blueprint-transpiler-write';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pof-write-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

const base = (over = {}) => ({
  projectPath: root, moduleName: 'PoF', className: 'AARPGFireball',
  header: '#pragma once\nclass AARPGFireball {};\n',
  source: '#include "AARPGFireball.h"\n',
  ...over,
});

describe('resolveTargetPaths', () => {
  it('rejects non-identifier module/class names', () => {
    expect(() => resolveTargetPaths(base({ className: '../evil' }))).toThrow();
    expect(() => resolveTargetPaths(base({ moduleName: 'a/b' }))).toThrow();
  });
  it('builds Source/<Module>/<Class>.h|.cpp under the project', () => {
    const r = resolveTargetPaths(base());
    expect(r.headerPath).toBe(path.join(root, 'Source', 'PoF', 'AARPGFireball.h'));
    expect(r.sourcePath).toBe(path.join(root, 'Source', 'PoF', 'AARPGFireball.cpp'));
    expect(r.relHeader).toBe('Source/PoF/AARPGFireball.h');
  });
});

describe('planWrite (dry-run)', () => {
  it('reports both files absent with an all-insertion diff and writes nothing', async () => {
    const plan = await planWrite(base());
    expect(plan.files).toHaveLength(2);
    for (const f of plan.files) {
      expect(f.exists).toBe(false);
      expect(f.diff.summary.added).toBeGreaterThan(0);
      expect(f.diff.summary.removed).toBe(0);
    }
    await expect(fs.access(plan.files[0].path)).rejects.toBeTruthy(); // nothing written
  });
});

describe('applyWrite', () => {
  it('writes header + source and returns their paths', async () => {
    const res = await applyWrite(base());
    expect(res.written).toHaveLength(2);
    const h = await fs.readFile(path.join(root, 'Source', 'PoF', 'AARPGFireball.h'), 'utf8');
    expect(h).toContain('class AARPGFireball');
  });

  it('a later planWrite against changed content shows a real before/after diff', async () => {
    await applyWrite(base());
    const plan = await planWrite(base({ header: '#pragma once\nclass AARPGFireball { int hp; };\n' }));
    const header = plan.files.find((f) => f.relPath.endsWith('.h'))!;
    expect(header.exists).toBe(true);
    expect(header.diff.summary.added).toBeGreaterThan(0);
    expect(header.diff.summary.removed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/blueprint-transpiler-write.test.ts`
Expected: FAIL — cannot resolve `@/lib/blueprint-transpiler-write`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blueprint-transpiler-write.ts`:

```ts
import fs from 'fs/promises';
import path from 'path';
import { diffPrompts, type PromptDiff } from './text-diff';

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface WriteInput {
  projectPath: string;
  moduleName: string;
  className: string;
  header: string;
  source: string;
}

export interface FileWritePlan {
  path: string;
  relPath: string;
  exists: boolean;
  diff: PromptDiff;
}

export interface WritePlan {
  files: FileWritePlan[];
}

function assertIdent(name: string, label: string): void {
  if (!IDENT.test(name)) throw new Error(`Invalid ${label}: "${name}" (must be a C++ identifier)`);
}

export function resolveTargetPaths(input: WriteInput): {
  sourceDir: string; headerPath: string; sourcePath: string; relHeader: string; relSource: string;
} {
  assertIdent(input.moduleName, 'module name');
  assertIdent(input.className, 'class name');
  const root = path.resolve(input.projectPath, 'Source');
  const sourceDir = path.join(root, input.moduleName);
  const headerPath = path.join(sourceDir, `${input.className}.h`);
  const sourcePath = path.join(sourceDir, `${input.className}.cpp`);
  if (!headerPath.startsWith(root + path.sep) || !sourcePath.startsWith(root + path.sep)) {
    throw new Error('Resolved path escapes the project Source directory');
  }
  return {
    sourceDir,
    headerPath,
    sourcePath,
    relHeader: `Source/${input.moduleName}/${input.className}.h`,
    relSource: `Source/${input.moduleName}/${input.className}.cpp`,
  };
}

async function readIfExists(p: string): Promise<string | null> {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

/** Dry-run: diff the generated content against whatever is on disk. No writes. */
export async function planWrite(input: WriteInput): Promise<WritePlan> {
  const { headerPath, sourcePath, relHeader, relSource } = resolveTargetPaths(input);
  const [hOld, cOld] = await Promise.all([readIfExists(headerPath), readIfExists(sourcePath)]);
  return {
    files: [
      { path: headerPath, relPath: relHeader, exists: hOld !== null, diff: diffPrompts(hOld ?? '', input.header) },
      { path: sourcePath, relPath: relSource, exists: cOld !== null, diff: diffPrompts(cOld ?? '', input.source) },
    ],
  };
}

/** Write the header + source to disk (after the user confirms the dry-run). */
export async function applyWrite(input: WriteInput): Promise<{ written: string[] }> {
  const { sourceDir, headerPath, sourcePath } = resolveTargetPaths(input);
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(headerPath, input.header, 'utf8');
  await fs.writeFile(sourcePath, input.source, 'utf8');
  return { written: [headerPath, sourcePath] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/blueprint-transpiler-write.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blueprint-transpiler-write.ts src/__tests__/lib/blueprint-transpiler-write.test.ts
git commit -m "feat(transpiler-write): dry-run diff + write-to-project lib with path guard"
```

---

## Task 2: API route

**Files:**
- Create: `src/app/api/blueprint-transpiler/write/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/blueprint-transpiler/write/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { planWrite, applyWrite, type WriteInput } from '@/lib/blueprint-transpiler-write';
import { apiSuccess, apiError } from '@/lib/api-utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectPath, moduleName, className, header, source, confirm } = body;
    if (!projectPath || !moduleName || !className) {
      return apiError('projectPath, moduleName and className are required', 400);
    }
    const input: WriteInput = { projectPath, moduleName, className, header: header ?? '', source: source ?? '' };
    if (confirm === true) {
      return apiSuccess(await applyWrite(input));
    }
    return apiSuccess(await planWrite(input)); // dry-run
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to write transpiled C++');
  }
}
```

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "blueprint-transpiler/write|blueprint-transpiler-write" || echo "route+lib type-clean"` → expect clean.
Run: `npx eslint src/app/api/blueprint-transpiler/write/route.ts src/lib/blueprint-transpiler-write.ts` → exit 0.

```bash
git add src/app/api/blueprint-transpiler/write/route.ts
git commit -m "feat(transpiler-write): dry-run/confirm POST route for write-to-project"
```

---

## Self-Review notes

- Spec coverage: resolve/plan/apply + guard (T1), route (T2). UI button deferred (foreign file).
- Types: `WriteInput`/`WritePlan`/`FileWritePlan` consistent T1↔T2; `diffPrompts` returns
  `PromptDiff` with `summary.added/removed` (verified in text-diff.ts).
- Security: identifier regex + `Source`-dir containment block path traversal.
