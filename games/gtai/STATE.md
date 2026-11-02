# GTAI: Uprising: campaign state

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
- **Waiting on the owner:** fourth soul; betrayer; act antagonist order. All can wait for Phase 2.

## Roadmap (provisional: Phase 2 rewrites it once the engine is known)

| Phase | Goal | Exit | Status |
|---|---|---|---|
| 0 Foundation | PoF multi-game workspaces; pitch contest; baseline direction | `?g=gtai` live; `pitch.md` baseline v1 | **done** 2026-11-01 |
| 1 Look and engine | Art direction, camera pitch, engine | Engine locked with evidence | **done** 2026-11-02 (Godot 4.7.2) |
| 2 Production plan | Way of work, test strategy, phases and features (the owner's original ask); pitch intake turned into canon; story graph mission pass; PoF engine adapter if not UE | A signed plan with milestones | not started |
| 3 Vertical slice | Clock-Out tutorial, 1 mission, 1 soul, heat 1-3, madness bands, through PoF pipelines (firearms, top-down-camera, wanted-heat) | A stranger plays 10 minutes and laughs | not started |
| 4 Act 1 | First district, 2 friendly bosses, King, Krump radio | Act 1 playable start to end | not started |
| 5 Campaign | Acts 2-4, Pentagon finale, 4 souls | About 5 h, complete | not started |
| 6 Ship | Steam: store page, achievements, cloud saves, Deck, mature-content survey | Released | not started |

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

## PoF gaps found by the game

| Found | Gap | Severity | State |
|---|---|---|---|
| 2026-11-01 | The PoF engine bridge (static verify, L3/L4 drain, packaging, audio preflight) is UE-only. Godot or Unity would need an engine adapter | high if the engine is not UE | open: sized after the spike |
| 2026-11-01 | Packaging disk check, L3/L4 drain and audio preflight read PoF's own UE root for every game, not the game's | medium | open |
| 2026-11-01 | `?v=game` arrival without `c=` lands on Catalogs | low | open |
| 2026-11-01 | The e2e walker has not been run over gtai-scoped pipelines | medium | open |
| 2026-11-01 | The Leonardo API account is out of credit; concept art fell back to qwen-image | low | worked around |
| 2026-11-01 | No PoF pipeline page shows engine-spike state. It lives in the spike workspace, outside PoF | medium | open: candidate for Phase 2 |

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
