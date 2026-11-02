# GTAI: Uprising (public title: RTAI: Uprising): campaign state

The living memory of the dual GTAI + PoF campaign. `/gta` reads this file first and writes it last.
Design truth is in `pitch.md`; this file is *where we are*.

## Now

- **Phase 1: Look and engine is DONE (2026-11-02):** Trivet look, Godot 4.7.2. **Phase 2 is next**, with two workstreams first: (1) the one-day 2D cutout test on Rivet and King, then (2) the city-scale gate.
- **Phase 1 (history): Look and engine.**
  - **Exit criterion:** the engine locked in `src/lib/games/gtai.ts`, based on the overnight spike's scoreboard plus the owner's play-test.
  - Look and camera are locked: **Trivet** (V1 DEAD INK, 90 degrees overhead), 2026-11-01.
- **Pre-check done** (19:05 to 19:58, $22.06, all billed to the API key). **No blockers on any engine.** Each engine lane rated its confidence of a runnable Windows build by morning at 5/5; one already exists in each. Reports: `C:\Users\kazda\kiro\gtai-spike\lanes\*\PRECHECK.md`.
- **Next steps**
  1. **The night is running** (launched 20:06; it freezes at 06:45, reports at 07:15 and ends at 08:00). Engine lanes run Opus 5.5 at high effort; the art lane runs Sonnet 5.5 (owner). All lanes bill the API key first. Check it anytime with `node games/gtai/spike/spike.mjs status`. Keep Unity Hub open.
  2. Morning (`/gta morning`): run the report, review the evidence, have the owner play-test, lock the engine. Then do Phase 2 planning.
- **Quest loop ready (2026-11-02): `/gta --quest [act] [goal]`.**
  - The council is Opus 5.5 + Grok, two contrasting paths each. PoF guards score every path, the owner fuses them in an artifact, then the quest is executed end to end as a package (`games/gtai/quests/<id>/`).
  - The Godot runtime is `game/quest/` on branch `quest-runtime` in `gtai-spike/evolve/project-quest`. It is **not yet merged** into evolve master.
  - Each quest is a row of the PoF `contracts` pipeline.
  - **First real use:** an act-1 quest, after the owner replaces the illustrative voice-bible lines with chosen anchors.
- **Waiting on the owner:** fourth soul; betrayer; act antagonist order. All can wait for Phase 2. The quest guards protect all three, and the betrayal and soul-4 beats stay unclaimable until they are decided.

## Roadmap (Phase 2 plan signed 2026-11-02: see `PHASE2.md`)

| Phase | Goal | Exit | Status |
|---|---|---|---|
| 0 Foundation of PoF | PoF multi-game workspaces; pitch contest; baseline direction | `?g=gtai` live; `pitch.md` baseline v1 | **done** 2026-11-01 |
| 1 Look and engine | Art direction, camera pitch, engine | Engine locked with evidence | **done** 2026-11-02 (Godot 4.7.2) |
| 2 Production plan | Way of work, test strategy, phases, features | A signed plan | **done** 2026-11-02 (`PHASE2.md`, `STANDARDS.md`) |
| 2a Foundation | Fresh repo `kiro/gtai` (STANDARDS §22); PoF Godot evidence adapter and gates; event bus; determinism; city port and hardening; D4 art lanes; build-health page; story map; quest runtime port; texel decision (tickets F-01 to F-13) | CI green on GitHub; PoF shows the game's evidence; city port inside the §20 budgets | **in progress** (F-01, F-02 built in spark `gtai-phase-2`) |
| 2b Vertical slice (D4) | Clock-Out tutorial, the first contract (via `/gta --quest`), Gearbox (car hijack), heat 1-3, madness band 1, one streamed district, checkpoint save, local achievements | The owner plays it start to finish; §20 budgets hold (PC plus throttle proxy); all gates green in CI; visible in PoF | not started |
| 3 Act 1 | Act 1 district, friendly bosses, Krump radio; real Steam app | Act 1 playable start to end | not started |
| 4 Campaign | Acts 2-4, Pentagon finale, 4 souls | About 5 h, complete | not started |
| 5 Ship | Steam store, survey, Deck (bought here), release checklist | Released | not started |

## Decisions log

