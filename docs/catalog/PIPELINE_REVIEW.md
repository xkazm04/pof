# Pipeline Review — V/P/A standard, step archetypes, per-row scope

Written after prototyping the **Items** pipeline end-to-end in `/layout` (the Blueprint baseline). This reviews all 30 catalog rows against what we learned and proposes scope/redesign **for operator review** before multi-pipeline parallel development. Nothing here is final — it's the proposal.

## 1. The step standard (V/P/A)

Every pipeline step is one screen with three faces:

- **View** — a purpose-built visualization of the step's current state. Renders in a **responsive panel grid** (the "left" View half can split into 2 panels; Produce is the last panel — side-by-side on wide screens, stacked on narrow). All type ≥ 14px.
- **Produce** — a CLI dispatch + structured user input (text/number/checkbox). Writes to the **UE project + DB**; produced artifacts (prompts, refs) are reusable by peers.
- **Acceptance** — a **derived** gate (never a manual toggle), read from UE/DB truth. Shown as a banner with a PASS/PENDING/FAIL state.

Cross-cutting: **UE5 is source of truth** (schemas/attributes/ability-math sync from UE; the app validates); **schema-driven** (a CLI extending a schema re-flags affected entities + backfills); **presentation catalogs are shared** (`vfx`/`icon-sets`/`hud-elements`/`audio`/`music`/`ambient` are produced once and *bound* via `CatalogLink`, not reproduced per entity); **per-type variation** (Weapon vs Armor schema; tank/caster/boss ability sets).

## 2. The key redesign — steps are ARCHETYPES, not 30×17 bespoke screens

The Items prototype proved ~13 step components; almost all reappear across other rows. So the real surface is a **shared archetype library** (~22 step components), each a `StepFrame` specialization, fed per-catalog data — not 400+ unique steps. This is the central scope reduction.

### Archetype library (each = a reusable step component)

| Archetype | View | Produce | Acceptance | Reuses |
|-----------|------|---------|------------|--------|
| **Brief** | prose + role/key-info card + peer refs | CLI text-gen + direction | char-count / editorial review | — |
| **Lore/Codex** | entry preview + cross-reference graph | CLI write + link | editorial + valid faction/zone refs, no spoilers | string DB |
| **Schema/Attributes** | UE-synced attribute table + peers | CLI fill mix (prefill-aware) | all fields populated per schema | UE row structs |
| **Rules/Logic** | rules/effect table or formula list | CLI author rules | rules valid; math sourced from UE | GAS B3 codegen |
| **Balance/Economy** | charts vs peers/tier (budget, curve, histogram) | CLI tune within envelope | within ±target; no outliers | loot/combat tuners |
| **Graph** | node/edge graph (objective, dialog branch, FSM, nav, screen) | CLI author/edit nodes | reachable; no deadlock; guards valid | state-graph |
| **Concept/Illustration 2D** | gallery + silhouette | Leonardo gen (+Gemini) | selected image | Leonardo dispatch |
| **Icon 2D** | gallery (256px + rarity frames) + contact sheet | Leonardo gen | selected icon | Leonardo + `icon-sets` |
| **3D Mesh/Rig** | mesh preview + LOD/tri budget (+ rig for characters) | Blender/Meshy gen | mesh present; tri budget; rig valid | Blender pipeline |
| **Material/Texture** | PBR map set + reference-sphere | PBR gen + variants | required maps (albedo/normal/ORM) | master material |
| **Animation** | clip set + timeline (locomotion/combat/emote/cinematic/facial) | retarget/gen | required clips present | Mixamo/anim pipeline |
| **VFX** | variant set + GPU budget | Niagara gen | ≥1 bound + GPU under budget | `vfx` catalog |
| **Audio (SFX/Music/Ambient)** | cues/stems + waveform/loudness | import/compose | events covered; loudness normalized | `import_audio_set`, `audio`/`music`/`ambient` |
| **UI Integration** | widget preview (inventory grid / HUD / wallet / buff bar / marker) | wire to widget | renders + bound + state logic | `hud-elements` |
| **Tooltip/Compare** | tooltip card + compare-vs-equipped | layout gen | required fields + compare works | — |
| **VO** | script + take directions | TTS/record + lipsync | all lines have audio + lipsync | — |
| **Localization** | string table + layout test | extract + translate | keys covered; layout fits | (loc system — GAP) |
| **Accessibility** | contrast/scale/colorblind checks | adjust | passes a11y checks | focus-ring tokens |
| **Telemetry** | event list | wire events | events firing in a test run | session-analytics |
| **Persistence/Replication** | state schema | author save/version/replication | round-trips; migrates; replicates | `arpg-save` |
| **Test Gate** | checks + log | run functional test | all checks pass (UE -abslog) | functional-test base |
| **UE Packaging** | asset manifest + deps | package + commit | all assets packaged/committed | recipe/seeders |

