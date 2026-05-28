# Write transpiled C++ to UE project — clean core

**Date:** 2026-05-28
**Backlog item:** `idea-315d1f0e-write-transpiled-c-to-ue-proje`
**Status:** Design approved — **clean core only** (the "Write to Project" button in
`BlueprintTranspilerView` is deferred; that file is being edited by a concurrent session).

## Problem

The transpiler's generated header/source are clipboard-only, forcing manual paste into the
editor for every class. Migration tools (jscodeshift, Rector, codemod) write to disk with a
dry-run/preview, which is the expected workflow.

## Goal (this slice)

A server-side write path that, given the generated header + source, resolves the correct
`Source/<Module>/<Class>.h|.cpp` paths, produces a **dry-run diff** against whatever's on disk,
and (on confirmation) writes the files. The button that calls it from the transpiler view is a
later slice (blocked on the foreign `BlueprintTranspilerView`).

## Architecture

### 1. `src/lib/blueprint-transpiler-write.ts` (new, server-side)

Uses `fs/promises` + `path` (the `ue5-source-parser.ts` pattern) and `diffPrompts` from
`text-diff.ts` for the preview.

```ts
export interface WriteInput {
  projectPath: string;   // UE project root (from projectStore, passed by the client)
  moduleName: string;    // e.g. "PoF"
  className: string;     // e.g. "AARPGFireball"
  header: string;        // .h content
  source: string;        // .cpp content
}
export interface FileWritePlan { path: string; relPath: string; exists: boolean; diff: PromptDiff; }
export interface WritePlan { files: FileWritePlan[]; }

export function resolveTargetPaths(input: WriteInput): {
  sourceDir: string; headerPath: string; sourcePath: string; relHeader: string; relSource: string;
};
export function planWrite(input: WriteInput): Promise<WritePlan>;     // dry-run, no writes
export function applyWrite(input: WriteInput): Promise<{ written: string[] }>; // writes after confirm
```

- **Security / path-traversal guard:** `moduleName` and `className` must match
  `/^[A-Za-z_][A-Za-z0-9_]*$/` (C++ identifiers) — else throw. Resolved targets must stay under
  `<projectPath>/Source` (`startsWith(root + path.sep)`), else throw. This prevents `..`/slash
  injection from writing outside the project.
- **`planWrite`**: read each target if it exists; return `{ exists, diff: diffPrompts(existing ?? '', next) }`
  per file (header + source). No disk mutation.
- **`applyWrite`**: `fs.mkdir(sourceDir, { recursive: true })` then write both files; return the
  absolute paths written.

### 2. `src/app/api/blueprint-transpiler/write/route.ts` (new)

`POST` with `{ projectPath, moduleName, className, header, source, confirm }`:
- `confirm !== true` → `apiSuccess(await planWrite(input))` (dry-run diff).
- `confirm === true` → `apiSuccess(await applyWrite(input))`.
- Missing `projectPath`/`moduleName`/`className` → `apiError(…, 400)`; thrown guard errors →
  `apiError(message)`.

## File-by-file impact

| File | Change |
|------|--------|
| `src/lib/blueprint-transpiler-write.ts` | **new** — resolve/plan/apply + guards |
| `src/app/api/blueprint-transpiler/write/route.ts` | **new** — dry-run/confirm POST |
| `src/__tests__/lib/blueprint-transpiler-write.test.ts` | **new** — temp-dir fs tests |

Deferred (foreign-dirty, later slice): a "Write to Project" button + dry-run-diff modal in
`BlueprintTranspilerView` (reads `projectStore` path, renders the diff via `PromptDiffView`,
confirms, POSTs `confirm: true`).

## Test plan (TDD)

Use a real OS temp dir (`fs.mkdtemp`) as the fake project root; clean up afterwards.

1. `resolveTargetPaths` rejects a bad `className`/`moduleName` (throws); good names →
   `Source/<Module>/<Class>.h` + `.cpp` under the project.
2. `planWrite` on a fresh project → both files `exists: false`, `diff.summary.added > 0`,
   `removed === 0` (pure insertion preview, nothing written to disk yet).
3. `applyWrite` writes both files (returns 2 paths; files readable with exact content).
4. `planWrite` after `applyWrite` with **changed** header → `exists: true` and the diff has
   both added and removed lines (a real before/after).

Run `npm run validate` — my files type/lint/test-clean (foreign tree failures excluded).
