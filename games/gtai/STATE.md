# GTAI: Uprising: campaign state

The living memory of the dual GTAI + PoF campaign. `/gta` reads this file first and writes it last.
Design truth is in `pitch.md`; this file is *where we are*.

## Now

- **Phase 1: Look and engine.**
  - **Exit criterion:** the engine locked in `src/lib/games/gtai.ts`, based on the overnight spike's scoreboard plus the owner's play-test.
  - Look and camera are locked: **Trivet** (V1 DEAD INK, 90 degrees overhead), 2026-11-01.
- **Running now:** a **1-hour spike pre-check**, started at 19:06 and ending at 20:15. It runs 4 lanes (`--precheck`).
  - Each lane writes `PRECHECK.md`: what works, blockers, and what the host or owner must fix before the night.
- **Next steps**
  1. After 20:15, read every lane's `PRECHECK.md` and `JOURNAL.md` (`spike.mjs status`). Fix any blocker the host or owner can fix. Adjust the lane briefs if needed (`spike.mjs init`, which re-runs without the style).
  2. Launch the night, which continues from the pre-check state: `node games/gtai/spike/spike.mjs run --until 08:00` (Unity Hub open).
  3. Morning (`/gta morning`): run the report, review the evidence, have the owner play-test, lock the engine. Then do Phase 2 planning.
- **Waiting on the owner:** fourth soul; betrayer; act antagonist order. All can wait for Phase 2.

## Roadmap (provisional: Phase 2 rewrites it once the engine is known)

| Phase | Goal | Exit | Status |
|---|---|---|---|
| 0 Foundation | PoF multi-game workspaces; pitch contest; baseline direction | `?g=gtai` live; `pitch.md` baseline v1 | **done** 2026-11-01 |
| 1 Look and engine | Art direction, camera pitch, engine | Engine locked with evidence | **in progress** |
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
