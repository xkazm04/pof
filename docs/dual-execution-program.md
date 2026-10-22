# Dual-Execution Program — progress handbook

> **Status 2026-10-22: 32 pipelines summarized below** (Groups A + B + C + D all
> landed — the registry holds 32). This is the working handbook for the
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

## 3. Reviewed pipelines (32) — the evidence in one line each

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
| 17 | combat-map | SOR courtyard executes: ±8.5 m pillars as obstacles + square wall clamp; fire-floor 15/1 s exact (probe lost exactly 45), grows 4→5.6 m on wave 2; kill-gated waves + Proximity Shield gating exact (400 pool, 5 m ally, suspend/re-engage/never-refill); loss resets both waves+hazard | VSArenaSetupTest headless pass; VSArenaSliceRulesTest scaffold pending |
| 18 | props | Reinforced Crate dual path: HOLD-E 0.8 s quiet open vs loud smash (noise pull → engage burst); 80 HP, damaged swap ≤40 exact; 1–2 staggered rolls, one-shot guard (open-then-smash = nothing); dangling lt-Brute repaired → lt-MeleeGrunt | VSPropInteractTest never registered (honest deferred) — UE follow-up |
| 19 | materials | Weathered-stone params execute on floor/pillars — #8a8378/0.82 and #7d766c/0.74 verified exact; master tint + RoughnessMultiplier mapping disclosed | MI_WeatheredStone + master .uassets exist; ArenaMasters gate unobserved |
| 20 | zone-map | Ashen Forest frame: areaLevel 5 → crate ilvl binding via the hostedArena cross-link (ilvl bands gate: 100% Iron Longsword at 5); fog-of-war minimap (44 m 1:1, 12 m reveal, POIs at SOR positions) | AshenForestSetupTest headless pass |
| 21 | save-points | Versioned autosave envelope replaces the scattered localStorage keys: v0→v1 legacy migration EXECUTES, newer-schema saves refused + write-locked (never clobbered — a real bug the suite caught), corruption→fresh, SOR-hydrated 10 s throttle, menu Slots-UI line (Playwright 11/11) | PoF.SavePoints.RoundTrip drained via spawn executor → L3 pass (field-for-field UARPGSaveGame round-trip) |
| 22 | screen-flow | screen-HUD's Navigation Graph (13 nodes/22 edges) is the shell-transition LAW: every executed transition validated against SOR edges (zero violations), save-conditioned Continue branch, death⇄respawn cycle, BFS reachability (Playwright 7/7) | VSScreenFlowTest already runtime-verified (z-order contract; graph traversal not covered — honest note) |
| 23 | input-schemes | NEW input-kbm entity authored from the duel's REAL scheme; SOR rebinds the live handlers (KeyF alt FIRED — data-driven, not a mirror); context stack (menu/dialogue) gates one-shots, pressed state cleared on switch (Playwright 8/8) | VSInputRebindTest pass; F-key root cause narrowed (BP controller IS the C++ child, no stale rebind save) → EnsureDefaultMappingContext from OnPossess + runtime key-map diagnostic; hardware F needs user PIE confirmation |
| 24 | factions | Ashen Order standing EARNS and PRICES: authored deltas execute per duel event (+25 kill / +50 rare-elite / +75 sparring win = exactly 175 a run), ladder derived from SOR thresholds with the inclusive seam proven (2999 Neutral vs 3000 Friendly), and the tier discount is the price charged — 352g list → 282g at Exalted (−20% exact); Hated closes the shop (Playwright 24/24) | VSFactionRepTest drained → L3 pass; AddRepPoints has no runtime consumer for these deltas |
| 25 | codex | The Sundering entry is HIDDEN until discovered, then its sealed span renders the authored redaction stamp — lock glyph + SOR amber #E0A867 (computed rgb(224,168,103)) — until the reveal swaps in the authored Order-facility conclusion; the SOR's own grammarCheck sentence holds in the page. Both grants keep the two-caller/one-guard shape, so the second caller is a genuine no-op and each sting plays once (Playwright 21/21) | VSCodexUnlockTest drained → L3 pass; DT_Codex + unlock/spoiler GEs unrealized |
| 26 | tutorial-beats | The dodge lesson RUNS on its authored numbers: 500 ms prompt, 700 ms wind-up, contact resolved against the roll's 300 ms i-frame window, 3500 ms window lapsing to retry, concede at attempt 3 (never a 4th, never a trap), 800 ms hold-to-skip (a 300 ms tap does not). All three terminals grant Introduced + persist, so the beat never re-arms; beat_started/attempt/completed/failed/skipped all emitted (Playwright 27/27) | VSTutorialComprehensionTest drained → L3 pass; BP_TutorialBeat unrealized |
| 27 | cutscenes | The prologue beat sheet PLAYS: 7 contiguous beats over the authored 90 s, markers fired at 20.4/38.0/58.4/72.2/82.3/90.0 s vs authored 20/38/58/72/82/90, camera staged per each shot note (incl. the authored HALF orbit, not a full one). A hold inside the 3 s grace is IGNORED not queued; a completed 0.5 s hold runs the SAME End path with unreached markers suppressed; skip and full watch converge; a watched prologue is bypassed (Playwright 27/27) | VSCutsceneTimingTest drained → L3 pass; LS_PrologueTheFall + UARPGCinematicComponent unrealized |
| 28 | state-graph | The authored 6-state FSM IS the Sith's spine — every band/timer parsed from the artifact, none duplicated in code: alert radius 800 cm latches the target and NoLOS 4 s clears it, IdleDwell 4 s → PATROL with real waypoint traversal, ATTACK enters ≤175 cm and leaves only past >250 cm (hysteresis holds in the gap), FLEE under 25% latched once per engagement for 6 s with BOTH authored exits walked, DEAD terminal; `State.AI.*` tags on the HUD (Playwright 30/30) | UARPGStateGraphRules + the runtime component had DRIFTED (flee .20, one 150 cm range, 5 s cooldown) → rewritten to the artifact's numbers; VSStateGraphTest now asserts every constant + a full component walk, headless pass |
| 29 | vfx | The authored Niagara system IS the pooled impact burst: 12+48+20 = 80 particles at LOD0, per-emitter lifetimes 0.18/0.6/0.9 s so it decays in stages, embers at 300–600 cm/s under −980 cm/s², and the LOD table band-for-band with UE **including the edges** (15 m → LOD1, 35 m still LOD1, 36 m culls); LOD1 halves the spawn, LOD2 skips the burst entirely (Playwright 34/34) | VSVFXPerfTest re-run headless — it asserts the same six boundary cases the browser now mirrors |
| 30 | player-movement | The asset steps stay editor-Python, but the FEEL they tune is now dual-executed: walk 6.0 / sprint 9.0 m/s over SprintSpeedInterpTime, AccelerationFromIdle 40.96, Braking 24, RotationRate 720→360 deg/s, stamina drain 20/s (32 over 1.6 s) + regen 15/s + empty bar cannot sustain a sprint, and the roll's i-frames are the **AM_Roll notify window** (hit at 0.033 s lands, 0.133 s ignored, 0.300 s lands) — closing a real 0.40 s vs 0.133 s divergence (Playwright 26/26) | Values mirror AARPGCharacterBase CDO + the player_movement constants (cited in the artifact); Playable Gate is L4 and still needs a live editor |
| 31 | characters | A named row is an INDIVIDUAL, not a second balance surface: `char-darth-malgrave` seeded thin on numbers and single-sourcing bestiary-sith-lord. His identity/outfit execute on the live boss — robe #1a1016 (hood follows), trim #7a1020, blade #ff2a2a — while hp/damage/speed stay the archetype's (50 / 12 / 600 cm/s, cross-checked); an unauthored roster member is left untouched (Playwright 24/24) | PoF.CharacterVael.NPCConfig re-run headless (Result=Success); Malgrave himself is honestly ungated |
| 32 | character-pipeline | ⚠ Config-complete only — NOT browser-proven. Both shape gaps closed (Game-Tier Convert's faceLimit/textureSize/sizeMB, UE Import's three Interchange `created` paths), so the Jinx row is fully graded. The real mesh exists (`bestof_fg095.glb`) but was NOT observed rendering: the duel vendors no glTF loader, and the `/layout` GlbViewer path was blocked by the asset-route outage in §7 — recorded `probable` (2026-07-23; reconciled 2026-10-22, §7.1 card R32), never claimed | UE imports were performed on the standalone jinx project, not re-verified here; Visual Gate correctly deferred |

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

