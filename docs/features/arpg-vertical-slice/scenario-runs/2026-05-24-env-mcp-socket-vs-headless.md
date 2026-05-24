# Environment — Blender MCP Socket-vs-Headless Doc (folder-05, pof-app §6)

**Date:** 2026-05-24
**Predecessor:** `docs/improvements/05-environment/pof-app.md` §6

## Context

This closes the last open item in folder-05. A reconciliation of the
scenario-runs + git log showed the rest of the folder is already done:

- **Game §1–§6** — re-UV (`env-arena-polish`), Lightmass bake
  (`env-lightmass-bake`), procgen dungeon (`env-procgen-dungeon`), biome
  scatter (`env-biome-scatter`), post-process + fog (`env-arena-polish`).
  §7 audio is a deliberate defer-out.
- **App §1–§5** — UV-strategy dropdown (`env-uv-strategy-dropdown`), lightmap
  /Lightmass path + FBX-scale tip (`env-lightmass-bake` + the level-design
  knowledge guard), the ARPGLevelGenerator surface (Dungeon (UE) + Scatter
  (UE) tabs), and the lighting-smoke Gemini check (already encoded in
  `e2e/fixtures/gemini-prompts/arena-check.txt` Q3 "lit / not black" +
  `procgen-check.txt`, and exercised as the not-black gate in the lightmass
  bake).
- **Tests** — `env-test-hardening` landed the arena collision/bounds/setup
  C++ tests (8/8 green), with level-gen smoke covered by `AProcGenWalkTest`
  and the UV/FBX-scale/surface vitests done.

Only pof-app §6 (document the headless-vs-socket Blender choice in the
scene-composer module) had no commit anywhere.

## What shipped (PoF app — `xkazm04/pof`, local-only)

- **`src/lib/module-registry.ts`** — a new `scene-composer` `knowledgeTip`
  baking PS-2's guidance: headless Blender (`blender --background --python`)
  is the default for one-shot batch authoring (arena build, per-room-template
  FBX export); the `BlenderMCPService` TCP socket is for interactive/live
  iteration at the PoF UI. Rule of thumb: scripted one-shot → headless;
  live editing → socket.
- **`src/__tests__/registry/scene-composer-knowledge.test.ts`** — guards the
  tip (asserts the scene-composer tips cover both `--background`/headless and
  the interactive socket), mirroring `level-design-knowledge.test.ts`.

`knowledgeTips` render in the module view (the module's operator-doc surface,
same home the level-design env tips use). They are UI-only — they do not reach
dispatch prompts (per the prompt-knowledge-injection note), which is correct
for operator workflow guidance.

## Verification

- **vitest (new file + registry folder):** `src/__tests__/registry/` — 3
  files / 15 tests, all pass. The new test was confirmed red before the tip
  was added (TDD), green after.
- **typecheck:** clean (only the pre-existing, unrelated `leonardo.ts:208`).
- **lint (touched files):** 0 errors. The 7 `no-restricted-syntax` hex
  warnings in `module-registry.ts` are pre-existing category-accent colour
  definitions (lines 367–415), not this change.

## Notes

- The shared app repo was churning under a concurrent sibling session during
  this work (`cli-task.ts` modified + a new `wiring-dispatch.test.ts` appeared,
  neither mine). Staged only my two files by name; left the foreign changes
  untouched.
- The `ue-gotchas.test.ts.snap` that showed in `git status` was an LF→CRLF
  working-copy artifact (zero content diff); restored.

## Outcome

Folder-05 (Environment) is complete bar the deliberately-deferred audio (§7).
pof-app §6 is closed: the scene-composer module now documents when to use
headless Blender vs. the MCP socket, guarded by a vitest.
