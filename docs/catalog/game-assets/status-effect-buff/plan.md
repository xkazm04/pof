# Status Effect / Buff — Catalog Pipeline Brief

**Category:** Game Assets · **Catalog:** `status-effects` (new) · **Description:** Temporary or persistent modifier applied to an actor.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Burning** — the `status-effects` starter `id: 'status-burning'` (Debuff, tags `fire`/`dot`). Drive idea → real UE asset → passing test gate.

**Status (this session):** Burning and the Fireball ability's Burning DoT are the **same UE artifact** — the generated `UGE_Gen_Fireball_Burning`. The asset already existed but was **non-functional as a status effect**: the lead Skill/Ability session left a documented tag-delta — `State.Burning` was referenced by the GE's tag-grant but never declared natively, so `RequestGameplayTag` returned invalid and the grant was silently skipped. **This session closed that gap** (declared `State.Burning` in `ARPGGameplayTags.h/.cpp`), making Burning a real status effect, and added a config test gate that asserts the grant. 6/14 steps reuse/produced, 3 partial, 5 are gaps. Honest dispositions below.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief  
  _agent: Designer · **produced**: Burning is the lingering ignite of fire damage — a short, ticking debuff that marks the target as on-fire. Fantasy = "set them alight; they keep taking damage until it burns out." Seeded by Fireball, but a general fire-DoT any fire source can apply._
- [x] 2. Mechanical Effect Logic  
  _agent: Designer · **reuse** `UGE_Gen_Fireball_Burning` (Effects/Generated/, from the B3 codegen): HasDuration; periodic `Health += -5`; grants `State.Burning` via a `UTargetTagsGameplayEffectComponent`. ⚠️ the grant was inert until this session declared the tag natively._
- [~] 3. Stacking Rules  
  _agent: Designer · ⚠️ **GAP**: the generated GE sets no `StackingType`/`StackLimitCount`/`StackDurationRefreshPolicy` → GAS default = each application is an independent instance (no aggregation). **Intended:** `AggregateByTarget`, `StackLimitCount` 1, `RefreshOnSuccessfulApplication` (re-igniting refreshes the 3s window, does not double the tick). Codegen has no stacking model — record as a spec+codegen gap._
- [x] 4. Duration & Tick Rules  
  _agent: Designer · **reuse + gated**: `HasDuration` 3.0s, `Period` 1.0s, `bExecutePeriodicEffectOnApplication=false` (first tick after 1s, not on apply → 3 ticks). Asserted by this session's test gate._
- [~] 5. Source Attribution & Dispel Rules  
  _agent: Designer · **partial**: source attribution is **free at runtime** — GAS records the instigator/causer in the effect's `FGameplayEffectContext`, so "who set me alight" is available without extra schema. ⚠️ **GAP**: no dispel/cleanse mechanism in PoF; a cleanse would `RemoveActiveEffectsWithGrantedTags(State.Burning)`. Now that `State.Burning` is a real granted tag, a remove-by-tag cleanse becomes possible._
- [~] 6. Interaction with Other Statuses  
  _agent: Designer · **design**: thermal opposition with the sibling starter **Chilled** — applying Burning should clear Chilled and vice-versa. ⚠️ **GAP**: no status-interaction system; implementable via `RemovalTagRequirements`/`OngoingTagRequirements` on the GEs (e.g. Burning removes `State.Chilled`), but unmodeled in the spec/codegen._
- [x] 7. Balancing Pass  
  _agent: Balancer · **reasoned**: 5/tick × 3 ticks = 15 fire damage over 3s; Fireball impact is 35 → 50 total, Burning ≈ 30% of the combo. Reads as a fair light DoT. ⚠️ same finding as Fireball: the flat additive modifier **bypasses `UARPGDamageExecution`**, so the DoT ignores fire-resist/armor. Acceptable for a v1 authored effect; flagged for the execution-routing decision._
