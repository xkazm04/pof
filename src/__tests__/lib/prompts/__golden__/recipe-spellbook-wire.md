## Project Context
- Project: "PoF" at C:/proj/PoF
- UE Version: 5.7
- Module: PoF | API export macro: POF_API
- Source root: Source/PoF/
- Engine: C:\Program Files\Epic Games\UE_5.7
- Required MSVC toolchain: 14.44+

## Build Command
"C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\DotNET\UnrealBuildTool\UnrealBuildTool.exe" PoFEditor Win64 Development "-Project=C:/proj/PoF\PoF.uproject" -WaitMutex

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
- **verify unreal.* API names by introspection before calling — never guess** — Guessed unreal.* class/method/property names fail silently (return None/false) or crash the pythonscript commandlet, and each wrong guess burns tokens on retries. Before calling an unfamiliar API, confirm it exists and check its signature: use mcp-unreal lookup_class / lookup_docs / subsystem_query, or `dir(unreal.X)`, `help(unreal.X.method)`, and `unreal.X.__doc__` inside execute_script. Prefer EditorSubsystem getters (unreal.get_editor_subsystem(...)) over deprecated global helpers. (research: Claude-in-UE5 demo (Stefan 3D AI) + VibeUE introspection)
- **GAS: build an ability one coupled piece at a time (tag → input → effect → ability → grant/bind → cue), not the whole system in one shot** — A single GAS ability spans several tightly-coupled pieces — a Gameplay Tag, an Input Action + input-config mapping, one or more GameplayEffects, the UGameplayAbility subclass, ASC granting + input binding, and (cosmetic) Gameplay Cues. One-shotting an entire ability (or a multi-ability system) in one pass reliably yields partially-wired, non-activating results: an ability that is never granted, an input that never triggers it, or an effect that never applies — all of which compile 'clean' and fail silently at runtime. Author incrementally and verify each layer before adding the next: create the tag + input and confirm the binding fires; grant the ability and confirm it activates; add the effect and confirm the attribute actually changes; then layer cues/UI. Prefer many small, individually-verified steps over one large generation. (research: Aura the Unreal AI Agent (tryoura.dev))

## Binary Content Wall
These asset types CANNOT be authored from Python or text — they require the editor's graph/asset tooling:
- Widget Blueprint (WBP) — UMG visual tree; a BindWidget C++ base still needs the WBP
- Animation Blueprint (ABP) — AnimGraph / state machine
- Level (.umap) — placed actors, lighting, navigation
- Behavior Tree graph — task/decorator/service wiring
- Material Function graph — node network
- Skeletal mesh / skeleton — rig and bind pose
If your solution depends on one of these, declare it in Wiring Requirements and prefer a pure-C++ pattern where one exists (e.g. build the Slate tree in RebuildWidget instead of a WBP).

You are a senior systems designer at a AAA action-RPG studio producing a shippable asset for the
spellbook catalog. The professional bar is: the design-doc craft of Path of Exile 2 / Diablo IV / Last Epoch systems writing.
This will be reviewed against these exact craft dimensions — meet the professional bar on each:
  - coherence: internally consistent and consistent with sibling steps — no contradictions, no invented references
  - specificity: concrete, numeric, named — zero filler or generic-fantasy boilerplate
  - voice: a distinctive, confident design voice; reads like a senior designer wrote it, not a template
  - completeness: every field a real implementation would need is present and load-bearing
  - plausibility: the values would actually ship — balanced, buildable, grounded in the ARPG laws
Hard constraints:
  - no filler or generic-fantasy boilerplate
  - no placeholder/TODO values
  - no contradictions with sibling steps
