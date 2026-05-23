---
date: 2026-05-23
status: draft
sub_project: 06-TM (textures & materials — open follow-up items after the Leonardo PBR pipeline run)
parent_initiative: PoF improvements — docs/improvements/06-textures-materials/
branch: PoF app repo master (textures & materials follow-ups)
predecessor_docs:
  - docs/improvements/06-textures-materials/pof-app.md
  - docs/improvements/06-textures-materials/runs/2026-05-23-run.md
  - docs/superpowers/specs/2026-05-23-tm-leonardo-pbr-pipeline-design.md
---

# 06-TM follow-ups: prompt-length, normal-from-albedo, biome→texture map, advanced UI

Closes the four open items left after the `2026-05-23-tm-leonardo-pbr-pipeline`
run + audit. Each is an **independently-committable deliverable**; they are
sequenced backend-first so the UI (Deliverable 3) rests on already-tested
backend. Execution is item-by-item with a user review/commit gate between each.

## Context

The Leonardo/Scenario PBR pipeline shipped and was audited green (936→946 tests,
typecheck/lint clean). The audit + the `pof-app.md` improvement list leave four
PoF-app items unbuilt:

- **#3 PBR completeness** — Leonardo's `tiling:true` path returns *albedo only*;
  no matched normal map. `pof-app.md` §3 proposes deriving a normal from the
  albedo's luminance gradient with `sharp` (a Sobel filter → normal RGB).
- **#7 stop the asphalt default** — there is **no biome→texture config anywhere**
  in the app; "biome" appears only as descriptive text in level-design prompts.
  The autonomous path has no themed default, so it can pick industrial textures
  for a dungeon (`pof-app.md` §7).
- **#1 advanced capability UI** — `src/lib/leonardo.ts` + `src/lib/scenario.ts`
  expose upscale / transparency / controlnet / texture3d / Scenario PBR, but the
  only UI caller is `CatalogGearTab` (basic prompt-only gear icons). The advanced
  capabilities have **zero UI** (`pof-app.md` §1).