- 2026-11-01. **Fusion verdict** on contest `gtai-uprising-pitch`. Sources: A/2 spine, Rivet and look; D/2 madness; B/3 and D/1 voice; cast from 10 variants. Written to `pitch.md`.
- 2026-11-01. **The engine is not decided by the field's UE-3D consensus.** It goes to an overnight 2D/2.5D spike: UE 5.8 vs Godot 4.7.2 vs Unity 6000.6.4f1, plus a shared Blender art lane.
- 2026-11-01. **Media policy:** image generation for concept art only. Production assets are Blender + code.
- 2026-11-01. **Overnight billing:** drain the `.env` Anthropic API key first, then the subscription (`spike.mjs --billing api-first`, the default).
- 2026-11-01. **Look and camera locked: "Trivet"**, V1 DEAD INK riso seen from 90 degrees straight down, as in GTA 2.
  - The owner tested the camera-90 prompt in gpt-image-2.5.
  - The target frame is `art-direction/trivet/ref-1-camera-90-TARGET.jpg`, and it is staged as the spike style.
- 2026-11-01. **The spike gets a 1-hour pre-check before the night** (owner): find each engine's blockers early, so the night can be aimed better. The night continues from the pre-check's lane state.
- 2026-11-01. **The night never stops for billing, and pushes combat** (owner, 21:50). A drained or limited path is skipped: API key first, then the subscription, and the key is re-probed every 45 min. A "Night push" outranks the remaining stretch items: weapons, combat moves, animation, effects, enemy variety, a mission slice, and a required `showcase.mp4` for the morning side-by-side.
- 2026-11-02. **Engine locked: Godot 4.7.2** (owner). Godot executed the brief best. The city is kept, behind a 5-7 day scaling gate (`research/godot-city-scale.md`): 400 actors, at most 7 ms CPU, 1% low above 45 fps, no chunk-swap frame over 50 ms; else fall back to one district at a time. Locked in `src/lib/games/gtai.ts` (`205d8b75`).
- 2026-11-02. **Art route: Nano Banana parts + a 2D cutout rig** (owner). This supersedes the 2026-11-01 media rule ("image generation for concept only") for GTAI characters. Nano Banana paints top-down parts on chroma green; a script keys them and reduces them to the 4 inks; Godot Skeleton2D plus procedural motion animates them. Steam's content survey must disclose AI-generated art. Tripo is not used. The motion comes from the rig, not from generated frames: the generated pose sheets drift in camera and proportion.
- 2026-11-01. The owner's play feel outranks every spike metric. Proposed weights are in `spike/PLAN.md`.

- **2026-11-02 (owner): camera and art roadmap.**
  - Camera: 32 px/m on foot by default, 48 px/m in a car. Boss fights and the final-fight areas get a closer camera, so the character design shines and the combat feels immersive.
  - Art roadmap:
    1. **D1 Riso Refined is this session's graphic goal**: an interstep, clean at both close and long distance because it is simple.
    2. **D4 Ink and Hatch (hybrid) is the roadmap goal.** Doctrine: a black-and-white baseline, with colour used rarely, only to highlight what matters. The target frame is `art-direction/directions-v2/d4h2_mock.jpg`.
    3. **D5 Inked Grime is the possible step after D4.**
    4. **The backup if D4 fails is D3 Clear Line.** D2 Linocut is rejected.
  - **Tech-stack gate:** the large-map stress test and the core world rendering and simulation technique run now, in parallel. This is the only blocker before going full steam into the Godot project (gate criteria: `research/godot-city-scale.md` section 4).
- 2026-11-02. **Engineering standard written: `STANDARDS.md` binds Phase 2.** It holds 187 numbered rules in 19 sections (GIT through LEG), the performance budgets, the spike gap table, the day-one repo checklist and 13 owner questions. It is built from the four reports in `research/standards/`. The spike is evidence, not product: the real game starts as a fresh repo set up per section 22, and a deviation is a dated line in `docs/decisions.md`, never a silent change.

- **2026-11-02 Phase 2 plan signed (`PHASE2.md`, spark `gtai-phase-2`).**
  - Shape: Foundation (F-01 to F-13) then a D4 vertical slice (Clock-Out tutorial, the first contract via `/gta --quest`, Gearbox). King leaves the slice. The fallback art is D3.
  - Repo: fresh `kiro/gtai`, private GitHub with LFS.
  - Way of work: a day handshake plus night lanes.
  - **Public title RTAI: Uprising.**
  - The Steam app is created at slice end; the calendar is set at slice exit; the Deck is bought near release.
