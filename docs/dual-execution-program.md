# Dual-Execution Program — progress handbook

> **Status 2026-07-23: 16 of ~31 pipelines reviewed.** This is the working handbook for the
> browser⇄UE dual-execution program: what exists, how a domain review runs, and how the
> remaining domains are grouped for PARALLEL sessions. Companion spec (the why + contract
> rules): `docs/research/dual-execution-preview-spec.md`. Live registry (the machine truth
> this doc summarizes): `src/lib/preview/realization-facts.json`, surfaced as B/U markers
> on `/status?tab=pipelines`.

## 1. The system in one paragraph

`pipeline_artifacts` (SQLite) is the engine-neutral SOR. Two runtimes realize it: the
**browser duel** (`C:\Users\kazda\kiro\saber-arpg`, three.js, served at :8123, hydrates via
CORS-open `GET /api/preview/hydrate?catalogId=`) and **UE 5.8** (`…\Documents\Unreal
Projects\PoF`, the FeatureLab map + code-as-data mirrors, gated by registered automation
tests drained through `/api/pipeline-artifacts/drain`). A domain review = author/verify the
catalog's artifacts → execute them in the browser (Playwright-verified) → execute/gate in UE
(log markers + rendered frames) → record honest `proven/probable/no` evidence per step in
the realization registry. **Nothing is claimed without runtime evidence** (see §5).

## 2. Key surfaces (where things live)

| Surface | Path | Role |
|---|---|---|
| Hydration contract | `src/lib/preview/browser-mirror.ts` | `PREVIEW_HYDRATABLE_CATALOGS` + `MECHANICS_STEPS` (append-only lists) |
| Preview API | `src/app/api/preview/{hydrate,tune,mirror-map}` | CORS read + graded tuning write + capability map |
| Realization registry | `src/lib/preview/realization-facts.json` + `realization.ts` | per-pipeline `browser/ue: proven·probable·no` + notes; drives /status B/U markers |
| Browser game | `saber-arpg/src/data/*.js` (one module per domain) + `ui/menu.js`, `ui/hud.js`, `main.js` | hydration modules + the pre-game shell (vendor / quests / crafting) |
| UE FeatureLab | `Source/PoF/World/PoFFeatureLabSubsystem.cpp` (+ `PoFDuelStaging`, `PoFDuelSelectionSubsystem`, `UI/PreGameMenuWidget`) | clean default map `/Game/Maps/FeatureLab`; ALL features spawn from the code-as-data roster at begin-play |
| UE gates | `Source/PoF/Test/**` + `entityRuntimeDeferred` accepts | per-entity automation names (`data.automationName`), drained via spawn executor |
| Audio pipeline | `POST /api/audio-gen` (elevenlabs) → `/api/audio-asset` | real generation + serving; UE import via `Content/Python/import_duel_audio.py` |

## 3. Reviewed pipelines (16) — the evidence in one line each

| # | Pipeline | Browser proof | UE proof |
|---|---|---|---|
| 1 | spellbook | Force Push + Fireball cast live from artifacts; graded tune round-trip | GAs match SOR numbers; DazeConfig gate |
| 2 | status-effects | Burning DoT ticks the authored 31.5 exactly; Dazed shamble | GE_Dazed + GE_Gen_Burning gated (own tests) |
| 3 | progression-curves | xpToNext exact (L50=4343 cross-check); persistent meta-loop | VSProgressionCurveTest pass |
| 4 | items | Loot drop → E-equip applies ×1.3 exactly; crafted components | packaging Tier-1 |
| 5 | loot-tables | 2000-roll distribution matches authored weights (80/15/5, 40/30/30) | (map tests deferred) |
| 6 | bestiary | Roster hydrates hp/speed (5.7/6.0/6.3) + melee mul | archetypes code-as-data + WIRED MoveSpeed; DuelArchetypesConfig gate |
| 7 | dialog-trees | Pre-combat overlay walks both branches; world frozen | same tree on UARPGDialogueTree; DuelIntroConfig gate; F-chain frame-proven via `interact` verb |
| 8 | currencies | Kill-drop faucet 35.44%/8.42 vs SOR 35%/8.40; display rule exact | WalletRules gate |
| 9 | vendors | Menu shop executes 1.1×Value pricing (500→126g); EQUIPPED persists | VSVendorTransactionTest pass |
| 10 | quests | Selection retints arena to the SOR hex; tracked + pays 250g exact | staging palettes mirrored (PoFDuelStaging) + frame-proven tint |
| 11 | hud-elements | HP-bar ladder executes the artifact (colors/thresholds/pulse/chevrons) | ⚠ Test_Inventory placement of VSHUDFunctionalTest fails PRE-EXISTING (bisect-proven); VerticalSlice placement passes |
| 12 | achievements | One-time guard + persistence + exact rewards; toasts | VSAchievementTest pass |
| 13 | crafting-recipes | Crystal+lens compose a saber; cost 335g exact; stats execute (10×1.2+5=17) | VSCraftingTest pass |
| 14 | icon-sets | Selected Icon 2D Art candidates render (real image or honest gradient) | VSIconSetAtlasTest pass |
| 15 | ambient | REAL ElevenLabs bed playing in `<audio>` | SoundWave imported + PLAYING at FeatureLab begin-play |
| 16 | music | Duel theme starts at DUEL!, stops at end | SoundWave imported; combat-state wiring pending |