- [ ] 8. Icon 2D Art  
  _agent: Concept2D · 🔗 **bind, don't author**: `presentationLink('icon', 'iconset-abilities')` → the `icon-sets` "Ability Icons" family. A flame-debuff icon is producible via the Leonardo 2D dispatch (not run this session — shared presentation library)._
- [ ] 9. Overhead/Body VFX  
  _agent: VFX · 🔗 + ⚠️: `presentationLink('vfx', 'vfx-fire-impact')` for the ignite burst; a **looping body-fire** wants its own GameplayCue (`GameplayCue.Status.Burning` — not yet declared) driving a looping Niagara emitter. **GAP**: no Niagara authoring; cue convention is the reusable piece._
- [ ] 10. Loop SFX  
  _agent: Audio · 🔗 + ⚠️: `presentationLink('sfx', …)` into the `audio` catalog; the `import_audio_set` dispatch can import a crackling-fire loop, but none authored this session. **GAP** (asset), opportunity (pipeline exists)._
- [~] 11. UI Buff Bar Integration  
  _agent: UI · **unblocked**: a buff bar reads active GEs carrying `State.*` granted tags + remaining duration — and `State.Burning` is now a real granted tag, so Burning is renderable. ⚠️ **GAP**: no buff-bar widget yet (`hud-elements` has only a Health Bar starter). The buff bar is a **generic consumer of every status-effects row**, not per-status work._
- [ ] 12. Tooltip & Localization  
  _agent: Writer · **partial**: tooltip strings live on the catalog entity (`name`, `description`, dmg/duration). ⚠️ **GAP**: no localization/string-table system (shared with Fireball). Keys would be `Status_Burning_Name` / `_Desc`._
- [~] 13. Edge Case Test (overlap, refresh)  
  _agent: QA · **partial / config-only**: this session's gate is a **pure config test** (duration/period/modifier/granted-tag — no PIE world). Runtime overlap/refresh/stack behavior needs the "apply GE to a dummy ASC, tick, assert attribute delta" fixture that the Fireball session flagged as missing. Config gate passes; runtime gate = documented GAP._
- [x] 14. UE Asset Packaging  
  _agent: Packager · **produced/reuse**: `UGE_Gen_Fireball_Burning` (already committed, listed in `Effects/Generated/manifest.json`) + this session's native `State.Burning` tag + the `VSStatusBurningEffectTest` gate. Catalog binding: `ueAssets = ['/Script/PoF.GE_Gen_Fireball_Burning']`._

## PoF integration
- **Catalog:** `status-effects` (registered in Phase A); entity `id: 'status-burning'`.
- **Status-effect schema (design-of-record):** a status effect *is* a `UGameplayEffect` viewed from the status catalog. The catalog `data` should carry the design face of that GE:
  `{ durationPolicy: HasDuration|Infinite|Instant, duration, period, tickOnApply, modifiers:[{attribute,op,magnitude}], grantedTags:[State.*]  ← the defining "status" marker, stacking:{type,limit,refresh}, removalTags:[], dispelTags:[], presentation:{icon,vfx,sfx cue} }`.
  The **granted `State.*` tag is the identity of a status effect** — without it the GE is just a modifier. Burning's is `State.Burning`.
- **Reuse:** B3 `generate-gas-effects` codegen (the GE) · native gameplay-tag declaration (this session) · the `VSGenFireballEffectTest` config-gate pattern · `presentation-links.ts` for icon/vfx/sfx binding · `damage-formula.ts` reasoning for balance.
- **Gaps:** stacking/dispel/removal codegen, status-interaction system, buff-bar HUD widget, looping status GameplayCue + Niagara, localization, runtime tick-test fixture, `UARPGDamageExecution` routing for the DoT.

## Cross-catalog dependencies
- **`spellbook` → Fireball** — Burning IS Fireball's granted DoT; same artifact, two catalog views. The granted `State.*` tag is the join key.
- **`hud-elements` → buff bar** — consumes Burning's granted tag + duration (generic consumer of all status rows).
- **`vfx` → Fire Impact Burst**, **`icon-sets` → Ability Icons**, **`audio`** — presentation bindings (produced once, referenced).
- **`status-effects` → Chilled** (sibling starter) — same pipeline; thermal opposite of Burning.