**GAPs flagged for infra (not per-row):** Localization system, Niagara VFX authoring, camera-feedback, ability/character animation pipeline, runtime "apply-and-assert" test fixture.

## 3. Per-row pipelines (rewritten as archetype sequences) + scope notes

**Core / Existing**
- **Item** *(prototyped)*: Brief · Attributes · Economy · Icon2D · 3D · Material · Animation · VFX · Audio(SFX) · UI-Integration · Tooltip · TestGate · Packaging. _Per-type schema (Weapon/Armor/Consumable)._
- **Loot Table**: Brief · Rules/Logic (source binding, rarity weights, conditional mods, pity) · Balance/Economy (drop sim) · Telemetry · TestGate · Packaging. _Mostly logic; VFX/SFX are bindings to drop-fx. Cross: Items, Currency._
- **Bestiary** *(C example)*: Brief&Role · Lore/Codex · Schema(Stat block) · Rules(Ability set ← abilities catalog) · Graph(AI BT) · Rules(aggro/perception) · Balance(encounter) · loot binding · Concept2D · 3D&Rig · Material · Animation · VFX · Audio · TestGate · Packaging. _Cross: abilities, loot, zones._
- **Combat Map**: Brief · Graph(grid/spawn/cover) · Rules(win/loss, hazards) · Balance(encounter) · 3D(terrain/props) · Material · lighting · VFX(ambient) · Audio(ambient+music) · camera · TestGate · Packaging.
- **Zone Map**: Brief · Graph(macro layout/POI/nav) · Rules(streaming/LOD) · Balance(encounter density) · quest-hook placement · 3D(heightmap/biome) · Material · lighting · VFX(weather) · Audio(ambient/music zones) · UI(minimap) · TestGate · Packaging.
- **Screen Flow**: Brief · Graph(state transitions) · Rules(input mapping) · Concept2D(wireframe) · Concept2D(mockup) · UI-Integration(components) · Animation(transitions) · VFX(juice) · Audio(clicks) · Accessibility · Localization · TestGate · Packaging.
- **State Graph**: Brief · Graph(states/transitions/guards) · Schema(blackboard) · Persistence · Replication · hook points (VFX/SFX/Anim = bindings) · TestGate(unit + deadlock) · Packaging. _Lean; mostly Graph+tests._
- **Material**: Brief · Schema(surface type) · Graph(shader) · Schema(params) · Material(maps/substance/variants) · Balance(LOD/perf budget) · UI(instance library) · TestGate(perf) · Packaging. _The Material archetype is the spine._