## 4. The domain-review loop (the recipe every session follows)

1. **Ground-truth** the catalog: entities, steps, artifact shapes (`/api/pipeline-artifacts?catalogId=`).
2. **Author** missing duel-relevant artifacts through the graded POST (server re-grades; judge-owned
   fails are recorded, never fought). Seed new entities in `new-catalogs.ts` / `_shared/data.ts` when needed.
3. **Extend the contract**: append the catalog + its mechanics steps in `browser-mirror.ts`.
4. **Browser leg**: a new `saber-arpg/src/data/<domain>.js` hydration module + minimal game/menu wiring.
   Offline defaults must mirror the SOR. Verify with Playwright (state probes + screenshots + exact numbers).
5. **UE leg**: prefer draining an existing registered gate (set `data.automationName` per entity);
   code increments follow the code-as-data pattern (GetArchetypeDefaults / ARPGDuelIntroDialogue /
   PoFDuelStaging are the references) + a config gate + `-game` runtime markers/frames.
6. **Registry**: add the pipeline entry to `realization-facts.json` (honest proven/probable/no + evidence note).
7. **Commit per repo** (narrow adds — both shared trees carry foreign WIP).

## 5. Verification standards (non-negotiable, learned the hard way)

- **Config gates are not delivery.** Run the map headless (`-game` + `-abslog`, frames via
  `-RenderOffScreen`/scenario `show_inventory_ui`) and READ the output. Memory:
  `feedback_verify_runtime_outputs`.
- Boolean-key EI injection doesn't fire headless — use the ScenarioController `interact`/
  `activate_ability` event verbs; never claim key-driven UX from them (they bypass the binding).
- Widget C++ trees build in `Initialize()`, never `NativeConstruct` (Slate bakes first).
- Deferred-spawn when setting properties BeginPlay consumes (NPCID lesson).
- Synthetic `test-*` entities are filtered from every browser consumer.
- One gate name per ENTITY (`entityRuntimeDeferred`); the Fireball/Burning miswiring class is
  guard-tested (`entity-runtime-deferred.test.ts`).

## 6. Remaining domains — PARALLEL session groups

Grouped by **mutual affection** (shared browser modules / UE systems). Sessions in different
groups can run concurrently with low collision risk. **Shared hot files every group touches —
coordination rules below**: `browser-mirror.ts` (append one line), `realization-facts.json`
(add one JSON key), `saber-arpg/src/main.js` (one hydrate call + wiring), `new-catalogs.ts`
(seeds). Keep those edits minimal/append-only and commit early; everything else is disjoint.

### Group A — World & Arena (zone-map, combat-map, props, materials)
Touches: `saber-arpg/src/world/arena.js`, FeatureLab environment, UE maps/materials.
Shape: hydrate arena layout/encounter rules/prop placements/material params into the arena
build + FeatureLab roster entries. Natural outputs: SOR-driven pillar/obstacle layout
(combat-map), destructible crate prop, floor material params.

### Group B — Characters & Motion (characters, character-pipeline, player-movement, state-graph, vfx)
Touches: `rig.js`, `clips.js`, `animation/`, `fx/vfx.js`, UE anim/BP systems (ARDY chain).
Shape: named-character presentation (Vael/Malgrave visuals), movement-feel params from
player-movement, anim state graphs driving clip transitions, VFX specs into the pooled fx.
⚠ Heaviest UE overlap (anim quality program) — the known-weak domain; scope browser-first.

### Group C — Narrative & Meta (codex, factions, cutscenes, tutorial-beats)
Touches: `dialogUI.js`, `menu.js` (new sections), toasts, quest-like data modules.
Shape: codex entries unlocked by achievements/kills (menu subtree), faction reputation from
duel outcomes, a scripted intro cutscene (camera moves + dialog), tutorial beat prompts on
first actions. Mostly browser + config gates.

### Group D — Systems & Shell (save-points, screen-flow, input-schemes)
Touches: `main.js`/`input.js` persistence + flow, menu navigation.
Shape: formalize the localStorage persistence as the save-point contract (slots/checkpoint
semantics), screen-flow graph driving menu↔dialog↔duel↔end transitions (assert reachability),
input-schemes as the SOR for bindings — **pairs with resolving the F-binding struggle**
(memory: `project_featurelab_interact_binding`).

### Coordination rules for parallel runs
1. Claim a group; do not touch another group's browser modules or UE files.
2. Contract/registry/main.js edits: smallest possible append + commit immediately (merge-friendly).
3. UE builds serialize on the machine (UBT mutex) — stagger long builds; drains hold a lease already.
4. The registry is per-pipeline-keyed JSON — conflicts resolve by keeping both keys.

## 7. Open threads (not blocking, tracked)

- **F-key/interaction in UE**: hardware F → EI link unresolved; diagnostics in place (Group D).
- **Test_Inventory HUD placement red** (pre-existing, bisect-proven) — repair the placement.
- **UE polish**: blade glow material (flat stand-in today), duel-theme combat-state playback,
  PIE arena behavioral tests (launch→landing→daze observation), Fireball real icon (one
  Leonardo gen), UE quest tracking/rewards mirror.
- **Judge-owned fails**: many artifact rows carry strict-judge sub-90 verdicts; content-quality
  raising is a separate campaign (see `project_green_loop_campaign`).
