# Legacy Salvage — what we keep before deleting the Legacy shell

The Legacy shell (`src/components/layout/**`) and the module system (`src/components/modules/**`, `module-registry.ts`, `feature-definitions.ts`, the evaluator UIs) are being **deleted**. A full read-only scan found that **~90% is superseded** by the catalog model and is dropped deliberately — even at the cost of real past effort. This doc records the strict survivors so nothing valuable is lost, and where each lands.

**The bar for "keep":** it must make us better at (a) composing catalog content, (b) running catalog→UE pipelines, or (c) final output quality. Navigation chrome, per-module dashboards, and speculative analytics fail that bar.

> Cross-refs (don't duplicate): archetypes → [`PIPELINE_REVIEW.md`](PIPELINE_REVIEW.md); acceptance tiers + data contract → [`WIRING-AND-ACCEPTANCE.md`](WIRING-AND-ACCEPTANCE.md); capability/dispatch reuse + living logs → [`index.md`](index.md); the project rules CLIs read → the **Canon** (`src/lib/catalog/canon/`).

---

## A. Keep → migrate into the Canon (concrete content; do this *before* deleting Legacy)

This is the highest-value salvage: hard-won knowledge that currently lives in `src/lib/knowledge/` and is injected by the *legacy* prompt builder. Deleting the legacy prompt path orphans it — so the content must move into the Canon, which is the new injection path (`ArchetypeStep` → `canonContextFor`).

1. **UE gotchas / tripwires** — `src/lib/knowledge/ue-gotchas.ts`. Concrete UE pitfalls that directly prevent failures. Migrate each into a Canon rule (mostly `category:'project'`, a couple `'art'`). Migrate at minimum:
   - `ue-umg-rebuild-timing` — C++-only `UUserWidget` builds its Slate tree in `RebuildWidget()`, not `NativeConstruct()`.
   - `ue-umg-debug-overlay` — `AddOnScreenDebugMessage` draws over UMG at top-left; offset the HUD or disable it.
   - `ue-runtime-editor-api` — runtime modules touching `GEditor`/`FAssetTools`/`FEditorDelegates` must `#if WITH_EDITOR`-guard or Shipping fails.
   - `ue-fbx-scale-metre` *(art)* — metre-authored FBX: Blender `apply_unit_scale=True` + UE `import_uniform_scale=1.0`.
   - `ue-interchange-crash` — UE 5.7 FBX import via Interchange + `-run=pythonscript` crashes; use full editor `-ExecutePythonScript=`.
   - `ue-plugin-rescan` — engine-plugin content needs an asset-registry rescan after enable before referencing.
2. **Known UE asset paths by domain** — `src/lib/knowledge/ue-known-assets.ts`. Real engine/project paths (e.g. `/MoverTests/.../SKM_Manny`) that stop CLIs inventing paths. Migrate as Canon rules carrying the paths in `refs`, scoped so a domain only sees its assets (e.g. an `art`/`global` `proj-known-assets` rule per domain).
3. **The wiring contract** — `src/lib/knowledge/wiring-requirements.ts`. Every produced artifact must declare **Granted by · Activated by · Dependencies · Verification**. Migrate as a `project` Canon rule ("no gray-box: every artifact declares how it's registered, what triggers it, what it needs, and one observable check") **and** see §B-3.

→ **Action:** add these as `CANON_SEED` entries (and/or via the Canon editor), then the orphaned `src/lib/knowledge/*` files can be deleted with the legacy prompt system.

## B. Keep → fold as authoring/acceptance principles (where they're codified)

4. **6-section prompt structure** — `src/lib/prompts/prompt-builder.ts`. Prompts assemble in a fixed order: *Project Context → Domain Context → Task → UE Best Practices → Output Schema → Success Criteria.* Adopt as the **prompt-authoring principle** for every `StepSpec` produce prompt (canon block is the "Project Context + UE Best Practices" sections). Already recorded in [`AUTHORING.md`](AUTHORING.md) (prompt-authoring note); keep CLAUDE.md aligned.
5. **3-pass evaluation** — `src/lib/evaluator/module-eval-prompts.ts` (Structure → Quality → Performance, plus a per-domain *trace* pass, e.g. combat one-hit end-to-end). This maps onto the acceptance ladder, it is not a new system: **structure + UE-convention quality → the L2 static check; trace-able runtime behavior → the L3 gate.** Fold the mapping into `WIRING-AND-ACCEPTANCE.md` as the "what L2/L3 should actually assert" guidance.
6. **The wiring contract as an acceptance requirement** — beyond the Canon rule (§A-3), make a step's *Verification* line feed its acceptance `detail`/`reason`, and treat "compiled but not granted/activated" as **not** config-complete. Sharpens L2/L3 in `WIRING-AND-ACCEPTANCE.md`.
7. **Error-memory injection loop** *(lightweight; the lib already exists)* — `error-memory-db.ts` fingerprints/dedups past errors. Principle: a Produce step injects the top relevant prior errors into its prompt so the model doesn't repeat them. Keep the lib; wire it into the produce-prompt path later. No new UI.

## C. Keep → capabilities that MUST survive the deletion (deletion-safety)

Deleting the module **UIs** must NOT delete the underlying **libs** in `src/lib/**` — the catalog pipelines call these directly from `produce()`/`accept()` (extends the "Dispatches/generators to reuse" list in [`index.md`](index.md)). Verify each still imports after deletion (`npm run typecheck`):

| Lib | Consumed by (catalog step / tier) |
|-----|-----------------------------------|
| `gas-codegen.ts`, `audio-codegen.ts` | ability / status / audio **Produce** (C++ emit) |
| `blueprint-parser.ts`, `asset-code-oracle.ts` | **L2** static acceptance (asset↔code sync, schema check) |
| `ue5-bridge/remote-control-client.ts` | **L3/L4** runtime acceptance (query live editor) |
| `visual-verification-db.ts` | **L4 visual gate** (screenshot + Gemini) — *this is the L4 implementation we deferred* |
| `visual-gen/providers.ts`, `visual-gen/generators/*`, `visual-gen/rig-presets.ts`, `visual-gen/ue5-import-templates.ts` | 2D/3D/procedural/rig/import **Produce** |
| `blender-mcp/scripts/*` | mesh/LOD/rig/convert **Produce** |
| `error-memory-db.ts` | §B-7 prompt injection |

The UE-bridge HTTP routes (`/api/pof-bridge/*`, `/api/ue5-bridge/*`) and the screenshot/Gemini path are the basis of the deferred live-UE L3/L4 runner — keep them.

## D. Minor UX notes (optional, low priority)

Worth a *small* nod when the catalog tree / pipeline view get polish — not worth porting code:
- **Resizable + magnetic-snap left column** and **progress rings** on tree nodes (from `SidebarL2`) — quality-of-life on the Category→Catalog→Entity tree.
- **Event-bus + time-grouped activity feed** (`eventBus` + `ActivityFeedPanel`) — a "pipeline events" surface so background produce/verify results are visible. The catalog already has the per-entity rollup + the index living logs; an activity feed is a future nicety, not a must.
- **Keyboard layer** (Ctrl+B / Ctrl+1–5) — power-user nav for the tree.

## E. Dropped deliberately (honest list — this is the ~90%)

We are deleting real past effort. None of the below clears the bar:
- **All per-module domain UIs** (`src/components/modules/**` — core-engine/content/game-systems editors, asset-forge/material-lab/auto-rig/procedural/scene-composer UIs, etc.). The `StepSpec`/`ArchetypeStep` + catalog model supersedes them; the *libs they wrapped* survive (§C).
- **The Legacy shell** (`src/components/layout/**` — L1/L2 sidebar topology, project switcher, `ModuleRenderer` LRU/crossfade, CLI tab bar, global Cmd+K search, EventBus devtools, file watcher, dynamic title) and `navigationStore`. The catalog homepage (Category→Catalog→Entity tree) replaces it; do not repurpose `navigationStore`.
- **The module taxonomy itself** — `module-registry.ts` checklists/quick-actions and `feature-definitions.ts`/NBA. The *checklist prompt bodies* are rich but superseded by `StepSpec`; mine any one-off prompt only if a specific row needs it. Cross-catalog **wave ordering** (already in our plan) covers the useful part of NBA; we do **not** rebuild the dependency-graph engine.
- **Speculative / heavy learning systems** — `pattern-library-db` (+ anti-patterns), `game-director` playtest sessions, `telemetry`/genre-evolution, `regression_fingerprints/occurrences/alerts`, `session-analytics`, `codebase-archaeologist`, crash-analyzer. Interesting, but not core to mastering catalog output now. **Dropped** (the DBs can stay dormant; we do not carry their philosophy into the plan).

## F. Action checklist (before/with the Legacy delete)

1. [ ] Migrate §A gotchas + known-assets + wiring rule into `CANON_SEED` (then the `src/lib/knowledge/*` files can go with the legacy prompt builder).
2. [ ] Add §B principles: 6-section prompt order + 3-pass→L2/L3 mapping + wiring-as-acceptance into `WIRING-AND-ACCEPTANCE.md` and [`AUTHORING.md`](AUTHORING.md) (6-section already noted there).
3. [ ] Confirm §C libs still typecheck after the module-UI delete (they live in `src/lib/**`, not the deleted trees).
4. [ ] Delete §E with confidence — the value is captured above.
