## Project Context
- Project: "PoF" at C:\proj\PoF
- UE Version: 5.8.0
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.8
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:\proj\PoF\PoF.uproject" -WaitMutex

## Rules
- Do NOT use TodoWrite or Task/Explore tools — all context is provided above.
- Do NOT explore the project structure. Your CWD is the project root.
- Source files live under Source/PoF/.
- Include paths: same-directory → `#include "FileName.h"`, cross-directory → `#include "SubDir/FileName.h"` (relative to Source/PoF/).
- UBA error code 9666 is normal — those actions retry without UBA and succeed.
- ALWAYS verify the build compiles after creating or modifying C++ files using the build command above.
- Quote ALL paths containing spaces in shell commands.
- If the build fails, read the error, fix the code, and rebuild — do not give up.

## Known UE Pitfalls
- **a Runtime module touching FEditorDelegates/GEditor/FAssetTools must be #if WITH_EDITOR-guarded** — Editor-only symbols (FEditorDelegates, GEditor, FAssetTools) referenced from a Runtime module break the Shipping build. Guard them with #if WITH_EDITOR or move them to an Editor module. (vertical-slice: characters)
- **GAS: model damage as a server-only META attribute, apply via GameplayEffect, clamp in PostGameplayEffectExecute — never SetHealth directly** — Route ALL attribute changes through GameplayEffects (so prediction/stacking/calc work) — never call the attribute setter directly. Model damage as a meta attribute (server-only, not replicated): a GE adds to Damage; in PostGameplayEffectExecute, read Damage, reset it to 0, subtract from Health, and clamp Health to [0, MaxHealth] (clamp in PreAttributeChange too). Health/MaxHealth ARE replicated. (research: GAS in 20 minutes (Danny Goodayle))
- **GAS: replicated attributes need GAMEPLAYATTRIBUTE_REPNOTIFY in OnRep; Gameplay Cues are COSMETIC ONLY** — Each replicated attribute needs an OnRep_ that calls GAMEPLAYATTRIBUTE_REPNOTIFY(USet, Attribute) — without it the ASC never sees replicated value changes. Use the ATTRIBUTE_ACCESSORS macro set for the getter/setter/init. Gameplay Cues are for COSMETIC feedback only (VFX/SFX/shader), keyed by gameplay tag — never put gameplay logic in a cue. (research: GAS in 20 minutes (Danny Goodayle))
- **GAS: build an ability one coupled piece at a time (tag → input → effect → ability → grant/bind → cue), not the whole system in one shot** — A single GAS ability spans several tightly-coupled pieces — a Gameplay Tag, an Input Action + input-config mapping, one or more GameplayEffects, the UGameplayAbility subclass, ASC granting + input binding, and (cosmetic) Gameplay Cues. One-shotting an entire ability (or a multi-ability system) in one pass reliably yields partially-wired, non-activating results: an ability that is never granted, an input that never triggers it, or an effect that never applies — all of which compile 'clean' and fail silently at runtime. Author incrementally and verify each layer before adding the next: create the tag + input and confirm the binding fires; grant the ability and confirm it activates; add the effect and confirm the attribute actually changes; then layer cues/UI. Prefer many small, individually-verified steps over one large generation. (research: Aura the Unreal AI Agent (tryoura.dev))
- **Pick failure severity by consequence: cosmetic load failures warn-and-continue; gameplay-invariant violations hard-fail — and never fabricate the missing object to keep running** — When generated code handles a failed load or lookup, choose severity by what the failure breaks, not by habit. A COSMETIC asset that fails (a mesh, VFX, audio cue) should log a warning and continue — stopping everyone because pretty_tree_03 didn't load is wrong. A GAMEPLAY-INVARIANT violation must hard-fail fast (check(), UE_LOG Fatal, or ensure + early-return): the classic case is a locked door/gate actor failing to spawn — the dungeon behind it assumes quest state that 'cannot' be missing, so warn-and-continue surfaces days later as an inexplicable bug in unrelated code, downstream of the real cause. And never 'fix' a failure by fabricating the missing state (constructing an empty list/table/object so execution can proceed) — that converts a loud caller bug into silent corruption. (research: T. Cain code standards (WildStar/Outer Worlds notes))