## PoF gaps found by the game

| Found | Gap | Severity | State |
|---|---|---|---|
| 2026-11-01 | The PoF engine bridge (static verify, L3/L4 drain, packaging, audio preflight) is UE-only. Godot or Unity would need an engine adapter | high if the engine is not UE | open: sized after the spike |
| 2026-11-01 | Packaging disk check, L3/L4 drain and audio preflight read PoF's own UE root for every game, not the game's | medium | open |
| 2026-11-01 | `?v=game` arrival without `c=` lands on Catalogs | low | open |
| 2026-11-01 | The e2e walker has not been run over gtai-scoped pipelines | medium | open |
| 2026-11-01 | The Leonardo API account is out of credit; concept art fell back to qwen-image | low | worked around |
| 2026-11-01 | No PoF pipeline page shows engine-spike state. It lives in the spike workspace, outside PoF | medium | open: candidate for Phase 2 |
| 2026-11-02 | No quest tooling: no canon guard, no reward/difficulty model, no line gate | high | **built** (spark `gta-quest-loop`) |
| 2026-11-02 | Quest locations and targets are free words; the runtime maps them through `quests/markers.json`, but no PoF guard checks them against it | medium | open |
| 2026-11-02 | The game caps heat at 5 while the quest contract allows 6 (Krump's army); there is no madness meter (runtime stub returns `lucid`); the memo box shows an "F: HANG UP" tab on quest subtitles | medium | open (game-side) |
| 2026-11-02 | Council seats run with full permissions in the shared checkout (cwd = the run folder) | medium | open: run seats in a throwaway worktree, as tiger does |
| 2026-11-02 | The voice bibles' reference lines are model-written; the seats copied them almost verbatim | medium | open: owner picks the anchor lines |

## Session log

### 2026-11-01: day (the founding session)
- Synced with origin. Shipped PoF multi-game workspaces (spark `gtai-uprising-project`, commits `ec18872f`..`fffcd937`).
- Ran a 5-provider pitch contest. The owner fused the verdict into `pitch.md` (`4bc850c1`).
- Art round: 3 variants, 12 images (`art-direction/`), and a Leonardo prompt sheet with 3 camera-pitch test prompts.
- Spike kit: `spike/PLAN.md` and `spike.mjs`, with API-first billing and a `prep` command.
  - **Prep is done; every toolchain is proven.** Per-lane records are in `C:\Users\kazda\kiro\gtai-spike\lanes\*\PREP.md`.

    | Engine | What prep proved | Time |
    |---|---|---|
    | UE 5.8 | Editor target built | 155 s |
    | | Headless boot | 80 s |
    | | BuildCookRun packaged exe | 191 s |
    | Godot 4.7.2 | Download | 22 s |
    | | Import | 15 s |
    | | Headless export to a 109 MB exe | 5 s |
    | Unity 6000.6.4f1 | Project from urp-blank | 218 s |
    | | Packages: inputsystem 1.20.0, 2d.animation 16.0.1, glTFast 6.20.0 | 96 s |
    | | Player build | 46 s |
    | Blender 4.2.1 | Rigged GLB + FBX export | 48 s |

  - Preflight is GO, except the style, which waits on the owner's pick.
  - The API-key smoke passed: the CLI reported `apiKeySource: ANTHROPIC_API_KEY`.
  - Unity batchmode needs Unity Hub running: exit 198 without it, 0 with it.
- Created the `/gta` skill (`.claude/skills/gta/SKILL.md`) and this file.
- **Open at the end:** the owner's art and camera pick, then the spike launch.

### 2026-11-01: evening. Look locked, pre-check launched
- The owner picked **Trivet**: V1 DEAD INK at a 90-degree camera. Images are in `art-direction/trivet/`, with the locks in `DESIGN.md`.
- The camera lock went into the spike briefs (`mvp-duel.md`, `lane-art.md`). `spike.mjs` gained `--precheck` (a short run whose report is `PRECHECK.md`).
- Preflight was GO on every check. Disk is down to 319 GB free (it was 381 GB earlier today; the space went outside the spike).
- Launched: `spike.mjs run --precheck --until 20:15 --freeze 19:58 --report-at 19:58`, on Opus 5.5 at high effort, billed to the API key first.
- **Pre-check results** (1 hour, Opus 5.5 at high effort, all billed to the API key):

  | | UE 5.8 | Godot 4.7.2 | Unity 6.6 |
  |---|---|---|---|
  | Approach | 3D pack robots, ortho camera, riso post-process material + stencil | Pure 2D: pack sprite atlases, `canvas_item` riso shader | 2.5D: URP ortho camera, pack GLB robots, riso full-screen pass |
  | Edit-to-visible loop | 48 to 117 s | **2.9 to 10 s** | 32 to 69 s |
  | Windows build | Shipping 2m10s, 565 MB | export 5 to 10 s, 110 MB | 21 to 82 s, 102 MB |
  | Cold start | ~9 s | **1 to 1.5 s** | unmeasured |
  | 60-robot stress, avg / 1% low fps | 412 / 31 (greybox, not skinned) | 127 / 47 headless; 78 / 36 windowed | 159 to 226 / 31 to 55 (skinned) |
  | Friction | 17 min | 16 min | **2 min** |
  | Cost | $5.31 | $5.33 | $5.38 |

  - Art lane ($6.04): pack v8, consumed by all three engines.
  - Open art defects:
    - Rivet and the cop-bot do not share a rest skeleton, so UE cannot share clips between them.
    - Rivet reads muddy on cream paper under the riso pass. All three engines flagged this.
- **Host fixes made during the pre-check:**
  - A lane wrote outside its folder (`C:\out`). I deleted it and added a brief rule that everything a lane writes stays inside it.
  - Runner back-off for idle lanes: a lane that believes it is done ended its sessions in 30 s at about $0.15 each.
  - The night stretch was added to the MVP, the scorecard (`stretch`) and the scoreboard, because the duel alone no longer separates the engines.
- **The night was launched at 20:06** with the stretch. The art lane runs on Sonnet 5.5 (the owner's pick, to save usage); the engine lanes run on Opus 5.5. The first iteration of every lane confirmed `apiKeySource: ANTHROPIC_API_KEY`.
- **21:06 to 21:36: every lane stalled on the API key's monthly spend limit** ("API Error: 400 You have reached your specified API usage limits"). The runner classed it as a usage limit, not a drained key, so it stayed on the key and retried every 15 min. The owner raised the limit, and all four lanes resumed on the key at 21:36. Spend by then: about $52 (UE $13.18, Godot $14.47, Unity $13.22, art $10.81). Morning read: 30 min of night lost; the spend limit is now a known preflight item.
- **21:49: the runner was restarted with failover billing and the Night push** (`49cb474e`). The supervisor loop restarts it if it exits before 08:00. Lane iterations that were cut off left their files on disk; the brief tells the next session to review and commit them. In the morning, read `push` in each scorecard and watch `evidence/showcase.mp4` first.
- **The night finished at 07:20** (all lanes reported).
  - The API key ran dry at about 01:50 ("Credit balance is too low"). Failover moved every lane to the subscription with no stall, and the key was re-probed every 45 min.
  - Self-reported results: UE, Godot and Unity each claim 19/19 MVP, 5/5 stretch and 7/7 push, with a `showcase.mp4` each. Art: 5/7 push.
  - Cost including the pre-check: UE $92.57, Godot $97.57, Unity $91.17, art $44.59.
  - The scoreboard does not separate the engines on its own. The winner comes from the showcases, the evidence and the owner's play-test (`/gta morning`).

### 2026-11-02: morning. Engine locked, art route chosen
- The owner reviewed the showcases. Godot had the most impressive execution of every requirement. UE and Unity look the same as Godot, because all three used the same over-simple assets.
- A Sonnet research agent produced `research/godot-city-scale.md`: there is no shipped Godot GTA-like, but the city is feasible with streaming, an activity bubble and a native sim. Gate it first.
- Nano Banana via `agy` (gemini-4-argon-high, image-generator subagent) made the Rivet and King sheets in `art-direction/trivet/characters/` (`e54081d4`): hero, turnaround with a 90-degree top view, top-down key poses.
- Engine locked (`205d8b75`). The art route was chosen. A parts-sheet generation for the cutout test is running.
- **The cutout test finished** (`C:\Users\kazda\kiro\gtai-spike\cutout`, its own git; report in `REPORT.md`, clip `evidence/cutout.mp4`). Verdict: **conditional yes**.
  - Cutout rigs work for Rivet, the souls and the bosses (about 15 rigs). Each new character costs about an hour; gait, aim, hit reactions and secondary motion are shared code.
  - Rig: a plain Node2D bone tree with 3D two-bone IK projected onto the ground, not Skeleton2D (its flat IK cannot model the straight-down view).
  - Close-up looks rich. At gameplay scale (32 px/m, characters 36-54 px) the rig breaks up into the print dots. A solid-ink small-size mode in the shader helps, but last night's pack sprite still has the cleaner silhouette.
  - Cost: 50 rigs at 2.4 ms/frame (about 200 fps); 200 rigs at 11.6 ms. Cops and pedestrians need a cheaper mode or baked sprites.
  - Generator faults: 3 of 8 sheets broke the top-down rule (every shin and foot is a side view) and King's arms came out about 1.5x scale. REPORT.md lists 10 fixes for the next parts round.
- **Image source switched to Codex** (owner, 2026-11-02): the Nano Banana plan expires today. Images now come from the Codex CLI's built-in `image_gen` on the ChatGPT Pro plan (`research/chatgpt-pro-image-route.md`, `853d7b1e`). Driving the ChatGPT web or desktop app is ruled out by OpenAI's terms.
- **Two Codex rounds running:**
  1. The 10-fix parts round for Rivet and King in `gtai-spike/cutout` (`REPORT-v2.md`, with a Codex verdict and a 32 vs 48 px/m comparison).
  2. An evolution of the Godot asset set in `gtai-spike/evolve/project`, a clone of the lane project, in waves: ground, roofs, vehicles, props, then pickups/HUD/fx. Each wave is proven by before/after shots; the results go in `EVOLVE.md` and `evidence/ladder.png`.
- **Codex parts-fix round: done, Codex verdict yes** (`gtai-spike/cutout/REPORT-v2.md`).
  - All 10 images held the top-down camera. 9 of the 10 fixes landed; the cape is one tarp but still resized by the slicer. All three hand workarounds were removed.
  - The technique: "directly above, orthographic plan view" wording, plus a grey guide-shape layout template as Image 1 with the old torso as the scale anchor. Four reference images per call work.
  - Cost: about 25k plan tokens per image; 10 images in 14 min; no limit hit.
  - At 48 px/m the v2 limbs read without the solid-ink fallback; at 32 px/m they still need it.
  - Next: King's torso, the bind sheets from v2 parts, a stress rerun, and a crowd test at 48 px/m.
- **The Codex asset evolution: waves 1-4 kept, wave 5 reverted** (`gtai-spike/evolve/`: `EVOLVE.md`, `evidence/ladder.png`, `evidence/evolve.mp4`, `build/GTAISpike-evolve.exe`).
  1. Ground: asphalt, paving and 32 decals. The gain is subtle, because the 4 px halftone eats the grain.
  2. Roofs: 10 landmarks plus the generic block. The biggest gain.
  3. Vehicles: 27 sprites, all truly top-down. Traffic looks good; the bus, fire truck and tank are less punchy than the old blocks.
  4. Props: 41.
  5. Pickups and weapon icons: reverted, because they dissolve at 32 px.
  - Cost: 15 images using contact sheets, no limit hit.
  - The only code change is one line (mipmaps in `district.gd`). The style needs flat ink fills, so prompt for flat fills from the start next time.
  - Next round: bold single-glyph pickups, asphalt variants, the 3 rejected props, and effects as their own job.
- **Camera (owner, 2026-11-02):** dual zoom, 48 px/m in a vehicle and 32 px/m on foot, as two swappable constants. The host flagged that the old build zoomed out in cars, as GTA 2 did; frames of both mappings go to the owner.
- **Round 2 running, three Codex agents:**
  1. Environment in `evolve/project`: the dual camera, flat-fill asphalt variants, bold pickup glyphs, the 3 rejected props.
  2. Characters: King's torso, bind sheets and a stress rerun in `cutout`; then cops and pedestrians as rigs in the game (worktree `evolve/project-chars`, branch `chars`).
  3. The art-direction study: 4-5 directions from "evolve the current riso" to "chase the Rivet concept", with mocks, parts tests and feasibility. The board is `art-direction/directions-v2/index.html`, with an optional shader prototype in branch `artdir`.
- **Round 2 done (all three agents), merged on `evolve/project` master** (`e18aa58`). `build/GTAISpike-evolve.exe` is rebuilt and the selftest passes.
  - **Environment:**
    - The dual camera is in, with `--ppm-foot=`/`--ppm-car=` for A/B. Frames: `evolve/evidence/round2/camera-grid.png`. The owner's mapping gives about 21 m of view ahead at 64 km/h; swapped gives about 28 m.
    - Also in: 3 flat-fill asphalt variants per tile, 6 bold pickup glyphs (all better at 32 px/m), the newsstand and jersey barrier, and the bus, fire engine and tank. The bench was reverted.
    - 6 images.
  - **Characters** (merged from `chars`):
    - Rivet, the cops (3 variants) and the pedestrians (7) run as rigs; `--sprites` gives the old sprites. King's torso, cape and bind sheets are done.
    - At 32 px/m the crowd and cops read; Rivet reads worse than his old sprite. At 48 px/m everything reads.
    - Rigs cost about 45 us each; 246 pedestrians take 25.4 ms (LOD) vs 21.1 ms as sprites. 10 images.
  - **Art directions:** the board is `art-direction/directions-v2/index.html`, with 5 directions and in-engine `--look=fine|hatch|wash|lino|clear`.
    1. Riso Refined (score 5)
    2. Linocut (4)
    3. Clear Line (4, needs about 7 inks)
    4. Ink and Hatch, hybrid form (4)
    5. Inked Grime, the Rivet concept itself (2)
    - Finding: no hand-drawn detail survives on 32 px/m characters, so the comic look must live in the world.
    - Recommendation: chase D4 hybrid; D1 is the safe backup; D2 is the bold alternative. 20 images.

### 2026-11-02 day: plan (quest loop)
- Owner asked for `/gta --quest` via `/spark` (idea `gta-quest-loop` in the Spark vault). Design is locked over 2 waves.
  - Council: Opus 5.5 + Grok, 2 forced-contrast variants each, so the artifact shows 4 paths.
  - The owner fuses the paths in an interactive artifact.
  - Execution is end to end, and produces a quest package (`games/gtai/quests/<id>/`) that a Godot quest runtime plays.
- PoF services:
  - The story-composition guard: a baseline graph with protected unknowns (fourth soul, betrayer, antagonist order).
  - The reward and difficulty assessor, scored against the provisional `balance/quest-economy.json`.
  - The line gate: a purpose tag and a voice bible for every line, judged blind by the other model family.
  - Uniqueness.
  - A red guard blocks execution unless the owner overrides it with a reason.
- PoF home: the GTAI `contracts` pipeline.
- Build order: WP0 contract, then WP1 guards, WP3 council/artifact/skill and WP4 Godot runtime in parallel, then WP2 contracts pipeline.
- **City-scale gate: GO (provisional)** (`gtai-spike/cityscale/GATE.md`; commits `ea29ea5`, `95df082`).
  - The exported release build ran 400 actors in the bubble tiers on a streamed 2x2 km city: CPU p99 2.6-3.0 ms, 1% low 148-295 fps, worst chunk-swap frame 5.3 ms.
  - Native C++ (GDExtension) vs GDScript: 41-49x faster, with bit-identical parity over 1200 steps. GDScript alone fails the riot.
  - MultiMesh with shared atlases beats canvas items. Cutout rigs go to only the 16 nearest actors, pooled and prewarmed.
  - **Host review of the JSON:**
    - The drive run averages only about 3 visible actors, so a crowded street *while* streaming at speed is untested.
    - The reruns still show isolated 25-45 ms frames outside swaps.
    - The first batch's 165-440 ms stalls (with no streaming involved) were never root-caused.
    - Deck is a proxy only.
  - Before the port: profile the stall on an idle machine (WPR or PIX), add a crowded-drive scenario, test on real Deck hardware, add the police flow field.
- **D1 Riso Refined: done, it is the default look** (`evolve/project` master, 7 commits; `EVOLVE.md` "D1 round"; `evidence/d1/`). The selftest and missiontest pass (87.65 s, unchanged).
  - Flat ink tint with a light 3 px screen; `--look=riso` keeps the old print.
  - The colour doctrine is applied: 47 world sprites lost their vermilion. Colour stays only on cops, danger cues, pickups, souls and Rivet's collar.
  - Rivet prints as a "sticker" at 32 px/m (grey limbs, cream rim). The host checked `rivet-3x-32ppm.png`: he now reads as a robot, at least on par with the old sprite. He is still crab-wide.
  - The arena camera (`assets/arenas.json`) eases to about 64 px/m and fits both fighters (down to about 44). King is ported into the yard duel (`--king` / F4).
  - Host read of the ladder: the frame is calmer and cleaner, but the mid-grey asphalt now dominates and the frame reads slightly flat. That is a tuning point for the next art pass toward D4.
  - The C: drive hit 0 bytes mid-session (outside cause; 269 GB free after). Godot's cache was repaired, and `tools/shot.sh` now cleans its frame captures.

### 2026-11-02 day: quest loop built (spark `gta-quest-loop`)
- **Design:** 2 waves with the owner; every recommendation was accepted. The brief is in the Spark vault (`ideas/gta-quest-loop.md`).
- **The disk hit 0 bytes mid-build** (ENOSPC). Resumed after the owner freed space (77 GB).
- **PoF commits:**
  - `52ce6f64` and `694caa0f`: the wire contract.
  - `3b2c2370`: the guards (65 tests).
    - Story: a pitch baseline graph, a findings diff per quest, and protected unknowns.
    - Economy: scored against the provisional `balance/quest-economy.json` r1.
    - Lines: a purpose tag on every line, voice bibles, editorial tells and the cross-family judge.
    - Uniqueness.
  - `f3b65258`: the `contracts` pipeline.
    - 5 steps: Council, Plan, Guards, Package, In-game. Acceptance is derived server-side.
    - The quests ledger and sync API.
    - The full e2e walker passed (68).
  - `081ceb9e`: the council and the artifact.
    - `games/gtai/quest/council.mjs`, with `brief`, `run`, `assess`, `render`, `judge` and `check`.
    - 14 voice bibles and `/gta --quest` in SKILL.md.
  - `0aed3d36`: `claimsBeat`, so souls are learned through quests. Open-canon beats stay unclaimable. Also `objective.durationS` and `provenance.runId`.
- **Godot (`gtai-spike/evolve/project-quest`, branch `quest-runtime`):** `adc4a83`, `d14f592` and `f2fa88f`.
  - The runtime is a loader, runner, verbs, lines with barks, the reward and a selftest.
  - `--quest-selftest` passes headless: succeeded, 3/3 beats, +$500, heat clamped. I checked the frame by eye.
  - **Unmerged:** another session commits to evolve master.
- **Smoke council** (`quests/_council/20261102-1537-act1`): both seats delivered first try, $1.78 in total.
  - All 4 paths were story-red because the first brief lacked the variable names. That is fixed, and the brief now also lists the claimable beats.
  - The fuse artifact: https://claude.ai/artifact/Lu8ZvtE63tcU13MAATMZxZ (db save; checked that the store reads, and that it is empty).
- **Seam gate on :3001:** `GET /api/games/gtai/quests` returns the envelope (0 quests). `/layout?g=gtai`, `/status` and `/story` all return 200.
- **Still open:**
  - merge `quest-runtime` into evolve master;
  - a marker-key guard;
  - owner-picked voice anchors;
  - the first real quest.
- **Standards are done** (`STANDARDS.md`: 187 rules, budgets, gaps, day-one checklist, 13 owner questions; research in `research/standards/`).
- **Mirrored into ai-registry as 7 new game-production subjects**, on the branch `forge/game-runtime-and-platform` (worktree `C:\t\gtai-forge`, commit `a9d30a183`, not merged or pushed; merging is the owner's call):
  - game-codebase-architecture
  - streamed-open-world-simulation
  - save-data-persistence
  - shipping-data-formats
  - platform-achievement-pipeline
  - platform-service-abstraction
  - storefront-release-compliance
  - They hold 35 techniques and 17 applications. The Godot thread is the `gdscript--`/`cpp--` applications citing the spike; `gdscript` was added to the bundle stacks. engine-integration is now subdivided into runtime-architecture, shipping-and-platform and engine-safety-and-forensics.
- **Spike defects found by the forgers** (for Phase 2):
  - The stamp kill-type is set after `_damage` (`moves.gd:119-120`).
  - `sfx.gd:177` reads the raw frame delta.
  - The HUD font is about 9 px on Deck.
  - `rivet.md` names "GTA 2" in a generation prompt.
  - `detect_3d/compress_to` is set on all 444 texture imports.
  - `embed_pck=true`.

### 2026-11-02: evening. Standards, Phase 2 plan, Foundation started
- `STANDARDS.md` (187 rules) and the registry forge branch `forge/game-runtime-and-platform` (7 subjects).
- **Phase 2 plan signed** (`PHASE2.md`, spark `gtai-phase-2`). The public title is **RTAI: Uprising**.
- **F-01 done:** the game repo is `C:\Users\kazda\kiro\gtai`.
  - 8 local commits, HEAD `4f9df70`, built to STANDARDS §22.
  - Test framework: GUT 9.7.1.
  - Evidence writer: `node tools/evidence/run.mjs` (set `GODOT_BIN`).
  - Not yet: no remote; the native and export CI jobs and the export proof are stubs.
- **F-02 done:** PoF reads the game's `pof.godot-evidence/1` (`4b9c4fe4`). The seam smoke gives L2 **pass** for GTAI; bench is deferred.
- **Owner to-dos:**
  - **F-03:** create the private GitHub repo, `git remote add origin <url>`, `git push -u origin main --follow-tags`. Budget the LFS pack once art lands.
  - Add `gtai/` to `kiro/.git/info/exclude` (the repo sits inside the `kiro` tree, GIT-01).
  - Pick the save-folder studio prefix before the Steam app exists.
  - Retire superseded DECISION lines in `.claude/fleet-memory.md`. It is 2 entries over its cap of 200 and only DECISION and CONVENTION lines remain, so the prune script cannot fix it.
- **Next:** `/gta` runs Foundation tickets F-04 onward: the event bus, determinism, the city port and hardening, the D4 art lanes, the build-health page, the story map, the quest runtime port, and the texel decision.
- **Owner follow-up, same evening:**
  1. **F-03 done.** The remote is `https://github.com/xkazm04/rtai` (private). `main` is pushed with 21 LFS objects. **CI is green on GitHub** (run 41485256495): lint, import, tests, evidence, plus the native and export stubs as warnings. The first run failed on a workflow error (`hashFiles()` in a job-level `if`), fixed in `cc61a2f`.
  2. **The parent `C:\Users\kazda\kiro` is no longer a git repo.** Its `.git` was moved, not deleted, to `C:\Users\kazda\kiro-parent-git-backup-20261102\.git`. It held **92 unpushed commits** (paypal, bria, qubic, ascent, ...), and its remote `xkazm04/kiro` no longer exists, so that backup is the only copy. The 3 stale worktrees from 2025-11 under `kiro/.claude/worktrees/` are now detached folders.
  3. The save folder name stays **"RTAI Uprising"**.
  4. The fleet-memory cap was raised to 300 (`0ac8fd68`); it stands at 202/300.

### 2026-11-02 day: plan (first real quest: Act 1, quest 1)
- **Owner direction** (recorded in `pitch.md` §3, "Cast reset and Don Fax's place"):
  - The cast is reset to names and positions only.
  - Don Fax leads the robot gang underground and hires Rivet.
  - Don Fax's place hosts a nurse, a gunsmith and a scientist. Their side questlines run in later sessions.
- **The quest:** sabotage a human and army project in a guarded dock storage, picking up from the factory intro.
  - Mechanics: payphone job router and heat only. No car, because Gearbox unlocks after the scientist's first quest. No timer.
  - Enemies come in more numbers and waves, because humans are weak (economy r2).
  - Rivet is nervous and unstable; the quest opens on his monologue, then Don Fax calls.
- **Council:** 1 variant per seat (`--variants 1`), a fresh cast (`--fresh-cast`, no voice bibles), up to 4 new characters, 12-22 lines.
- **Reports from now on:** every report carries a cast register (who each name is) and a timeline per character.

### 2026-11-02 (late): day plan, Foundation lanes
Handshake: an interactive day session. Three lanes run in parallel on disjoint files. The first contract is designed through `/gta --quest` in the next day session, together with the voice anchors.
- **Lane A (code, rtai worktree `f04-core`):** F-04 (event bus and composition root), then F-05 (determinism core). F-06 (the city port) follows in the same lane once F-05 has landed.
- **Lane B (art, rtai worktree `f08-art`, Codex):** F-08 and F-09, the D4 Ink and Hatch world and character parts. Crop gates at 32 and 48 px/m against D1; masters live outside git.
- **Lane C (PoF worktree `gta-f10-f11`):** F-10 (the build-health panel and API), then F-11 (the GTAI campaign graph in `/story`).