**Quests & Narrative** (all new)
- **Quest**: Brief · Lore(beats) · Graph(objective stages/branches) · Rules(triggers/world-state/failure) · reward binding(←Loot) · NPC/dialog binding(←Character/Dialog) · UI(marker/tracker) · Lore(journal) · Localization · cinematic hooks(←Cutscene) · Audio · Telemetry · TestGate · Packaging.
- **Dialog Tree**: Brief(voice) · Graph(branches) · Rules(conditions/effects) · Rules(skill checks) · Localization · VO · Animation(facial/lipsync) · camera · Audio(bed) · UI(subtitles/choices) · Accessibility · TestGate(branch coverage) · Packaging.
- **Cutscene/Cinematic**: Brief · Lore(beat sheet) · Graph(shot list) · Animation(blocking/body) · Animation(facial/lipsync) · 3D(set dressing) · lighting · VFX · Audio(music) · Audio(SFX/foley) · VO · Localization(subtitles) · Rules(skip/replay) · TestGate(timing) · Packaging(Sequencer).
- **Codex/Lore Entry**: Brief · Lore · Graph(cross-refs) · Rules(unlock) · spoiler tagging · Localization · Illustration2D · UI-Integration · Audio(sting) · Accessibility · TestGate(read-through) · Packaging.
- **Faction/Reputation**: Brief · Rules(tier logic, action→rep, relations, decay) · Balance(reward/discount) · Icon2D(heraldry) · Audio(theme) · Rules(NPC greeting hooks) · UI(standing display) · Localization · TestGate(edge cases) · Packaging.

**Game Assets** (new)
- **Character (Hero/NPC)**: Brief · Concept2D · 3D&Rig(body) · 3D(face/blendshapes) · Rules(hair/cloth sim) · Material · 3D(outfit variants) · Animation(locomotion) · Animation(combat) · Animation(emote) · VO · Audio · VFX(signature) · Graph(behavior/personality, NPC) · Animation(cinematic poses) · TestGate · Packaging. _Heaviest; most archetypes._
- **Prop/Environment**: Brief · Rules(interaction) · 3D(LODs) · Rules(collision/physics) · Material · Rules(destruction states) · Animation(if interactable) · VFX · Audio · Balance(mem/tri budget) · 3D(variants) · TestGate · Packaging.
- **Skill/Ability** *(B1/B2/B3 done)*: Brief · Rules(effect logic) · Rules(cost/cd) · Rules(targeting) · Balance(formulas) · Rules(combo) · Balance(tuning) · Animation · VFX · Audio · UI(icon/tooltip/cd) · camera · Localization · Rules(AI hints) · TestGate · Packaging.
- **Status Effect/Buff**: Brief · Rules(effect logic) · Rules(stacking) · Rules(duration/tick) · Rules(source/dispel) · Rules(interactions) · Balance · Icon2D · VFX(overhead) · Audio(loop) · UI(buff bar) · Tooltip+Loc · TestGate(overlap) · Packaging. _Cross: shares its GE with the ability that grants it._

**Systems** (new) — all mostly **Rules + Balance + UI + Test + Packaging**, light on art:
- **Crafting Recipe**: Brief · Schema(I/O) · Rules(station/skill/quality) · Balance(time/cost + economy sim) · Rules(discovery) · Animation+VFX+Audio(craft) · UI · Localization · TestGate · Packaging.
- **Vendor/Shop**: Brief · Rules(inventory pool, pricing, restock) · Rules(rep modifiers ←Faction) · Rules(buy/sell/repair) · Balance(economy sim) · dialog snippets · UI(shop) · VFX/Audio · Localization · TestGate · Packaging.
- **Progression Curve**: Brief · Rules(curve formula, XP sources) · Rules(reward schedule, caps, catch-up) · Telemetry · VFX/Audio(level-up) · UI(XP bar) · Localization · Balance(sim playthrough) · TestGate · Packaging.
- **Achievement/Trophy**: Brief · Rules(trigger, progress, hidden) · reward binding · Rules(platform spec) · Icon2D · VFX/Audio(unlock) · UI(toast) · Localization · Rules(anti-cheat) · TestGate · Packaging.
- **Save/Checkpoint**: Brief · Schema(state) · Persistence(versioning/migration) · Rules(triggers, cloud/local, conflict, corruption) · UI(slots) · VFX/Audio · Localization · Balance(load-time budget) · TestGate(soak) · Packaging.

