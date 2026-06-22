# Dialog Trees Pipeline

> Catalog ID `dialog-trees` · Category Quests & Narrative · `dialogue-quests` module · 12 steps · Tracks: logic, art-2d, audio, test

**Purpose.** Authors a branching NPC conversation as a node/edge graph with conditions (flag checks, stat gates), effects (quest advance, world-state mutation), VO hooks, camera framing, subtitle/choice UI, and localization keys. Each tree is a `DT_DialogTrees` DataTable row read by `UARPGDialogComponent` on the NPC actor; on interact it loads the row keyed by entity id, evaluates node conditions against `UARPGAttributeSet` + Quest/World-state tags, and fires GameplayEvents that drive quest stage advances and world-state mutations. The app authors branches (app → UE via `seed_dialog_trees.py`) and validates, never re-authoring the UE dialog engine schema (canon proj-sot).

## Target / starter entity
- **Gatekeeper Greeting** (`dialog-gatekeeper`) — A gate-NPC opening conversation for Captain Vael. The player can greet, threaten, or attempt a Persuasion skill-check (Intelligence ≥ 14) that unlocks the Ember Pact quest branch. A HOSTILE terminal is reachable by threatening without passing the skill gate.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength('brief', ≥300)` |
| 2 | Branch Graph | graph | — | L0 · `graphValid('graph')` — branches reachable + terminals |
| 3 | Conditions & Effects | rules | `DA_GatekeeperGreeting_Effects` | L0 · `fieldsPopulated('conditionsEffects', [skillCheck, emberPactUnlocked, hostile, dismissed])` |
| 4 | Skill Checks | rules | `DA_GatekeeperGreeting_Effects` | L0 · `minCount('skillChecks', ≥1)` |
| 5 | VO Script | checklist | `SC_<s>_Vael*` VO cues | L0 · `minCount('voLines', ≥1)` |
| 6 | Camera | rules | `BP_DialogCameraRig_GatekeeperGreeting` | L0 · `fieldsPopulated('camera', [opening, vaelSpeaking, playerChoice, close])` |
| 7 | Subtitles & Choices UI | rules | — | L0 · `fieldsPopulated('subtitleUI', [subtitleWidget, choiceWidget, subtitleAnchor, choiceAnchor])` |
| 8 | Localization | checklist | — | L0 · `minCount('locKeys', ≥1)` |
| 9 | Accessibility | checklist | — | L0 · `minCount('a11yChecks', ≥1)` |
| 10 | Icon 2D Art | gallery | `T_<s>_DialogIcon` | L1 · `selected('selected')` |
| 11 | Test Gate | checklist | — | L3 · `runtimeDeferred('VSDialogBranchTest')` |
| 12 | UE Packaging | manifest | `DT_DialogTrees::<s>`, `DA_<s>_Effects`, `BP_DialogCameraRig_<s>`, `WBP_DialogSubtitle`, `WBP_DialogChoiceList`, `T_<s>_DialogIcon` | L0 · `minCount('assets', ≥3)` |

## UE wiring
- **C++ symbols:** `UARPGDialogComponent` (on `char-captain-vael`'s `AARPGNPCActor`; loads/evaluates the tree), `FARPGDialogTreeRow`, `FARPGDialogCondition` (e.g. `{stat:"Intelligence", op:"gte", value:14}`), `UARPGAttributeSet.Intelligence` (skill-gate source), `AARPGQuestComponent` (advances quest on EMBER_PACT_UNLOCKED).
- **DataTables / DataAssets:** `DT_DialogTrees` (row keyed by entity id), `DA_<s>_Effects` (node conditions + effect GameplayEvent references, `intelligenceGate = 14`).
- **GameplayEffects / Events:** `GE_WorldState_EmberPactIntroPlayed`, `GE_FactionDelta_AshenOrder` (SetByCaller −30); fires `Ability.Quest.EmberPact.Start` (success terminal) and `Ability.Faction.AshenOrder.HostileTriggered` (HOSTILE terminal).
- **Widgets:** `WBP_DialogSubtitle`, `WBP_DialogChoiceList` (owned by `UARPGDialogComponent`; class refs in ProjectSettings → ARPG → DialogWidgetClass), `BP_DialogCameraRig_<s>` + `ACineCameraActor_Dialog`.
- **Seed script:** `seed_dialog_trees.py`.
- **Runtime test:** `VSDialogBranchTest` (PIE — all 3 terminals reachable, Intelligence gate enforced, quest event fires, faction delta applied).
- **Cross-catalog links:** characters (`char-captain-vael` host), quests (`quest-ember-pact` advanced on success terminal), factions (`faction-ashen-order` rep −30 on HOSTILE), hud-elements (`hud-dialog-subtitle`, `hud-dialog-choices` presentation binding), icon-sets (`iconset-abilities` icon source).

## Acceptance profile
Tiers used: **L0** (data — brief/graph/rules/UI/loc/a11y/assets), **L1** (human selection — icon gallery), **L3** (runtime-deferred — `VSDialogBranchTest`). No L2 static checks or L4 visual gates. Config-complete means: brief ≥300 chars, the branch graph validates (11 nodes / 11 edges, all reachable from `greeting[0]`, ≥1 terminal), conditions/effects/skill-checks/camera/subtitle fields all populate, an icon is selected, and ≥3 UE dialog assets are packaged — branch reachability and skill-gate resolution deferred to PIE.

## Status & notes
12-step pipeline, the longest of the Quests & Narrative group, built around the `graph` archetype (step 2) — three terminals: DISMISSED (neutral), HOSTILE (threaten), EMBER_PACT_UNLOCKED (success, Intelligence ≥ 14). Obeys canon proj-sot (app validates, never re-authors UE dialog schema), proj-hud-binding (widget placement managed by the component), and art-icon-a11y (shape + color choices, AA contrast, scalable subtitle font). The tree is reused by `quests::quest-ember-pact` as its stage-1 accept dialogue. VO lines obey the ≤10-word-per-line cap (VO timing constraint). Bridge-driven runtime verification is deferred to `VSDialogBranchTest`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