### Group A — World & Arena (zone-map, combat-map, props, materials) — ✅ DONE 2026-07-23
Landed (rows 17–20 above): SOR courtyard layout + fire-floor + waves/shield + win-loss
(`combatmap.js`/`hazard.js`), destructible crate (`propspec.js`/`crates.js`), stone material
params (`materialspec.js`), zone frame + minimap (`zonemap.js`/`minimap.js`). Loot hydration
now parses the full base-selection model (bases + ilvl bands). UE follow-ups in §7.

### Group B — Characters & Motion — ✅ COMPLETE 2026-07-23 (rows 28–32 above)
Landed: state-graph (`data/stategraph.js` — the authored FSM became the Sith's decision
spine in `ai/brain.js`, with `State.AI.*` tags surfaced on the HUD), vfx (`data/vfxspec.js`
driving the pooled burst in `fx/vfx.js`), player-movement (`data/movement.js` feeding the
shared `CharacterBase` — sprint/stamina added, i-frames corrected), characters
(`data/characters.js` + additive material handles on `rig.js`). character-pipeline is
config-complete but honestly NOT browser-proven (row 32).

**Lesson — the code-as-data mirror rots silently.** Two UE rule libraries existed precisely
so the runtime and the gate would share one truth (`UARPGStateGraphRules`,
`UARPGVFXLodRules`), and one of them had drifted from its artifact: flee 0.20 vs the
authored 0.25, a single 150 cm attack range where the artifact authors a 175/250 hysteresis
band, a 5 s alert cooldown vs a 4 s idle dwell. Nothing was red — the gate asserted the
stale constants, so it passed. Mirroring a number into code is not the same as *binding* to
it: when a review finds a rule library, diff its constants against the artifact before
trusting either side, and make the gate assert the authored values by name so the next
drift fails loudly.