## Task
Generate the C++ bundle for the ability "Fireball" (gameplay tag Ability.Fire.Fireball, Offensive/Fire/T2): its GameplayEffects AND the ability that applies them.

Canonical damage (authoritative, from the catalog entity): **35**. The primary damaging effect's Health modifier MUST equal `-35`; reconcile any spec drift to this value.

Effects to generate:
- "GE_FireballDamage" — DurationPolicy Instant; modifiers: Health += -35; ability cooldown 6s (NOT a GE Period — see the cooldown GE rule)

Activation tag rules to wire onto the ability:
- blocks "State.Dead" → ActivationBlockedTags

## Contract — Part A: GameplayEffects
1. READ FIRST for the project idiom — do NOT invent a new system:
   - `Source/PoF/AbilitySystem/Effects/GE_Heal.cpp` (instant additive), `GE_Regen_Health.cpp` (periodic duration), `GE_Stun.cpp` (granted tags) for the UGameplayEffect constructor patterns;
   - `Source/PoF/AbilitySystem/ARPGAttributeSet.h` for the real attributes and their `Get<Attr>Attribute()` accessors;
   - `Source/PoF/AbilitySystem/ARPGGameplayTags.h` for the natively-declared tags.
2. Write ONE `UGameplayEffect` subclass per effect into `Source/PoF/AbilitySystem/Effects/Generated/`. Name each `UGE_Gen_<AbilityName>_<EffectName>` (file `GE_Gen_<AbilityName>_<EffectName>.{h,cpp}`, both parts sanitized; include bare `GE_Gen_<…>.generated.h`). Additive — never edit hand-written `GE_*`.
3. Constructor: `DurationPolicy = EGameplayEffectDurationType::{Instant|HasDuration|Infinite}`; for HasDuration `DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)` (set `.Value`); for a period set `Period.Value =` and `bExecutePeriodicEffectOnApplication = false` (DoT tick, NOT ability cooldown). Each modifier → `FGameplayModifierInfo` with `.Attribute = UARPGAttributeSet::Get<Attr>Attribute()`, `.ModifierOp = EGameplayModOp::Additive` (`+=`) or `Multiplicitive` (`*=`), `.ModifierMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat)`; then `Modifiers.Add(...)`. Unknown attribute → `// TODO: unknown attribute` comment.
4. Granted tags (UE 5.7 component idiom — see `GE_Stun.cpp`): create a `UTargetTagsGameplayEffectComponent`, add it to `GEComponents`, and `SetAndApplyTargetTagChanges` an `FInheritedTagContainer`. Declared tags via native refs `ARPGGameplayTags::<Tag>`; an UNdeclared tag via `FGameplayTag::RequestGameplayTag(FName("<tag>"), /*ErrorIfNotFound*/ false)` guarded by `IsValid()` (skip if invalid) and record it in the tag delta.