- **Prompt-length inconsistency** (audit finding #3) — `/api/leonardo` rejects
  `prompt.length > 1500` with 400, while `generateImage` silently
  `slice(0,1500)`s; direct lib callers get silent truncation.

Grounding facts established during brainstorming:
- `sharp@0.34.5` is **installed but only transitively** (not declared in
  `package.json`).
- A CC0 source layer already exists: `src/lib/visual-gen/asset-sources.ts`
  (`searchPolyHaven(category)`, `searchAmbientCG(query, limit, offset)`).
  **PolyHaven's API has no text search** (returns all of a category);
  **ambientCG supports `q=`**.
- `src/components/modules/visual-gen/material-lab/` (`MaterialLabView`,
  `PBREditor`, `MaterialPreview`) is the natural home for an advanced texture
  panel.

## Goals

1. **Deliverable 0** — harmonize the prompt-length behavior (one source of truth;
   no silent truncation).
2. **Deliverable 1 (#3)** — `deriveNormalFromAlbedo` lib fn (`sharp` Sobel,
   tiling-safe) + a `POST /api/texture-maps` route; `sharp` added as a direct
   dependency.
3. **Deliverable 2 (#7)** — a `biome-textures` map + `pickBiomeTexture` helper
   (ambientCG text search, PolyHaven fallback) + the anti-asphalt guard test.
4. **Deliverable 3 (#1)** — a pragmatic two-tile advanced panel (Scenario PBR +
   Universal Upscaler) mounted in `MaterialLabView`.

## Non-goals

- No UE-project / C++ / Python change — this is **PoF-app only**. (The game-side
  master-material + arena re-texture work is the prior spec's domain.)
- Deliverable 3 is **2 tiles only** — no ControlNet/transparency/texture3d UI
  (those stay API-only; texture3d is a dead Leonardo endpoint anyway).
- No change to the existing `CatalogGearTab` Leonardo usage.
- No new external API live-verification beyond what unit tests (mocked) cover;
  Scenario remains key-gated and surfaces a graceful "not configured" state.

## Shared-tree isolation note

This repo is being edited by concurrent sessions (observed mid-session: new
untracked files appearing, snapshot churn). Each deliverable is committed
**narrowly** (only its own new/changed files, staged explicitly), local-only —
the user pushes manually (`feedback_git_push`). New files are preferred over
edits to shared files to minimize collisions.

## Design

### Deliverable 0 — prompt-length harmonization

In `src/lib/leonardo.ts`: extract `const MAX_PROMPT_LENGTH = 1500;`. Replace the
silent `prompt.slice(0, 1500)` in `generateImage` with an explicit guard that
**throws** `Error('Prompt exceeds ' + MAX_PROMPT_LENGTH + ' character limit')`
when exceeded. `/api/leonardo/route.ts` keeps its early 400 (friendly client
error) but references the same constant. Net: the limit lives in one place; no
caller is silently truncated.

- **Test:** `generateImage('x'.repeat(1501))` rejects with `/1500|limit/`.
  (Add to the existing `leonardo-client.test.ts`.)

### Deliverable 1 — #3 normal-from-albedo (`sharp` Sobel)

New `src/lib/texture-maps.ts`:

```ts
export interface DeriveNormalOptions { strength?: number; } // default 2.0
export async function deriveNormalFromAlbedo(
  albedo: Uint8Array,
  opts?: DeriveNormalOptions,
): Promise<Uint8Array>; // returns PNG bytes
```

Algorithm: `sharp(albedo).greyscale().raw()` → height field `h(x,y)`. For each
pixel compute Sobel `dx`,`dy` with **wrap-around sampling** (`(x+w)%w`,
`(y+h)%h`) so a tileable albedo yields a tileable normal. Tangent-space normal:
`n = normalize(-dx*strength, -dy*strength, 1)`; pack to RGB `((n+1)*0.5*255)`.
Emit via `sharp(rawRGB,{raw:{width,height,channels:3}}).png()`.

New `POST /api/texture-maps` (`src/app/api/texture-maps/route.ts`): body
`{ albedoBase64: string, strength?: number }` → `apiSuccess({ normalBase64 })`;
validates input, `apiError` on bad/missing albedo. `// @vitest-environment node`
where sharp is exercised.

Add `"sharp": "^0.34.5"` to `package.json` `dependencies` (already in the lock).

- **Tests** (`src/__tests__/texture-maps/`, real sharp, no mock):
  - flat-grey albedo → normal ≈ `(128,128,255)` per pixel (within tolerance);
  - a synthetic left/right step edge → that column's normal X-channel deviates
    from 128 in the expected direction;
  - output decodes as a PNG of the input's width/height;
  - route test mocks `deriveNormalFromAlbedo`, asserts envelope + 400 on missing
    `albedoBase64`.

### Deliverable 2 — #7 biome→texture mapping

New `src/lib/visual-gen/biome-textures.ts`:

```ts
import type { AssetCategory, AssetSearchResult } from './asset-sources';
export type Biome = 'dungeon' | 'cave' | 'forest' | 'desert' | 'snow' | 'industrial';
export interface BiomeTextureSpec {
  searchQuery: string;      // themed ambientCG text query (the anti-asphalt fix)
  category: AssetCategory;  // 'materials' for surfaces
  fallbackAssetId: string;  // known-good PolyHaven id when search yields nothing
  leonardoPrompt: string;   // themed seamless-PBR prompt for the Leonardo path
}
export const BIOME_TEXTURES: Record<Biome, BiomeTextureSpec>;
export async function pickBiomeTexture(biome: Biome): Promise<AssetSearchResult>;
```

`pickBiomeTexture` calls `searchAmbientCG(spec.searchQuery)`; returns the first
result with a non-empty `downloadUrl`; if none, falls back to a synthetic
`AssetSearchResult` for `spec.fallbackAssetId` from PolyHaven. Every biome maps
to a *themed* query (e.g. `dungeon → 'stone floor dungeon medieval'`), never a
bare category — that is the asphalt-regression fix.

- **Tests** (`src/__tests__/visual-gen/biome-textures.test.ts`):
  - every `Biome` has non-empty `searchQuery`, non-empty `leonardoPrompt`, a
    valid `category`, and a non-empty `fallbackAssetId`; no query equals a bare
    category name (anti-asphalt guard);
  - `pickBiomeTexture` returns the first ambientCG hit (source mocked);
  - falls back to the PolyHaven id when ambientCG returns `[]`.

### Deliverable 3 — #1 advanced panel (2 tiles)

New `src/components/modules/visual-gen/material-lab/AdvancedTexturePanel.tsx`,
mounted as a section/tab in `MaterialLabView.tsx`.

- **Tile A — Scenario PBR set:** prompt `<textarea>` + optional `modelId` input
  → `POST /api/scenario` via `tryApiFetch` → renders albedo/normal/roughness
  thumbnails from the returned URLs. On the (current) `SCENARIO_API_KEY not
  configured` 500, shows an inline "configure SCENARIO_API_KEY + SECRET" hint
  rather than a raw error.
- **Tile B — Universal Upscaler:** generated-image-id input + style select →
  `POST /api/leonardo {mode:'upscale', imageId, style}` → shows the returned
  `upscaleJobId`.
- Conventions: `apiFetch`/`tryApiFetch`, `logger` (no raw console), colors from
  `@/lib/chart-colors`, `UI_TIMEOUTS` for any toast/timeout, loading + error
  state per tile.

- **Test** (`src/__tests__/components/advanced-texture-panel.test.tsx`, jsdom):
  render; mock `fetch`; Scenario tile posts `{prompt,...}` and renders the three
  map thumbnails; upscale tile posts `{mode:'upscale',imageId,style}`; the
  not-configured error path renders the hint. (Confirm `@testing-library/react`
  availability during planning; if absent, assert via the panel's exported pure
  helpers instead.)

## Verification (per deliverable)

- **0:** `leonardo-client.test.ts` over-length case green; full `npm run validate`
  green; route still returns 400 on >1500.
- **1:** `texture-maps` tests green (real sharp); `sharp` in `package.json`
  deps; `npm run validate` green.
- **2:** `biome-textures.test.ts` green; anti-asphalt guard fails if any biome
  query is a bare category.
- **3:** panel test green; manual: panel renders in MaterialLab; Scenario tile
  shows the not-configured hint (no key set), upscale tile posts correctly.
- **All:** each deliverable ends on a clean `npm run validate` before its commit.

## Definition of done

1. Deliverable 0 committed: single prompt-length source of truth, no silent
   truncation, test green.
2. Deliverable 1 committed: `texture-maps.ts` + route + `sharp` dep + tests.
3. Deliverable 2 committed: `biome-textures.ts` + tests.
4. Deliverable 3 committed: `AdvancedTexturePanel.tsx` wired into MaterialLab +
   test.
5. Each commit narrow + local-only; `npm run validate` green at each step.
6. A findings note appended to `docs/improvements/06-textures-materials/runs/`.

**Success criterion:** the four open #6 items are closed — the prompt-length
footgun is gone, Leonardo albedo-only output can get a tiling-safe matched
normal, the autonomous path has themed per-biome texture defaults, and the
Scenario-PBR + upscaler capabilities are reachable from the UI.

## Risks & mitigations

- **`sharp` in vitest** (native module / environment). Mitigation: pin the
  installed version; mark sharp-exercising tests `@vitest-environment node`;
  keep synthetic test inputs tiny (e.g. 8×8).
- **ambientCG/Scenario field-name drift** (Scenario is unverified live).
  Mitigation: tests mock the network; Scenario stays key-gated with a graceful
  not-configured state; field names already isolated in `scenario.ts` helpers.
- **`@testing-library/react` may not be configured.** Mitigation: confirm in the
  plan; fall back to testing exported pure helpers if the harness isn't present.
- **Shared-tree collisions.** Mitigation: new files only; explicit narrow
  staging per commit; local-only.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews this spec.
3. `writing-plans` → implementation plan covering Deliverables 0→1→2→3.
4. Execute item-by-item (TDD), pausing for user review/commit between each.
