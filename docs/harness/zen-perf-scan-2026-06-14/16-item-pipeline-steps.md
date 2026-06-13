# Item Pipeline Steps — zen-perf scan
> Context: Catalog to UE Pipeline / Item Pipeline Steps
> Total: 5
> Severity: critical=0 high=1 medium=3 low=1

## 1. Each step component repeats the identical StepFrame + acceptance + Produce wiring with no shared scaffold
- **Severity**: high
- **Lens**: architecture
- **Category**: duplication / cheap abstraction
- **File**: src/components/layout-lab/steps/ItemConceptBrief.tsx:20, src/components/layout-lab/steps/ItemAttributes.tsx:19, src/components/layout-lab/steps/ItemEconomy.tsx:35, src/components/layout-lab/steps/ItemAnimAudio.tsx:33, src/components/layout-lab/steps/ItemIntegration.tsx:16, src/components/layout-lab/steps/ItemGate.tsx:27
- **Scenario**: Every "static" step (ConceptBrief, Attributes, Economy, Animations, VFX, SFX, InventoryUI, Tooltip, TestGate, Packaging) opens with the *byte-identical* prologue: `const { art, runProduce } = useStaticStep(entity, step);` then `<StepFrame t={t} acceptance={ITEM_STEP_SPECS[step].accept(art?.data ?? {})} onFix={runProduce} panels={[...]}>`. The only thing that varies between ~10 components is the `panels` array and a couple of derived `data` reads. The acceptance call, the `onFix`, and the `?? {}` fallback are copy-pasted 10 times.
- **Root cause**: `useStaticStep` already collapsed the *dispatch* contract, but the *render* contract (frame + acceptance derivation + onFix) was never lifted. Each View was hand-written around the same StepFrame call instead of behind a thin wrapper.
- **Impact**: 10 sites to touch for any change to the acceptance wiring (e.g. passing `plainMode`, adding a "last produced at" line, threading `onFix` differently). A regression in one is invisible in the others. It also masks finding #2 (the inline-accept perf bug) by spreading it across 10 identical lines instead of one.
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Add a `StaticStepFrame({ entity, step, t, panels })` (or extend `useStaticStep` to also return the derived `acceptance` + an `onFix` already bound) so each step body becomes `return <StaticStepFrame ... panels={[...]} />`. The acceptance + `onFix` + `?? {}` live in one place; the per-step file shrinks to just its panels and `data` reads.

## 2. `ITEM_STEP_SPECS[step].accept(art?.data ?? {})` recomputed inline on every render (incl. the per-render `{}` allocation)
- **Severity**: medium
- **Lens**: performance
- **Category**: recomputation / missing memo
- **File**: src/components/layout-lab/steps/ItemEconomy.tsx:35 (and the same inline call in all 13 step files, e.g. ItemConceptBrief.tsx:21, ItemArt.tsx:56)
- **Scenario**: `accept(art?.data ?? {})` runs on *every* render of the active step. Inside, `accept` → `withCopy(step, data, base)` → `ITEM_STEP_COPY[step](data)`, which for Economy re-derives `priceRatio`, `powerInBand`, `priceInBand`, percentage math and string formatting; for Attributes it rebuilds `ATTR_KEYS.filter(...)` twice (once in `accept`, once in `attributesCopy`). When `art` is undefined the `art?.data ?? {}` allocates a fresh `{}` literal every render, and the resulting `acceptance` object is a new reference every render — defeating any downstream memo and re-running `StepFrame`'s `AnimatePresence`/`statusColor` work.
- **Root cause**: Acceptance is derived directly in JSX with no `useMemo`. The host re-renders the active step on unrelated state changes (NextStepCoach toggles `plainMode`, drawer width `wide`, `setStepIdx`, the CliProduce-internal `setState` cascades up nothing but local edits trigger this component tree), so the inline call fires repeatedly.
- **Impact**: Redundant CPU on the hot path (the currently-open step re-renders on every keystroke into its own CliProduce textarea, every plainMode/coach toggle). Cheap per call, but unbounded in frequency and trivially avoidable.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: In the shared scaffold from #1, compute `const acceptance = useMemo(() => ITEM_STEP_SPECS[step].accept(art?.data ?? {}), [art?.data, step]);` once. Memoizing in the single wrapper fixes all 13 steps at once and stabilizes the `acceptance` reference for StepFrame.