**Lesson — offline defaults can fake a green suite.** Every hydration module mirrors its
artifact offline (the contract requires it), which means a value-for-value check passes
*identically* whether hydration ran or silently 404'd. Two of these suites "passed" their
whole number block while `live` was false. Gate every browser suite on the live flag (and
the entity id) before asserting any value.

### Group C — Narrative & Meta — ✅ COMPLETE 2026-07-23 (rows 24–27 above)
Landed: factions (`data/factions.js` — standing ladder + rep deltas, and the tier discount
wired into `data/vendor.js` so it is the price actually charged), codex (`data/codex.js` +
`ui/codexUI.js` reader with the redaction/reveal span swap, plus two synthesized stings in
`audio/sound.js`), tutorial-beats (`data/tutorial.js` — the dodge lesson state machine driven
from the main loop's sandbox), cutscenes (`data/cutscene.js` + `ui/cutsceneUI.js` — the
prologue sequence, letterbox and hold-to-skip, with `hud.setCinematic()` suppressing the HUD).
All four UE gates were already registered and drained; the browser leg was the missing half.

**Lesson for later groups — clock domains.** Anything the SOR states in milliseconds as a
*UX* timing (a wind-up, an attempt window, a hold-to-skip, a cutscene timecode) must run on
REAL elapsed time, not the sim `dt`. The loop clamps `dt` to 50 ms, so on a frame-starved
renderer sim time drifts to ~half wall-clock and every authored millisecond silently
stretches — which is how the first tutorial run "failed" a correct 800 ms hold.

### Group D — Systems & Shell — ✅ COMPLETE 2026-07-23 (rows 21–23 above)
save-points (`data/save.js` envelope + sections), screen-flow (`data/screenflow.js`
tracker), input-schemes (`data/inputscheme.js` + SOR-rebindable `core/input.js`).
F-binding: SOLVED + hardware-CONFIRMED (user pressed F in PIE, 2026-07-23). Root cause:
`IMC_VerticalSlice` (the BP's DefaultMappingContext override) had no Interact mapping at all;
`EnsureDefaultMappingContext` self-heals it (F → the bound IA_Interact). Durable follow-up:
author the mapping into the IMC asset itself.

### Coordination rules for parallel runs
1. Claim a group; do not touch another group's browser modules or UE files.
2. Contract/registry/main.js edits: smallest possible append + commit immediately (merge-friendly).
3. UE builds serialize on the machine (UBT mutex) — stagger long builds; drains hold a lease already.
4. The registry is per-pipeline-keyed JSON — conflicts resolve by keeping both keys.

## 7. Open threads (not blocking, tracked)

- **Test_Inventory placements — REPAIRED 2026-07-23**: the shared-PIE-world root cause
  (map enemies dead by run time) is fixed by own-fixture spawns + CleanUp in
  VSHUDFunctionalTest / VSCombatGrayBoxPathTest / VSFunctionalTest (pof-exp `03b3baa`);
  HUD + GrayBoxPath now PASS there. Remaining: the Test_Inventory placement of the
  full-slice VSFunctionalTest fails that map's LAYOUT (movement path blocked, no loot
  spawner) — home VerticalSlice placement is green; decide whether that duplicate
  placement should exist at all.