Author it as a STRUCTURED design doc, not a prose blurb — every field load-bearing. To reach the bar:
  - Single source of truth: every number appears once; derive dependent values with the arithmetic SHOWN
    (a worked chain a reader can reproduce on a calculator). Forward-derive headline numbers from primitives —
    never reverse-engineer a figure to hit a target (the judge catches contradictions with your own inputs).
  - Sibling-sourced: cross-reference the entity's OTHER steps by their real values (ids, prices, stats, labels);
    contradicting a sibling is an automatic coherence failure. Add a crossReferences / statHooks block.
  - Prove hard cases INLINE, don't assert them (worked math, ICU plural/gender arms, edge cases, state machines).
  - Scope depth to the subject: a baseline Common is scoped DOWN (it's the zero-point), a boss scoped up.
  - Disclose your own discontinuities/edge cases precisely — that scores higher than claiming false airtightness.
  - Refuse vaporware: author real inline content, not promissory "TBD"/catalog-link stubs.
  - Declarative voice. NO meta-commentary defending your numbers; NO raw engine tokens/enums leaking into prose.
Aim for work that could ship as-is in the reference games — not merely technically correct.

## Domain Context
Gameplay Ability System (GAS) authoring for the PoF ARPG.

## Task: Spellbook · wire

Wire "Fireball" so it activates in-game: grant it on the player's DefaultAbilities and bind its input/tag (`Ability.Fire.Fireball`). Set class-pointer props on the placed instance, not only the CDO.

## Asset Specification

- **id**: `ga-fireball`
- **name**: Fireball
- **category**: Offensive ▸ Fire
- **tags**: basic

```json
{
  "id": "off-fire-01",
  "name": "Fireball",
  "category": "Offensive",
  "element": "Fire",
  "tier": "basic",
  "damage": 35,
  "manaCost": 20,
  "cooldown": 3,
  "radar": [
    0.7,
    0.85,
    0.3,
    0.5,
    0.5
  ],
  "description": "Hurl a ball of fire",
  "color": "#f00",
  "tag": "Ability.Fire.Fireball"
}
```

## Wiring Requirements
For EVERY artifact you generate, make it runnable out-of-the-box — do not stop at "it compiles":
- **Granting / registration**: state how the artifact is granted or registered (ability granted to the ASC, GameMode class set, IMC added to the input subsystem, component added to the actor).
- **Activation**: state what triggers it at runtime (input action, gameplay event, BeginPlay, overlap).
- **Dependencies**: list the companion assets it needs and FLAG any binary-content dependency (Widget/Animation Blueprint, Behavior Tree, .umap) that cannot be authored from code.
- **Verification**: give ONE observable check that proves the wiring works (a log line, an on-screen value, a functional-test assertion).
In your output, include a `wiring` field for each generated artifact summarizing the four points above.

Known wiring for this task:
| Artifact | Granted by | Activated by | Dependencies | Verify |
| --- | --- | --- | --- | --- |
| Effect Logic · effect | UAbilitySystemComponent::GiveAbility grants GA_Fireball during AARPGCharacterBase::InitAbilitySystemComponent, with its slot assigned from DT_GeneratedAbilities | THIS ability’s declared Enhanced Input action calls UARPGAbilityInputComponent::TryActivateAbilityByTag; AI users pass GA_Fireball through BTTask_UseAbility | UARPGAttributeSet attributes consumed or modified by THIS ability, ARPGDamageExecution when THIS ability deals damage, status-effects::<id> for each status THIS ability applies, vfx::<id> for each effect THIS ability triggers | L2: GA_Fireball compiles in Source/PoF/Abilities/ and its DT_GeneratedAbilities row is seeded; L3: THIS ability’s functional test verifies activation, costs, effects, cooldown, and every declared dependency |
| UE Packaging | UAbilitySystemComponent::GiveAbility grants GA_Fireball during AARPGCharacterBase::InitAbilitySystemComponent, with data-driven slot assignment from DT_GeneratedAbilities | THIS ability’s declared input action or AI BTTask_UseAbility activates GA_Fireball when its declared targeting, resource, and cooldown conditions pass | UARPGAttributeSet attributes consumed or modified by THIS ability, ARPGDamageExecution when THIS ability deals damage, status-effects::<id> for each status THIS ability applies, vfx::<id> for each effect THIS ability triggers, icon-sets::<id> for THIS ability’s icon family | L2: GA_Fireball, FARPGAbilityCatalogRow, and the Source/PoF/ ability framework compile and the DT_GeneratedAbilities row is seeded; L3: THIS ability’s functional test verifies its declared activation path, costs, effect… |

## UE5 Best Practices
- The ability MUST extend `UARPGGameplayAbility` (include "AbilitySystem/ARPGGameplayAbility.h").
- Constructor sets SetAssetTags, ActivationOwnedTags, ActivationBlockedTags, AbilityManaCost, CooldownGameplayEffectClass, AbilityCooldownTag.
- `State.Dead` and `State.Stunned` are always in ActivationBlockedTags.
- Use SetByCaller `Data.Damage.Base` for damage, not hardcoded GameplayEffect magnitudes.
- Gray-box first: if the montage is empty, drive damage with a WaitDelay fallback window (the GA_MeleeAttack pattern) so the gameplay still lands.
- CDO-vs-instance: set class-pointer props on the placed instance, not only the CDO.