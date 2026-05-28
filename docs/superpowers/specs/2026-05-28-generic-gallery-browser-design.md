# Generic gallery candidate browser in ArchetypeStep

**Date:** 2026-05-28
**Backlog item:** `idea-dfab3516-variant-gallery-generate-compa`
**Status:** Design approved — ready for implementation plan

## Problem

The `/layout` lab renders pipeline steps two ways: bespoke components (the Items
reference pipeline) and the generic `ArchetypeStep` renderer driven by a `StepSpec`.
The Items bespoke "art" steps (`ItemArt.tsx`) already have a full
**generate → compare → select** loop via the shared `CandidateGallery` component and
the pure `genHistory` model: every Produce / re-roll keeps its batch of candidates,
each stamped with the typed direction + full prompt, and selecting any candidate
projects its payload onto the step's top-level data so derived Acceptance is unchanged.

The generic renderer never got this. `ArchetypeStep`'s `gallery` view branch
(`ArchetypeStep.tsx:67-68`) is a stub that prints `"<N> candidates · select via Produce."`
and the gallery specs hardwire `produce: () => ({ data: { [field]: 0 } })`. So the
**~28 catalog pipelines** that use `archetype: 'gallery'` (characters, bestiary, props,
materials, vfx, hud-elements, quests, factions, currency, codex, …) cannot actually
browse, compare, or re-select candidates — the most-used step kind in the program is a
placeholder everywhere except Items.

## Goal

Bring the proven Items browse→compare→select loop to the generic `ArchetypeStep`
gallery view, upgrading all ~28 generic gallery catalogs at once, with **acceptance
behavior unchanged**.

Non-goals (YAGNI): real Leonardo image generation per candidate (steps are
CLI/Produce-driven placeholders using deterministic swatches today); a per-candidate
"regenerate variations of this candidate" action (deferred); refactoring the Items
bespoke pipeline.

## Approach

Reuse the existing `genHistory` model (already the shared core) and the existing
`CandidateGallery` presentational component. Add one small pure candidate generator
for the generic case and branch `ArchetypeStep`'s panels when the view is a gallery.
Leave `ItemArt.tsx` untouched.

### 1. New pure module — `src/components/layout-lab/steps/shared/genericGalleryCandidates.ts`

```ts
genericGalleryCandidates(field: string, count: number, direction: string, seq: number)
  : Omit<GenCandidate, 'id'>[]
```

- Returns `count` candidates. Each has:
  - `swatch`: a deterministic `hsl(...)` string hashed from `direction + field + seq + index`.
    Computed (not a hex literal) so it does not trip the `no-hardcoded-hex` ESLint rule,
    and reproducible (same inputs → same swatch), echoing the seeded-RNG theme.
  - `caption`: a short label (`Variant <index+1>`).
  - `payload`: `{ [field]: index }` — so selecting projects a numeric index ≥ 0.
- Pure + framework-free → unit-testable.

### 2. Wire genHistory into `ArchetypeStep` (one file, no new component)

- Import `readHistory`, `makeBatch`, `appendBatch`, `selectCandidate`, `selectedCandidate`,
  `historyData` from `./shared/genHistory`, `CandidateGallery` from
  `./shared/CandidateGallery`, and `genericGalleryCandidates`.
- Compute `const history = readHistory(data)` and define `generate(dir, prompt)` /
  `reselect(id)` closures unconditionally (cheap, no conditional hooks — all existing
  hooks stay called unconditionally).
- `generate(dir, prompt)`:
  1. `const base = spec.produce(entity)` — keeps the spec's `links`, `ueAssets`, and any
     extra base `data` fields.
  2. `const batch = makeBatch({ seq: history.batches.length, at: new Date().toISOString(),
     direction: dir, prompt, candidates: genericGalleryCandidates(view.field, view.candidates, dir, history.batches.length) })`.
     (`new Date()` is in the event handler, never in render — respects react purity.)
  3. `const next = appendBatch(history, batch)`.
  4. `produce(entity.id, step, { ...base, data: historyData(next, base.data) })`.
- `reselect(id)`: `produce(entity.id, step, { ...base, data: historyData(selectCandidate(history, id), base.data) })`.
- **Branch the panels:** when `spec.view.kind === 'gallery'`, render
  `[ CandidateGallery(history, onSelect=reselect), "Selected · writes <ueAsset>" summary,
  CliProduce wired to generate ]`. Otherwise keep the current `[ View, Produce ]` path.
  The existing linkRes banner, canon-aware prompt builder, and `StepFrame` wrap both
  branches unchanged.
- The "Selected" summary panel shows `spec.produce(entity).ueAssets?.[0]` once a candidate
  is selected (mirrors the Items "✓ /Game/…" treatment) — satisfying "tie selection to
  the UE asset path".

### 3. Acceptance unchanged

`historyData(next, base.data)` = `{ ...base.data, ...selectedPayload, genHistory }`. The
selected payload is `{ [field]: index }`, overriding `base.data`'s `{ [field]: 0 }`. The
first Produce appends a batch and `appendBatch` auto-selects candidate 0, so `data[field]`
becomes `0` exactly as the old static produce did → `selected(field)` checker (passes when
`data[field]` is a number ≥ 0) keeps passing. Extra base-data fields are preserved via the
`extra` arg.

## File-by-file impact

| File | Change |
|------|--------|
| `steps/shared/genericGalleryCandidates.ts` | **new** — pure candidate generator |
| `steps/ArchetypeStep.tsx` | branch gallery panels; add genHistory generate/reselect closures |
| `__tests__/.../genericGalleryCandidates.test.ts` | **new** — count / determinism / payload |
| `__tests__/.../ArchetypeStepGallery.test.tsx` | **new** — empty hint → produce → select → accept pass; links/ueAssets survive |
| `.claude/CLAUDE.md` | Shared Component Manifest: note generic gallery now uses CandidateGallery |
| `docs/catalog/*` or `docs/architecture/ui-shell.md` | update text that calls the generic gallery a stub |

## Test plan (TDD)

1. **`genericGalleryCandidates`** (pure): returns exactly `count` candidates; deterministic
   (same `field/direction/seq` → identical swatches + captions); every candidate's `payload`
   equals `{ [field]: index }`; different `direction` or `seq` changes the swatches.
2. **`ArchetypeStep` gallery render**: with a gallery-archetype spec and empty artifact,
   shows the empty hint (`candidate-gallery-empty`); after a `produce` that writes a
   genHistory batch, renders `candidate-gallery` and the acceptance banner derives `pass`;
   `links`/`ueAssets` from `spec.produce` are present on the persisted artifact.

Run `npm run validate` (typecheck + lint + test) before completion.

## Risks

- **Shared, multi-session tree.** `ArchetypeStep.tsx` is shared; keep the edit narrow and
  re-read before editing. `ItemArt.tsx` is intentionally not touched.
- **File size.** `ArchetypeStep.tsx` (~110 LOC) + ~40 LOC stays under the 200-LOC ceiling.
  If it grows past, extract the gallery branch to `ArchetypeGalleryStep.tsx`.