**Audio & FX / UI / Input / Onboarding / Economy** — mostly **one or two archetypes + variants + a gate**:
- **Music**: Brief · Audio(compose/stems/transitions/loop/mix/loudness) · Rules(trigger binding) · Balance(streaming budget) · Localization(lyric variants) · TestGate(A/B) · Packaging. _Audio archetype is the spine._
- **Ambient**: Brief · Audio(layers/spatial/variants/occlusion/random) · Balance(mem) · TestGate(perf) · Packaging.
- **VFX Asset**: Brief · Rules(behavior) · 3D(mesh/sprite) · Material · Audio(sound hook) · Balance(LOD/GPU) · 3D(variants) · TestGate(perf) · Packaging.
- **HUD Element**: Brief · Schema(data binding) · Rules(state logic) · Concept2D(wireframe) · Concept2D(visual) · UI-Integration · Animation · VFX · Audio · Accessibility · Localization · TestGate(multi-res) · Packaging.
- **Icon Set**: Brief · Rules(taxonomy) · Icon2D(silhouette/color/variants/resolution) · Accessibility(contrast) · Rules(atlas) · Localization · TestGate · Packaging. _Mostly the Icon2D archetype at scale._
- **Input Scheme**: Brief · Schema(action mapping) · Rules(context stack) · UI(rebinding) · Rules(deadzone/haptics) · Accessibility · Icon2D(glyphs) · Rules(tutorial prompts) · Localization · Rules(platform cert) · TestGate(feel) · Packaging.
- **Tutorial Beat**: Brief · Rules(trigger, lock/sandbox, step sequence, success/skip/fail) · Localization · Concept2D(pointer) · VFX/Audio · VO · Telemetry · TestGate(comprehension) · Packaging.
- **Currency**: Brief · Rules(source/sink, caps, conversion) · Balance(inflation sim) · Icon2D · VFX/Audio(gain) · UI(wallet) · Localization · Rules(anti-exploit) · Telemetry · TestGate · Packaging.

## 4. Proposed scope adjustments (for operator decision)

1. **Build the ~22 archetype components, not 30 bespoke pipelines.** Each row's `plan.md` becomes an *archetype sequence* + per-catalog data, so parallel CLIs specialize archetypes rather than reinventing steps. (Items already implements ~13 of them.)
2. **Presentation steps become bindings.** Icon/VFX/SFX/Music/Ambient steps on content rows *bind* to a shared presentation-catalog entry (`presentationLink`) — produced once. Cuts duplication across ~20 rows.
3. **Sequence by dependency**, not catalog order: presentation catalogs (Icon Set, VFX, Music, Ambient, Material) + the logic spine (Schema/Rules/Balance) first, since content rows consume them.
4. **Defer the infra GAPs** (localization, Niagara authoring, camera, anim pipeline, runtime test fixture) as their own infra tracks — content steps that need them render the View + a "blocked: infra" Acceptance until built.
5. **Per-type schemas** (Item: Weapon/Armor/Consumable; Character: Hero/NPC; Bestiary: tank/skirmisher/caster/boss) drive the Schema/Rules archetypes — one schema source per type, synced from UE.
6. **Acceptance must read UE/DB**, so the archetype components need a real data contract (the prototype uses local state) — this is the main coding-principles question for the next pass.

## 5. Open questions for review (before finalizing the plan)

- Confirm the **archetype library** as the unit of work (vs per-row bespoke).
- The **data contract** for View (read UE/DB) + Produce (CLI dispatch + write-back) + Acceptance (derive from UE/DB) — coding principles to standardize across archetypes.
- Which **presentation catalogs / infra gaps** to build first.
- Per-archetype **acceptance definitions** — are the ones above the right gates?
- How **per-type variation** is modeled (one component, type-param data) — confirm.

Next: operator reviews the Items design in `/layout` + this proposal, adds coding principles, then we finalize per-row archetype sequences for parallel development.