## Contract — Part B: the wiring ability
5. READ `Source/PoF/AbilitySystem/ARPGGameplayAbility.h` (base: `ApplyEffectToSelf`/`ApplyEffectToTarget`, `bAutoEndAbility`, `AbilityManaCost`) and `Source/PoF/AbilitySystem/GA_WarCry.cpp` (the commit → apply-GE → end idiom).
6. Write ONE `UARPGGameplayAbility` subclass `UGA_Gen_<AbilityName>` (file `GA_Gen_<AbilityName>.{h,cpp}`) into `Source/PoF/AbilitySystem/Abilities/Generated/` (create the folder; additive — never touch hand-written `GA_*`).
7. Constructor: Set `AbilityManaCost = 20`. Set `bAutoEndAbility = true`. Wire the activation tag rules above — `blocks`→`ActivationBlockedTags`, `requires`→`ActivationRequiredTags`, `cancels`→`CancelAbilitiesWithTag` — using native refs `ARPGGameplayTags::<Tag>` for declared tags and the guarded `RequestGameplayTag(...,false)`+`IsValid()` pattern for undeclared ones (record those in the tag delta). Create a Cooldown GE `UGE_Gen_<AbilityName>_Cooldown` (HasDuration, `DurationMagnitude = FGameplayEffectModifierMagnitude(FScalableFloat(6f))`, granting the ability's cooldown tag) in `Effects/Generated/` and set it as the ability's `CooldownGameplayEffectClass`. Do NOT set `Period` on any damaging GE for this.
8. `ActivateAbility`: `CommitAbility` (on failure `EndAbility(Handle, ActorInfo, ActivationInfo, true, true)` and return); then apply each generated GE — DAMAGING effects (a modifier reducing Health) via `ApplyEffectToTarget(TargetASC, UGE_Gen_<AbilityName>_<EffectName>::StaticClass())`, BUFFS/HEALS via `ApplyEffectToSelf(...)`; if ambiguous default to target and comment. Finish with `EndAbility(Handle, ActorInfo, ActivationInfo, true, false)`.

## Contract — Part C: report + build
9. Write `Source/PoF/AbilitySystem/Effects/Generated/README.md` listing the GE + ability files, the attribute mapping, the tag→ActivationTags wiring, and the TAG DELTA — every granted/rule tag NOT declared in `ARPGGameplayTags.h` (do NOT auto-edit the tags header).
10. Build the PoF module (per the build command above; regenerate project files if new `.cpp` files require it). The headless build/editor exits non-zero on a benign shutdown crash — judge success by the newest `Saved/Logs/PoF*.log`, NOT the exit code.
11. Report: files written, attributes mapped, activation tags wired, and any missing tags.

## Contract — Part D: register in the data-driven catalog
12. Merge `Source/PoF/AbilitySystem/Effects/Generated/manifest.json` (create with `{ "abilities": [] }` if absent): upsert THIS ability keyed by `name` — `{ "name": "<AbilityName>", "gameplayTag": "<ability tag>", "abilityClass": "/Script/PoF.GA_Gen_<AbilityName>", "effectClasses": ["/Script/PoF.GE_Gen_<AbilityName>_<EffectName>", …] }`. Preserve any other abilities already in the file.
13. After the build succeeds, run `Content/Python/seed_generated_abilities.py` via the FULL editor headless — `& "<UnrealEditor-Cmd.exe>" "<the .uproject>" -run=pythonscript -script="<abs path to the script>" -unattended -nopause -abslog="<a log path>"`. It reads the manifest and writes `/Game/Abilities/Generated/DT_GeneratedAbilities`. Judge success by the log line `[seed_generated_abilities] Saved … N rows` (ignore a non-zero exit from the benign shutdown crash).
14. Report the manifest entry written and the row count the seeder saved.

## Submission

After completing your work, submit the results by outputting a JSON block wrapped in callback markers.

**Format:**
```
@@CALLBACK:cb-TEST
{
  "filesWritten": ["Source/PoF/AbilitySystem/Effects/Generated/GE_Gen_<...>.h", "..."],  // every file you created or merged
  "buildOk": true,          // did the PoF module build (judged from the newest Saved/Logs/PoF*.log, NOT the exit code)
  "seedRan": true,          // did seed_generated_abilities.py run headless
  "dataTableRows": 0,       // the N from the log line "[seed_generated_abilities] Saved … N rows"
  "missingTags": [],        // tags referenced but NOT declared in ARPGGameplayTags.h
  "reason": ""              // REQUIRED if anything above is false/0 — say exactly what failed
}
@@END_CALLBACK
```

The following fields will be added automatically — do NOT include them:
- `catalogId`: `"spellbook"`
- `entityId`: `"off-fire-01"`

**Rules:**
- Output valid JSON between the markers — no comments, no trailing commas
- The markers MUST appear on their own lines, exactly as shown
- The system will automatically submit this to the API — do NOT use curl
- You will see a confirmation message once the submission succeeds