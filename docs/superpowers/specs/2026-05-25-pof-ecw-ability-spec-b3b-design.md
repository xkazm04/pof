# Generate the Wiring Ability C++ from the Spec (Option B3b) — Design

**Date:** 2026-05-25 · **Branch:** `feature/entity-centric-workspace` · **Status:** Approved (design).

Second slice of **Option B3** (the C++ round-trip). B3 = B3a (effects → GE C++, DONE + UE-proven) → **B3b (this: the ability that wires them + activation tags)** → B3c (register generated abilities in a data-driven catalog). Each ships independently and additively.

## Goal

Evolve the existing **"Generate C++"** dispatch so a single run writes the *complete bundle*: the `UGE_Gen_*` GameplayEffects (B3a) **and** a `UGA_Gen_*` `UARPGGameplayAbility` subclass that applies those effects on activation and carries the spec's activation tag rules. Additive (`Abilities/Generated/`), build-gated, Claude-authored — exactly the B3a model, extended.

## Findings driving this design (UE recon)

- **Ability idiom (`GA_WarCry.cpp` / `ARPGGameplayAbility.h`):** `UARPGGameplayAbility` (abstract base) provides `ApplyEffectToSelf(TSubclassOf<UGameplayEffect>)` / `ApplyEffectToTarget(ASC, class)`, `bAutoEndAbility`, `AbilityManaCost`, `CooldownGameplayEffectClass`, `AbilityCooldownTag`. Concrete abilities set tags in the constructor — `SetAssetTags(FGameplayTagContainer(ARPGGameplayTags::X))`, `ActivationOwnedTags.AddTag(...)`, `ActivationBlockedTags.AddTag(...)` (native tag refs) — and in `ActivateAbility` do `CommitAbility` → on fail `EndAbility(...,true,true)` → apply GEs → `EndAbility`.
- **Activation gating ⇄ tagRules** maps cleanly onto the ability (not the effect): `blocks` → `ActivationBlockedTags`, `requires` → `ActivationRequiredTags`, `cancels` → `CancelAbilitiesWithTag`. The default spec's block rules reference `State.Dead`/`State.Stunned`, which **are** natively declared (so they wire via native refs); undeclared tags use the guarded `RequestGameplayTag(..., false)` + delta-report pattern proven in B3a.
- **Set mismatch persists** → the generated ability is *new additive content* (`UGA_Gen_*` in a marked folder), never a patch of a bespoke `GA_*`. It is a buildable starting point a developer extends — same value proposition as B3a's GEs.
- **B3a UE proof confirmed** the real idiom (component-based granted tags, `FGameplayEffectModifierMagnitude(FScalableFloat)`, file naming drops the `U`); B3b reuses those learnings.

## Architecture

The existing callback-free `generate-gas-effects` dispatch is **extended** (not duplicated) to emit the whole bundle in one CLI run, so the GEs and the ability that references them are always consistent and the ability can name the GEs it just generated.

```
"Generate C++" (Effect Mapping card)
  → cli.execute(TaskFactory.generateGasEffects('arpg-gas', { ref, effects, tagRules, scalars }, appOrigin, label))   [unchanged call shape + optional scalars]
  → buildTaskPrompt → header + buildGenerateAbilityBundlePrompt(...)   [no @@CALLBACK]
  → Claude: (1) write UGE_Gen_* into Effects/Generated/ (B3a contract, unchanged)
            (2) write UGA_Gen_<AbilityName> into Abilities/Generated/, wiring the GE classes + activation tags
            (3) build PoF, judge by -abslog, report
```

## Components (app side, TDD'd)

| Unit | Change | Responsibility |
|------|--------|----------------|
| `src/lib/ability/effect-codegen-prompt.ts` | Modify | rename `buildGenerateEffectsPrompt` → `buildGenerateAbilityBundlePrompt`; keep the GE section, append the **ability section** + the optional scalar (manaCost/cooldown) note |
| `src/lib/cli-task.ts` | Modify | `GenerateGasEffectsTask` gains optional `scalars?: { manaCost?: number; cooldown?: number }`; the `generate-gas-effects` case calls `buildGenerateAbilityBundlePrompt`; `TaskFactory.generateGasEffects` accepts `scalars` |
| `SpellbookLogicWorkspace.tsx` | Modify | the existing **"Generate C++"** handler passes `scalars: { manaCost: a.manaCost, cooldown: a.cooldown }` |

The task type, factory name, button label, and callback-free shape are unchanged — only the prompt grows and a scalar context is threaded through.