## Session Findings

**Result:** Burning is now a **functional** status effect with a passing test gate.
- **Asset:** `UGE_Gen_Fireball_Burning` (Effects/Generated/) — HasDuration 3s, period 1s, `Health −5`/tick, grants `State.Burning`.
- **Capability advanced:** declared `State.Burning` natively (`ARPGGameplayTags.h/.cpp`), activating the GE's previously-inert tag grant **without hand-editing the auto-generated file** (the codegen does a runtime `RequestGameplayTag` lookup, so a native declaration is enough).
- **Test gate:** `Source/PoF/Test/Combat/VSStatusBurningEffectTest.cpp` → `Project.Functional Tests.PoF.StatusBurning.EffectConfig` = **`Result={Success}`** (headless, `-nullrhi`, judged by `-abslog`; build `Result: Succeeded` under `-WarningsAsErrors`). Pure config gate — no PIE world.
- **Catalog binding (design-of-record, persist when app runs):** `status-burning` → `lifecycle: verified`, `ueAssets: ['/Script/PoF.GE_Gen_Fireball_Burning']`, `links: [presentationLink('icon','iconset-abilities'), presentationLink('vfx','vfx-fire-impact')]`.

### Cross-catalog opportunities
- **A status effect = a GameplayEffect with a granted `State.*` tag.** The granted tag is the *identity* of the status (and the join key to `spellbook`): any ability that applies a DoT/buff seeds a `status-effects` row from the same generated GE. Burning ⟷ Fireball confirmed end-to-end.
- **The buff bar (`hud-elements`) is a generic consumer of every `status-effects` row** — it renders any active GE carrying a `State.*` granted tag + its remaining duration. Declaring `State.Burning` as a real granted tag *unblocked* the buff-bar step for Burning (and the pattern for all statuses). Build the buff bar once; it reads every status.
- **Chilled (sibling starter) is a near-clone of this pipeline** — swap `Health −5/tick` for a MoveSpeed modifier and `State.Burning` for `State.Chilled`. The status-effect schema (duration/period/modifiers/grantedTags/stacking) generalizes directly; the second status should be far cheaper.
- **A looping-status GameplayCue convention** (`GameplayCue.Status.Burning`, distinct from the one-shot `GameplayCue.HitImpact.Fire`) is the reusable presentation hook every status effect needs for body-VFX/loop-SFX.

### Gaps / blockers for future sessions
- **Codegen emits no stacking/dispel/removal config.** `StackingType` / `StackLimitCount` / `StackDurationRefreshPolicy` and `RemovalTagRequirements` are unmodeled in the ability spec and the `generate-gas-effects` dispatch. Burning relied on the GAS default (independent instances). Every status needs a stacking + removal model — spec + codegen investment.
- **No status-interaction system** (e.g. Burning ↔ Chilled thermal opposition). Implementable via `Removal`/`Ongoing` tag requirements on the GEs, but unmodeled.
- **No dispel/cleanse mechanism.** Now that statuses carry real `State.*` granted tags, a `RemoveActiveEffectsWithGrantedTags` cleanse GE/ability is buildable but unbuilt.
- **No buff-bar HUD widget** (`hud-elements` has only a Health Bar starter). Blocks the UI step for all statuses.
- **No looping GameplayCue / Niagara body-VFX, no loop-SFX asset, no localization** — shared presentation gaps with `skill-ability/Fireball`.
- **Runtime edge-case gate still missing.** Overlap/refresh/stack behavior needs the "apply GE to a dummy ASC, tick, assert attribute delta" fixture the Fireball session flagged. The config gate is the pragmatic floor; runtime DoT behavior is unverified.
- **DoT bypasses `UARPGDamageExecution`** (flat additive `Health −5` skips fire-resist/armor) — same policy decision as Fireball's impact GE.