## 3. `selectedCandidate(history)` / `allCandidates(history)` re-scan all batches multiple times per render in the generative steps
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated work / O(batches×candidates) per render
- **File**: src/components/layout-lab/steps/ItemArt.tsx:53,65,95,151 and src/components/layout-lab/steps/shared/genHistory.ts:73-76,68-70
- **Scenario**: `selectedCandidate(h)` calls `allCandidates(h)` which does `h.batches.flatMap(b => b.candidates)` — a full materialization of every candidate across every kept re-roll — then `.find()`. `ItemIcon2D` calls it once (line 53), but `Item3DGen` calls `selectedCandidate(history)` inside the mesh-preview panel (line 95) and `ItemMaterial` calls it inside the material-preview panel (line 151); meanwhile `CandidateGallery` (rendered in the same frame) independently calls `allCandidates(history)` again (CandidateGallery.tsx:29). Because the whole point of this feature is "every batch is kept, never discarded," `batches` grows without bound across re-rolls, so the flatMap+find cost grows with usage on every render.
- **Root cause**: `selectedCandidate` is an O(n) scan with no index, and the steps call it ad-hoc in JSX rather than computing it once. `GenHistory` has no `selectedId → candidate` map.
- **Impact**: On a heavily-rerolled item (the documented Midjourney-style loop) every render rebuilds the full candidate list 2–3× per generative step. Avoidable; scales the wrong way with the feature's intended use.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Have `useGenerativeStep` return `const sel = useMemo(() => selectedCandidate(history), [history])` and pass it down, so each step reads `sel` once instead of re-scanning. Optionally give `CandidateGallery` the precomputed `total`/`selected` as props rather than recomputing `allCandidates` internally.

## 4. Per-step preview defaults vs. produce defaults can drift; `DEFAULT_*` arrays are shared but the View fallbacks re-pick them inconsistently
- **Severity**: medium
- **Lens**: architecture
- **Category**: mixed responsibility / latent divergence
- **File**: src/components/layout-lab/steps/ItemAnimAudio.tsx:29,67,90 and src/components/layout-lab/steps/itemsSteps.ts:88-91
- **Scenario**: The anim/audio Views fall back to the shared `DEFAULT_*` arrays for their "empty" preview (`const rows = clips.length ? clips : DEFAULT_ANIM_CLIPS`). That is correct for Animations and SFX, but VFX (line 67) renders `DEFAULT_VFX_VARIANTS` as the empty-state list while simultaneously computing `cost`/`CAP` from `art?.data` (defaulting cost to 0, cap to 0.8) — so the empty preview shows three named variants *and* a "0.0 ms of 0.8 ms" budget bar that implies nothing is bound. The View mixes "what Produce will write" (the default clip names) with "what is actually persisted" (cost) in the same panel, and the accept() copy (`vfxCopy`) keys off `variants.length === 0` from the real data, not the displayed defaults. The displayed list and the acceptance verdict describe different states.
- **Root cause**: The fallback-to-DEFAULT pattern was applied uniformly across anim/vfx/sfx, but VFX additionally has a numeric budget that has no matching default in the preview, so the "preview = what Produce writes" invariant the `DEFAULT_*` comment promises (itemsSteps.ts:82-91) only half-holds for VFX.
- **Impact**: A user sees a populated-looking VFX variant list with a 0ms budget while Acceptance says "No Niagara variants exist." Confusing UI; the kind of preview/verdict mismatch the View/Produce/Acceptance contract exists to prevent.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: When `!made`, render the VFX variant rows as `on={false}` (the `Row` already supports it — anim/sfx pass `on={made}`) which it does, but also gate the budget bar/label behind `made` (show "no vfx" like the others) so the empty state reads consistently as "nothing produced," matching `vfxCopy`.

## 5. Hard-coded peer/compare/stat literals duplicated across Views and divorced from `ITEM_ATTR_SCHEMA`
- **Severity**: low
- **Lens**: architecture
- **Category**: dead-ish constants / single-source-of-truth gap
- **File**: src/components/layout-lab/steps/ItemIntegration.tsx:49, src/components/layout-lab/steps/ItemAttributes.tsx:10, src/components/layout-lab/steps/ItemEconomy.tsx:12
- **Scenario**: The Tooltip View hard-codes `stats = [['Damage','34','+3'], ['Attack Speed','1.1/s','-0.1'], ['Weight','3.4kg','+0.4'], ['Value','120g','+20']]` (ItemIntegration.tsx:49) — the same Damage/Attack Speed/Weight/Value keys and the same `34 / 1.1 / 3.4 / 120` numbers that `ITEM_ATTR_SCHEMA` already defines as the single source of truth (itemsSteps.ts:35-44). Separately, `ItemAttributes` hard-codes a `PEERS` list and `ItemEconomy` hard-codes `PEERS_POWER`/peer bars (96, 110) that overlap conceptually but never reconcile. The Tooltip values are frozen literals that will silently disagree with the Attributes table once Produce writes anything.
- **Root cause**: Demo/preview literals were inlined per component instead of being derived from (or co-located with) `ITEM_ATTR_SCHEMA` / a shared `PEERS` constant. The schema comment claims it is "the single source of truth for the attribute key list," but the Tooltip View bypasses it entirely.
- **Impact**: Low today (prototype, fixed numbers), but it is exactly the drift the schema was created to prevent: edit `ITEM_ATTR_SCHEMA.Damage` and the Tooltip still shows 34. Three near-duplicate peer datasets with no shared definition.
- **Effort**: 2 · **Value**: 2
- **Fix sketch**: Derive the Tooltip's stat rows from `ITEM_ATTR_SCHEMA` (key + value + unit) and keep only the per-row `delta` as Tooltip-specific. Hoist a single `ITEM_PEERS` constant into `itemsSteps.ts` and have Attributes/Economy read it instead of two private literals.