## The ability section of the contract (appended to the bundle prompt)

1. **Read first:** `Source/PoF/AbilitySystem/ARPGGameplayAbility.h` (base class + `ApplyEffectToSelf/Target`, `bAutoEndAbility`, `AbilityManaCost`) and `Source/PoF/AbilitySystem/GA_WarCry.cpp` (the apply-GE-then-end idiom). Do NOT invent a new system.
2. **Write one `UARPGGameplayAbility` subclass** named `UGA_Gen_<AbilityName>` (file `GA_Gen_<AbilityName>.{h,cpp}`, sanitized) into `Source/PoF/AbilitySystem/Abilities/Generated/` (create the folder; additive — never touch hand-written `GA_*`).
3. **Constructor:** `ActivationBlockedTags` ← each `blocks` rule's `targetTag`; `ActivationRequiredTags` ← each `requires`; `CancelAbilitiesWithTag` ← each `cancels`. Use native refs `ARPGGameplayTags::<Tag>` for declared tags; for undeclared tags use `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` guarded by `IsValid()` and add them to the README tag delta. Set `bAutoEndAbility = true`. If `scalars.manaCost` was provided, set `AbilityManaCost`; otherwise leave a `// TODO: mana cost` comment. Cooldown GE is out of scope — leave a `// TODO: cooldown GE` comment (cooldown-GE generation is a later concern).
4. **`ActivateAbility`:** `CommitAbility` (on fail `EndAbility(...,true,true)`); apply each generated GE — **damaging** effects (a modifier reducing Health) via `ApplyEffectToTarget(target ASC, UGE_Gen_<AbilityName>_<EffectName>::StaticClass())`, **buffs/heals** via `ApplyEffectToSelf(...)`; if target-vs-self is ambiguous, default to target and comment. Then `EndAbility(...,true,false)`. Reference the GE classes generated in step (1) by their deterministic names.
5. **Manifest:** append the ability + the GE classes it wires + the tag delta to the `Generated/README.md` (or an `Abilities/Generated/README.md`).
6. **Build** the `PoF` module; judge by the newest `Saved/Logs/PoF*.log` (non-zero exit on benign shutdown crash is fine). Report files written, tags wired, missing tags.

## Data flow / error handling

Unchanged from B3a: callback-free, fire-and-forget into the CLI rail; verification is the build/`-abslog` + the README. App-side errors are confined to pure prompt assembly. Generated artifacts are reviewable in git before anything depends on them.

## Verification

- **Hard gate: build success** — the generated `UGE_Gen_*` + `UGA_Gen_*` compile and link into `PoF` (the B3a proof method).
- **UE proof:** regenerate the Fireball bundle (now ability + effects), build `PoFEditor`, confirm `Result: Succeeded`; commit narrowly to `pof-exp`.
- Deferred: a functional test that grants the generated ability and activates it (needs a pawn/ASC harness) — stretch, as in B3a.

## Testing (app side)

- **`buildGenerateAbilityBundlePrompt` unit test:** retains the B3a GE assertions and adds — names `UGA_Gen_`, `Abilities/Generated/`, instructs reading `ARPGGameplayAbility`/`GA_WarCry`, maps `blocks`→`ActivationBlockedTags` / `requires`→`ActivationRequiredTags` / `cancels`→`CancelAbilitiesWithTag`, references `UGE_Gen_…::StaticClass()`, and threads `manaCost` when supplied.
- **`cli-task` test:** `generate-gas-effects` prompt now contains both the GE and ability sections and remains callback-free (`not toContain('@@CALLBACK')`); `TaskFactory.generateGasEffects` accepts `scalars`.
- **Workspace test:** "Generate C++" still dispatches a `generate-gas-effects` task (unchanged); the dispatched task carries `scalars`.

## Scope / out of scope

- **In:** extend the one dispatch to also generate the wiring `UGA_Gen_*` ability + thread scalar context; UE build proof.
- **Out:** B3c (the `DT_GeneratedAbilities` registry); cooldown-GE generation; auto-editing native tags; attaching to bespoke `GA_*`; the functional test (stretch); other catalogs.

## Invariants

Branch-local app commits; `@/` imports; `logger` not `console`; co-author tag. UE-side: write only under `Abilities/Generated/` + `Effects/Generated/` (+ READMEs); judge build by `-abslog`; stage only those folders on the shared tree; commit narrowly to `pof-exp`, don't push. Each app task ends targeted vitest green + `tsc`/eslint clean (excluding the 3 pre-existing foreign `AssetInspector` errors).