- **UE polish**: blade glow material (flat stand-in today), duel-theme combat-state playback,
  PIE arena behavioral tests (launch→landing→daze observation), Fireball real icon (one
  Leonardo gen), UE quest tracking/rewards mirror.
- **Group A UE gates**: `VSPropInteractTest` (crate actor + dual-path runtime) and
  `PoF.Materials.ArenaMasters` (MI parameter assertions) are named but never registered/run;
  `VSArenaSliceRulesTest` (waves + hazard ticks + shield at runtime) is scaffold-only.
  The browser leg proved the mechanics; these gates are the UE-side completion.
  → triaged 2026-10-22, one card per gate in §7.1 (A1–A3).
- **Group C UE consumers**: all four gates pass, but the runtime consumers behind them are
  unrealized — `UARPGFactionSubsystem::AddRepPoints` has no caller for the authored duel
  deltas, `DT_Codex` + the unlock/spoiler GEs are unseeded, `BP_TutorialBeat_LearntoDodge`
  does not exist, and `LS_PrologueTheFall` / `UARPGCinematicComponent` are unbuilt. The
  browser leg proved every mechanic; these are the UE-side halves.
  → triaged 2026-10-22, one card per consumer in §7.1 (C1–C4).
- **Dodge i-frame canon — RESOLVED 2026-07-23**: player-movement's AM_Roll DodgeWindow
  notify (66.7 ms onset, 133 ms) is canon (its artifact says "authoritative"); 300 ms is
  the fallback cap only. tutorial-dodge artifacts now cite it (Success/Skip/Fail flipped
  fail→pass on coherence; gate re-drained to pass) and the browser lesson trains the
  same [66.7, 200] ms window the duel executes.
- **Generated-asset route is down (dev-server state, diagnosis CONFIRMED)**: the 500 body
  shows `Jest worker encountered 2 child process exceptions` — Next's compiler worker pool
  crashed (likely under the 4-parallel-session load). Fix = restart the :3001 dev server,
  then re-verify `/api/visual-gen/asset/*` and finish the character-pipeline browser proof.
