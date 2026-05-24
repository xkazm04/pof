# Environment — Lighting-Smoke Gemini Check as a Reusable Step (folder-05 pof-app §5)

**Date:** 2026-05-24
**Predecessor:** `docs/improvements/05-environment/pof-app.md` §5 (folds into the
standard screenshot step from `04-hud-ui/pof-app.md` §5)

## Context

Folder-05 §5 asks for a "lighting smoke" Gemini check after any environment
dispatch — "is this scene lit, or black/un-lit? Are surfaces shadowed, or
flat-shaded?" — folded into the **standard screenshot step**. Until now the
lit/not-black question lived only in the e2e Gemini fixtures
(`arena-check.txt` Q3, `procgen-check.txt`) and was exercised ad-hoc in the
arena-polish and Lightmass-bake runs. This session extracts it as a first-class,
reusable dispatch step — the same shape as the HUD check (folder-04 §5) and the
texture check (folder-06 §6).

## What shipped (PoF app — `xkazm04/pof`, local-only)

Implemented test-first (RED → GREEN), mirroring the existing `texture` mode:

- **`src/app/api/verify/visual/route.ts`** — a new `'lighting'` `CheckMode` with
  a server-owned `LIGHTING_CHECK_PROMPT` (the load-bearing Gemini question:
  lit / black-un-lit, shadowed / flat-shaded → `{lit, shadowed, verdict, notes}`)
  and a `normaliseVerdict` case (a black/un-lit scene = the flagged defect,
  mirroring HUD's `anyEmpty`). Records to the shared `visual_verifications`
  table and emits `eval.visual`, exactly like HUD/texture.
- **`src/lib/prompts/visual-check.ts`** — `buildVisualCheckSection` gained a
  `mode?: 'hud' | 'lighting'` option. This is the literal "fold into the
  standard screenshot step": same launch + HighResShot + find-newest-png + POST
  machinery; only the heading, the `"mode"` field, the advisory framing, and the
  Gemini question differ. Default `'hud'` keeps every existing caller
  byte-identical (verified — the HUD tests are unchanged and green).
- **`src/types/modules.ts`** — `lightingCheck?: boolean` on `ChecklistItem`
  (parallel to `visualCheck`).
- **`src/lib/cli-task.ts`** — checklist dispatch appends the lighting block when
  `isUE5 && itemDef.lightingCheck`, calling `buildVisualCheckSection({mode:'lighting'})`.
- **`src/lib/module-registry.ts`** — `lightingCheck: true` on the three
  level-design items that produce a renderable environment scene: `ld-1` (create
  blockout geometry), `ld-5` (environmental storytelling / lighting), `ld-6`
  (build encounter arenas).

## Tests (test-first)

- **`src/__tests__/prompts/visual-check.test.ts`** — a `lighting mode` describe:
  the `## Lighting Verification` heading, `"mode": "lighting"` in the POST body,
  the lit/not-black/shadowed question, the reused screenshot step, and a guard
  that default mode stays `## Visual Verification` with no `"mode"` field.
- **`src/__tests__/lib/lighting-check-dispatch.test.ts`** — the level-design
  `lightingCheck` opt-in flags (ld-1/5/6 in, ld-2/3/4 out) and that a `ld-1`
  checklist dispatch appends the Lighting Verification section in lighting mode
  (vs. ld-2 which does not).

Each test was confirmed RED before the implementation, GREEN after.

## Verification

- Lighting + dispatch tests: green. typecheck clean (only the pre-existing
  unrelated `leonardo.ts:208`); lint 0 errors on the touched files.
- Full `npm run test` green after the change.

## Shared-tree concurrency note (important)

This landed while a **concurrent session implemented `mode: 'character'`
(folder-02 §6) on the very same `buildVisualCheckSection` / `/api/verify/visual`
pattern**. The two features were co-authored in one shared working tree and one
shared `HEAD`: the `mode` union is now `'hud' | 'lighting' | 'character'`, the
route carries all four prompts (hud/texture/lighting/character), and
`ChecklistItem` has both `lightingCheck` and `characterCheck`. The combined tree
is consistent and the full suite passes. Because the implementation files are
shared, this commit co-lands the concurrent character-mode changes that were
present in the working tree. Sibling-only artifacts (e.g. a separate
character-locomotes test) were left for that session to commit.

## Outcome

Folder-05 pof-app §5 is closed: the lighting-smoke check is now a reusable
dispatch step (`mode:'lighting'`) sharing the standard screenshot+Gemini
machinery, opted into by the scene-producing level-design checklist items — no
longer only an e2e fixture question. This also generalised the standard step
into a mode-keyed family (hud / texture / lighting / character) that future
domains can extend.
