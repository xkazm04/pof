# GTAI overnight engine spike: plan

**The question:** in which engine can an AI agent build a great-feeling 2D/2.5D top-down action game fastest, with
the least friction, and in a shape that PoF can manage? The owner's premise: 3D may not give enough control over
animation, movement and combat, so test 2D/2.5D in the three candidate engines and *experience* the difficulty
first-hand.

**The method:** the same MVP, a top-down pistol duel between two robots (`brief/mvp-duel.md`), built overnight in
parallel by one Claude agent per engine. The same model, the same time and the same assets go to each, and every
lane keeps an honest journal of friction. In the morning the owner plays every build, and a scorecard plus the
journals decide.

## Lanes

| Lane | Engine | Already on this machine | Pre-launch action |
|---|---|---|---|
| `ue` | Unreal 5.8 (Paper2D or 3D-ortho, the lane's choice) | yes | none |
| `godot` | Godot 4.7.2 (GDScript) | **no** | `preflight --fetch-godot` downloads the editor and export templates (about 1 GB) |
| `unity` | Unity 6000.6.4f1 (URP 2D or 3D-ortho) | editor yes, **licence NO** | **Owner:** sign in to Unity Hub and add a free Personal licence. Probed 2026-11-01: batchmode exits 198 with "Access token is unavailable". Unity Hub's executable is not at its default path, so it may need reinstalling |
| `art` | Blender 4.2 + code | yes | none |

**Why a fourth (art) lane, which the host added:**
- The art lane builds **one shared asset pack** that every engine lane imports: GLB/FBX rigged robots with the six clips, pre-rendered top-down sprite sheets, environment pieces, effects, and a per-engine shader recipe for the style.
- That makes the engine comparison fair. One lane's better Blender skills do not pass as a better engine.
- It also **trains the art style** on real assets, as the owner asked.
- The engine lanes greybox until pack v1 lands (target: within 2 hours), then integrate each newer pack.
- Drop it with `--lanes ue,godot,unity` if you want three agents only.

## Timeline (example: launch at 21:00)

| Time | What happens |
|---|---|
| before launch | The owner picks the art direction (`games/gtai/art-direction/index.html`), activates the Unity licence, and runs preflight until it is GO |
| 21:00 | `run` starts all lanes, staggered 45 s apart. Each lane loops through fresh sessions of up to 100 min, carrying memory in `JOURNAL.md` and its git log |
| ~23:00 | Art pack v1 lands. The engine lanes swap greybox for real assets |
| 06:45 | **Freeze**: no new features. Fix bugs, refresh the autoplay, stress and video evidence |
| 07:15 | **Report**: each lane writes `REPORT.md` and `scorecard.json` |
| 08:00 | Deadline. Then run `spike.mjs report`, which writes `SCOREBOARD.md` and `compare.html` |

## Launch: commands, from the PoF repo root

```bash
# 1. stage the workspace with the chosen art direction (replace variant-N)
node games/gtai/spike/spike.mjs init --style games/gtai/art-direction/variant-N

# 2. fetch Godot, run every check, and include a one-turn model smoke call
node games/gtai/spike/spike.mjs preflight --fetch-godot --smoke
#    must print GO. Also: powercfg /change standby-timeout-ac 0, and pause Windows Update for the night

# 3. launch (keep the terminal open; Ctrl-C stops only this runner's own sessions)
node games/gtai/spike/spike.mjs run --until 08:00 --model claude-opus-5-5 --effort high

# anytime: progress per lane (iterations, milestones, friction minutes, last journal lines)
node games/gtai/spike/spike.mjs status

# morning
node games/gtai/spike/spike.mjs report
```

- The workspace is `C:\Users\kazda\kiro\gtai-spike\`, outside this repo. Each lane has its own git repo. Engine projects are large and belong to no PoF commit.
- Each lane session runs headless with `--permission-mode bypassPermissions`, `--setting-sources project,local` and `--strict-mcp-config`.
  - The lane's brief is its `CLAUDE.md`. Your user-level skills, hooks and MCP servers are not loaded, so every lane gets the same, CLI-only toolset.
- When a lane hits a usage limit, the runner waits 15 min and retries. **Four Opus lanes for about 11 hours is a lot of usage.** If limits are tight, run the art lane on Sonnet (`--model-art claude-sonnet-5-5`) and keep the engine lanes on one model, for fairness.

## What is measured (each lane's `scorecard.json`, plus the runner's own records)

| Signal | Source | Why it matters for GTAI |
|---|---|---|
| Minutes to first playable; minutes to MVP complete | lane journal and git timeline | Agent velocity in this engine |
| 19-item MVP checklist, **each with an evidence file** | scorecard `evidence` | Done means seen running, not compiled |
| Edit-to-see loop in seconds (3 or more measurements) | `LOOP:` lines | The cost of every future iteration, multiplied by thousands |
| Friction minutes and blocked-on-human count | `FRICTION:` / `BLOCKED:` lines | "How difficult the process is", measured |
| Build time, build size, cold start | scorecard | Steam shipping and CI cost |
| Autoplay FPS; **60-robot stress** FPS (avg / 1% low) | `--autoplay` / `--stress` | A GTA-style city needs many actors |
| Headless automation (full / partial / none) | scorecard | Whether PoF can verify the game without a human. PoF's whole model rests on this |
| Iterations and CLI cost per lane | `runner-state.json` | What a 5-hour game costs to build with agents |

## The morning decision

1. Open **`compare.html`** (video and frames per engine, plus the art pack preview) and **`SCOREBOARD.md`**.
2. **The owner plays each build for 5 minutes** and rates it 1-5 on movement, roll, shooting, death, readability and style. Feel outranks every metric.
3. Read each lane's top 5 frictions in `REPORT.md`.
4. The host adds the one factor no lane can measure: the **cost of PoF integration**. PoF's engine bridge (static verify, L3/L4 runtime acceptance, packaging, preflight) is Unreal-only. Godot or Unity means an engine-adapter work package in PoF, sized from the lanes' notes.

**Proposed weights** (the owner may change them before reading the results; deciding the weights first keeps the
reading honest):

| Weight | Factor |
|---|---|
| 30% | Owner's play feel |
| 20% | Agent velocity and friction (first playable, loop seconds, friction minutes, blocks) |
| 15% | MVP completeness with evidence |
| 10% | Headless automation and verifiability |
| 10% | Stress performance and scalability notes |
| 10% | PoF integration cost (host-scored) |
| 5% | Art-style fidelity |

**Kill rule:** a lane with no runnable Windows build by 08:00 is out, whatever its scores.

**Then:**
- The engine lock goes into `src/lib/games/gtai.ts` (`engine`).
- If it is not UE, a spark for a PoF engine adapter follows. That is the first planned GTAI pipeline work.
- The winning lane's project becomes the seed of the real game repo. The art lane's scripts become the first asset-pipeline steps.

## Host's prior, so the morning can test it (not a verdict)
- **Godot** probably reaches first playable fastest with an agent: scenes are text, it exports headless, and its Movie Maker gives deterministic capture.
- **Unity**'s risk is licensing plus slow batchmode domain reloads.
- **UE**'s risks are that Paper2D is stale, and that the C++ compile loop slows iteration. UE's strength is that PoF already drives and verifies it.

If the results contradict this prior, that is the most useful outcome of the night.

## Risks of the night itself

| Risk | Mitigation |
|---|---|
| Unity licence still missing at launch | Preflight says NO-GO. The lane logs BLOCKED and still records the friction; the licence wall is itself a finding |
| Usage limits stop the lanes mid-night | The runner waits and retries. The art lane can run on Sonnet. `status` shows `LIMIT` |
| A lane kills another lane's editor process | Every brief forbids name-based kills. The runner kills only its own process trees |
| The PC sleeps or reboots | Preflight checks standby. Pause Windows Update for the night |
| Disk | 405 GB free now. Preflight requires 150 GB or more. Lanes are capped at about 40 GB each by their brief |
| A lane fakes evidence | The honesty rules are in every brief. The morning review opens the evidence files themselves, not just the scorecard |