- **Group B UE consumers**: `UARPGStateTreeAIComponent` now walks the authored graph and is
  gate-covered, but no in-map enemy runs it yet (the duel's FSM proof is browser-side);
  Malgrave has no gate of his own; and `player-movement`'s Playable Gate (L4) still needs a
  live editor + PIE to run.
  → the in-map StateTree enemy is triaged 2026-10-22 in §7.1 (B1); Malgrave's gate and the
  Playable Gate were outside that triage's scope and stay open as written here.
- **Group C persistence — FOLDED 2026-07-23**: factions/codex/tutorial/cutscene are
  envelope sections now (schema v2, additive no-op migration + straggler sweep for v1
  envelopes coexisting with later legacy keys; Playwright 13/13).
- **Cutscene gallery replay unbuilt**: the Skip / Replay Rules step authors a Main Menu →
  Gallery replay in a dedicated preview map with all world-state mutations suppressed; the
  browser realizes the skip half only.
- **Judge-owned fails**: many artifact rows carry strict-judge sub-90 verdicts; content-quality
  raising is a separate campaign (see `project_green_loop_campaign`).

### 7.1 Triage cards — 2026-10-22 (milestone 4, dual-execution review)

One card per open UE-side item so a later session can close them one at a time. The
session that wrote these had **no UE project tree** to read (see `[UE]` below). Every verdict is either
UE-GATED (it names what is missing) or DROPPED (only where the repo shows the mechanic is
covered elsewhere). Nothing here claims a UE pass, a registration or a render that was not
observed. Evidence comes from read-only `git grep` over the whole repo (src/, docs/, e2e/,
scripts/, shots/) plus `src/lib/preview/realization-facts.json`.

**Shared blockers (2026-10-22), named once and cited by each card as `[UE]` / `[BROWSER]`:**
- `[UE]`: the UE project at `…\Documents\Unreal Projects\PoF` does not exist on this machine
  (verified absent again 2026-10-22, most likely because of the ~2026-10-19 machine reset), so
  none of its `Source/PoF/**` is readable and no gate can be registered, run or drained from
  here. This is the blocker that actually stands.
  *Retraction:* the earlier text of this bullet claimed the machine's ARM64 architecture
  meant no live editor + PIE was available. That 2026-10-22 claim was refuted the same day by
  `scripts/diablo/ue_arm_probe.ts` (`docs/research/diablo/Findings.md` F-G2-4, fleet-memory
  2026-10-22 `[ue] DECISION`), which measured a passing C++ editor-target build, a passing
  headless `-run=pythonscript` run and a passing D3D12 init on this device.
  *Surviving caveat:* every compile here is emulated x64 (no native ARM64 UBT host), measured
  on a partial install, so build times are a floor, and nothing about PIE-driven automation on
  this device has been observed yet.
- `[BROWSER]`: `C:\Users\kazda\kiro\saber-arpg` is also absent on this machine, so the browser
  proofs below are the 2026-07-23 recorded runs. They were not re-run on 2026-10-22.

#### Group A: named-but-unregistered UE gates

- **A1 · `VSPropInteractTest` (props Test Gate): UE-GATED.** *Real state: named only.* The repo
  carries the name in `src/lib/catalog/pipelines/props.ts` (the `runtimeDeferred` accept plus the
  L3 verification strings), `docs/features/props/README.md`, and step-facts (a "static constant
  deferred result, never executed"). There is also a synthetic fixture header in
  `src/__tests__/lib/ue-automation/reachability.test.ts`, which proves nothing about the UE tree.
  No registration and no result marker exist in the repo. e2e/ and scripts/ have no reference.
  *Browser leg:* proven per §3 row 18 (HOLD-E 0.8 s open vs. loud smash, 80 HP / ≤40 damaged swap,
  one-shot loot guard; realization-facts `props.Interaction` = browser proven). *Still needed UE-side:*
  the crate actor (`AARPGDestructibleActor`-based; realization-facts says "the crate actor is
  unbuilt"), the test class registered in `Source/PoF/Test/**`, a PIE run, and a drain to L3.
  *Blocker:* `[UE]`. Not DROPPED: no other registered gate covers the crate's dual path.
- **A2 · `PoF.Materials.ArenaMasters` (materials Test Gate): UE-GATED.** *Real state: named. A
  run is claimed once, but the repo holds no result.* The name is the `entityRuntimeDeferred`
  accept in `src/lib/catalog/pipelines/materials.ts`. The header of `shots/parameterize_arena_materials.py`
  says a 2026-07-07 run of this gate found zero scalar/vector/texture params on the three
  masters. That comment is the only trace of an execution. realization-facts `materials.Test Gate`
  records "no per-test result marker (honest unobserved)", so this card treats the gate as
  registration-unverified, not as registered. *Browser leg:* proven per §3 row 19
  (#8a8378/0.82 and #7d766c/0.74 exact; `materials.Parameters` = browser proven). *Still needed
  UE-side:* confirm the test is registered in the UE tree, run it against `MI_WeatheredStone` + the
  parameterized masters, and drain a result marker. *Blocker:* `[UE]`.
- **A3 · `VSArenaSliceRulesTest` (combat-map Test Gate, the fuller one): UE-GATED.** *Real state:
  named only from this repo's view.* The name appears in `src/lib/catalog/pipelines/combat-map.ts`
  and `docs/features/combat-map/README.md`. §3 row 17 and realization-facts call it a "scaffold",
  but no scaffold lives in this repo (`src/lib/ue-test-scaffold/generate.ts` does not name it),
  and the UE tree that would hold one is unreadable (`[UE]`). The narrower `VSArenaSetupTest`
  passed and was drained, but it covers geometry/lighting/collision only. step-facts says so
  explicitly, so it does NOT cover waves, hazard ticks or the shield, and DROPPED is not
  supported. *Browser leg:* proven per §3 row 17 (waves + Proximity Shield gating, fire-floor
  15/1 s, win/loss reset). *Still needed UE-side:* author or finish the test (an `ASpawnVolume`
  built from the spec, both waves in order, `OnAllWavesComplete`, hazard ticks, the win/loss
  delegates), register it, run it in PIE, and drain it. *Blocker:* `[UE]`.

#### Group B / C: unrealized runtime consumers behind passing gates

- **C1 · faction rep deltas → `UARPGFactionSubsystem::AddRepPoints`: UE-GATED.** *Browser leg:*
  proven per §3 row 24 (+25 kill / +50 rare-elite / +75 sparring win = 175 a run; tier discount
  charged). `VSFactionRepTest` drained to L3 pass (2026-07-23). *Still needed UE-side:* a
  gameplay caller (the kill-credit / sparring-win events) that invokes `AddRepPoints` with the
  authored deltas, then a runtime observation of the rep total and tier changing in-map. §3
  row 24 records that `AddRepPoints` has no runtime consumer for these deltas, and the repo holds
  nothing that shows otherwise. *Blocker:* `[UE]`.
- **C2 · `DT_Codex` + `GE_Codex_Unlock_*` / `GE_Codex_Spoiler_*`: UE-GATED.** *Browser leg:*
  proven per §3 row 25 (hidden-until-discovered, redaction stamp #E0A867, reveal swap,
  two-caller/one-guard grants). `VSCodexUnlockTest` drained to L3 pass. *Still needed UE-side:*
  seed the `DT_Codex` row (`seed_codex.py`), create the unlock and spoiler GEs, and observe
  `UARPGCodexComponent` reveal the entry at runtime. *Blocker:* `[UE]`, because seeding a
  DataTable and authoring GEs needs the PoF project, which is absent here.
- **C3 · `BP_TutorialBeat_LearntoDodge`: UE-GATED.** *Browser leg:* proven per §3 row 26
  (500/700 ms timings, i-frame contact, concede at attempt 3, 800 ms hold-to-skip, never
  re-arms). `VSTutorialComprehensionTest` drained to L3 pass. *Still needed UE-side:* the
  Blueprint actor (BeginBeat via `AARPGTriggerBox`, `UARPGInputSandboxSubsystem::LockInputs`,
  WaitGameplayTagAdded stepping), placed in a map and walked in PIE. *Blocker:* `[UE]`, because
  a Blueprint asset can only be authored in the editor, and the PoF project it opens is absent here.
- **C4 · `LS_PrologueTheFall` + `UARPGCinematicComponent`: UE-GATED.** *Browser leg:* proven per
  §3 row 27 (7 beats over 90 s, markers within 0.4 s of authored, grace/hold-to-skip,
  watched-bypass). `VSCutsceneTimingTest` drained to L3 pass. *Still needed UE-side:* the C++
  component (`PlayCutscene` / `SkipCutscene` / `NotifyBeat`), the LevelSequence asset with its
  EventTrack bound to `NotifyBeat`, and a runtime observation of the markers firing. *Blocker:*
  `[UE]`.
- **B1 · in-map enemy running `UARPGStateTreeAIComponent`: UE-GATED.** *Browser leg:* proven per
  §3 row 28 (the authored 6-state FSM drives the Sith; 800 cm alert, 175/250 cm hysteresis,
  flee <25 %). `VSStateGraphTest` asserts every constant plus a component walk (headless pass).
  *Still needed UE-side:* an enemy placed in FeatureLab/VerticalSlice that actually owns and
  ticks the component, and a `-game` run whose log markers or frames show the state
  transitions. *Blocker:* `[UE]`.

- **2026-10-22, what the probe changes:** once the PoF UE project is restored on this machine, registering and draining these gates is no longer hardware-blocked, only project-blocked. No gate above was registered, run or drained by this correction.

#### Row 32 reconcile

- **R32 · character-pipeline: already closed as `probable`, NOT upgraded.** The §3 row already
  names the blocker (the asset-route outage in §7, plus no glTF loader in the duel), and
  realization-facts `character-pipeline` (reviewedAt 2026-07-23) holds no `proven` browser
  claim. This reconcile added the dates and this pointer to the row. The row stays `probable`
  until a runtime observation shows `bestof_fg095.glb` rendering. *Blocker today:* `[BROWSER]`
  for the duel path, and the `/layout` GlbViewer path still needs the asset-route
  re-verification described in §7. That re-verification was not performed on 2026-10-22.

**realization-facts.json:** left untouched. All 32 §3 pipelines already have an entry, and no
§3 browser or UE proof is missing from the registry.
