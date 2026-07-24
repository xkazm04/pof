# Dual-Execution Program — progress handbook

> **Status 2026-07-23: 32 of ~31 pipelines summarized below** (Groups A + B + C + D all
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

## 3. Reviewed pipelines (27) — the evidence in one line each

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
| 32 | character-pipeline | ⚠ Config-complete only — NOT browser-proven. Both shape gaps closed (Game-Tier Convert's faceLimit/textureSize/sizeMB, UE Import's three Interchange `created` paths), so the Jinx row is fully graded. The real mesh exists (`bestof_fg095.glb`) but was NOT observed rendering: the duel vendors no glTF loader, and the `/layout` GlbViewer path was blocked by the asset-route outage in §7 — recorded `probable`, never claimed | UE imports were performed on the standalone jinx project, not re-verified here; Visual Gate correctly deferred |

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
- **Group C UE consumers**: all four gates pass, but the runtime consumers behind them are
  unrealized — `UARPGFactionSubsystem::AddRepPoints` has no caller for the authored duel
  deltas, `DT_Codex` + the unlock/spoiler GEs are unseeded, `BP_TutorialBeat_LearntoDodge`
  does not exist, and `LS_PrologueTheFall` / `UARPGCinematicComponent` are unbuilt. The
  browser leg proved every mechanic; these are the UE-side halves.
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
- **Group C persistence — FOLDED 2026-07-23**: factions/codex/tutorial/cutscene are
  envelope sections now (schema v2, additive no-op migration + straggler sweep for v1
  envelopes coexisting with later legacy keys; Playwright 13/13).
- **Cutscene gallery replay unbuilt**: the Skip / Replay Rules step authors a Main Menu →
  Gallery replay in a dedicated preview map with all world-state mutations suppressed; the
  browser realizes the skip half only.
- **Judge-owned fails**: many artifact rows carry strict-judge sub-90 verdicts; content-quality
  raising is a separate campaign (see `project_green_loop_campaign`).
