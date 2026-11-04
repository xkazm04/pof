# RTAI night run: weapons and combat, all the way in. 2026-11-04 01:xx until 09:00 (common brief for every lane)

You are one lane of an unattended night run on **RTAI: Uprising** (internal id `gtai`, Godot 4.7.2 + a GDExtension C++ city sim). The game repo is `C:\Users\kazda\kiro\gtai`. **Your lane works in its own git worktree (your cwd), on its own branch, cut from the merged main** of last night's two runs: the eight day lanes (D5 city, blue cops, red blood, vehicles, body collisions and tackles, the quest 1 slice, autosave, audio) and the six evening lanes (arena, Rivet's motion and melee, gunplay, enemy AI, ghost powers, visual fixes).

## The owner's direction for tonight (verbatim, 00:05)
"continue with night scope where you ended in weapon/combat coverage: Design, Equiped design on player, Shooting design, Animation on human oponents, more advanced weapons will one shot them with unique animation/brutality. Proceed until 9:00"

And from the evening (21:25), still binding: "i don't think this state is judgable. We don't have weapon design, final animation, oponent reaction on hit. The visual impression is the key for judgement and we need to go all the way in with the design"

Earlier binding direction: "Smooth combat on long and melee range would be the core piece of game we need to master."

## What that means (binding for every lane)
1. **The visual impression is the deliverable.** A system that works in numbers but looks like debug shapes is not done. Everything is judged in motion, in the game's look (D5 Inked Grime: ink lines, flat fills, the print grain), at 32 px/m, on the real characters.
2. **Depth before breadth.** Finish one weapon end to end (designed, held, fired, landing, the victim reacting and dying) before the next. The order of weapons is in each lane brief. Two finished weapons beat six half-finished ones.
3. **The full chain of a hit:** weapon art -> held in Rivet's claw with the right grip -> firing animation (recoil, muzzle flash, shell or spark) -> projectile visual (tracer, smoke trail, flame, arc) -> impact (hit flash, hit-stop, shake, knockback) -> the human's reaction (a flinch toward the hit, stagger, knockdown) -> death (by damage type) -> blood (red, from d5-combat) or sparks/oil on robots -> sound hook.
4. **Real game, not only the dev pit.** Each lane's work must end up in the **live game paths**: the arena (`--arena`) and the real fight code the quest and city use (`CombatArena` and friends). A dev scene proves a piece; the morning clip shows it in the arena or the city proving block (`--arena=city`).
5. **Advanced weapons kill humans in one shot with a unique, brutal kill animation** (the `brutality` lane). Stylised, inked, red: violent comic-book action in the D5 print, never photoreal gore.

## Standing verdicts (do not reopen)
- D5 is the look; noir is for special missions only. Red is blood only. Cops are blue. Vermilion only for danger, objectives and Rivet's collar. Teal only for souls. Rivet is only slightly larger than a human (the T2 proportions: arms x0.72). The soul trail stays off.
- Owner answers from the evening: rivet-motion-1 = A (T2 arms); gunplay-3 = A (tight locked burst on the told line). Placeholders (defaults, not judged): arena-1 C (teleport between stations), arena-2 A (camera leans toward the mouse), gunplay-1 A (a pistol or nail drops a human in one hit; armored 250, robot 600), gunplay-2 A (enemy rounds 0.45x), enemy-ai-1 A (patrol 1, riot 2 + shield, SWAT 2, gunner 4, thug 6), rivet-motion-2 B (stride 1.3), visual-fixes-1 B (12 m streets), ghost-powers-1/2 defaults.
- Humans are always weaker than Rivet (owner 11:30). Robots and bosses get resolved later.

## The owner is asleep: decide, never block, never ask
- There is no ASK channel tonight. At a design fork, pick what best serves the visual impression and the direction above, build it so the alternative is one data value or flag, and record it as `DECISION` in JOURNAL and `docs/decisions.md`.
- Put the forks the owner should judge in your REPORT under `## Calls for the owner`, each with a clip that shows the options side by side.

## The shared machine (six lanes, one GPU, one image route)
- Every performance number is **CONTENDED** unless you say otherwise.
- **Bench one at a time:** create `C:\Users\kazda\kiro\gtai-n4\bench.lock` exclusively (`set -o noclobber; echo <lane> > bench.lock`), delete it afterwards. If it exists and is younger than 20 minutes, skip the bench this iteration; older is stale, delete it.
- **Private app data before every gate or Godot run:** `export APPDATA=C:/Users/kazda/kiro/gtai-n4/appdata/<lane>` (create it). Parallel runs otherwise share `user://` save slots and unit tests fail by the hundreds.
- **Image generation is one at a time machine-wide:** create `C:\Users\kazda\kiro\gtai-n4\image.lock` the same way before a `codex exec` image call, delete it after. The `weapon-art` lane owns most image work; another lane that needs art writes a `REQUEST <n> -> weapon-art` in JOURNAL first.
- Keep renders short and free your Godot processes (by PID) when a capture ends. Check `df -h /c` before big renders.
- The runner gives each lane a fresh session per iteration (about 60 minutes). Commit before your session ends.

## Read first, every session
1. Your `JOURNAL.md` in your cwd (create it if missing; append as you work).
2. `git log --oneline -15`.
3. `STANDARDS.md` (§9 and the GDS limits), `AGENTS.md`, `docs/decisions.md`.
4. The evening lanes' reports: `docs/eve/2026-11-03/<lane>/REPORT.md` (arena, rivet-motion, gunplay, enemy-ai, ghost-powers, visual-fixes) and the day reports in `docs/day/2026-11-03/<lane>/REPORT.md` (especially `d5-combat` for blood and `d5-cast` for the rigs). If the merge moved them elsewhere, `git log --stat -5 -- docs/` finds them.
5. Other lanes' progress: `git -C C:\Users\kazda\kiro\gtai log --oneline main..n-<lane>` and their JOURNALs in `C:\Users\kazda\kiro\gtai-wt\n-<lane>\JOURNAL.md`. You may **cherry-pick or merge another night lane's committed work into your branch** when you need it (record it in JOURNAL); never edit another lane's worktree.
6. Before a design decision, read the governing registry subject: resolve the slug through `C:\Users\kazda\kiro\ai-registry\knowledge\game-production\index.json` (`subjects["<slug>"].file`) and read its golden path plus the techniques that fit (`realtime-combat-semantics`, `motion-quality-gating`, `sprite-and-atlas-production`, `depth-ordered-layered-art`, `combat-pacing-and-dramatic-arc`). Write in JOURNAL which rules you applied and any deviation.

## Tools
- **Godot:** `GODOT_BIN=C:\Users\kazda\kiro\gtai-spike\tools\godot\Godot_v4.7.2-stable_win64_console.exe`, with `--rendering-driver d3d12`. The native DLLs are git-ignored: copy `project/native/bin` from `C:\Users\kazda\kiro\gtai-wt\int-day` if missing (an LFS pointer is about 130 bytes). A parse error can hang a windowed run, so run new scripts with `--headless --check-only` first.
- **Gates (all must stay green):** `node tools/lint/lint.mjs`, `node tools/tests/run_unit.mjs`, `"$GODOT_BIN" --headless --path project -s res://tests/run_scenarios.gd`, `node tools/evidence/run.mjs`. Known flakes under load: `test_noir_shadows` and the `scenario_city_chase` 2 ms nav budget; re-run alone before calling them red.
- **Images:** Codex CLI `image_gen` (recipe: `C:\Users\kazda\kiro\pof\games\gtai\research\chatgpt-pro-image-route.md` §8; one `codex exec` at a time, under `image.lock`). Never name an existing comic, film, game, franchise or real weapon brand in a prompt, an asset, code or game text. Use the working names in `data/tables/weapons.json` (pistol, machine pistol, flamethrower, rocket launcher, electro gun, molotov, the nail gun "Gloria"; plasma rifle, hand cannon, ray gun, homing shard gun, mini-nuke launcher; electro baton, katana, chainsaw, plasma sword). Provenance line per AI asset in `steam/ai-provenance/2026-11.jsonl`. Art arrives as chroma-green part sheets cut into flat-fill parts that match the cutout rig (see the d5-cast report and `games/gtai/art-direction/trivet/` in the PoF repo).

## Evidence (the owner judges it in the morning, on a page that labels every frame)
- Evidence or it is not done. Unmeasured is never zero. Never fake a frame. Look at every image yourself; reject camera breaks.
- **Feel is shown in motion:** real-time clips (10-40 s, 32 px/m, plus a 48 or 64 px/m close-up for detail; `--fixed-fps` for timing-true capture). Stills only for detail sheets (a weapon design sheet, a pose lineup).
- Write `C:\Users\kazda\kiro\gtai-masters\n4\<lane>\frames.json`: `[{ "file", "title", "source": "game-city|dev-scene|concept", "branch", "look", "ppm", "before", "note" }]`, 8-15 entries that matter most, newest best first. The arena counts as `dev-scene`; the city proving block as `game-city`.

## Repo rules
- Commit on your branch, per change, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Sonnet lanes: `Claude Sonnet 5.5`). **Never push, never touch `main`.** The Director merges in the morning.
- Stay in your lane's scope. A shared file (`project.godot`, autoloads, `data/schemas/events.json`, `data/tables/input_actions.json`, `launch_args.gd`, `weapons.json`) gets a minimal change recorded in JOURNAL. A change another lane needs goes in JOURNAL as `REQUEST <n> -> <lane>`; read the other lanes' JOURNALs for REQUESTs addressed to you at the start of each session.
- Arena stations: each lane plugs content into the arena through its own `project/data/tables/arena_stations/<lane>.json` plus code in its own folder.
- Typed GDScript, at most 200 lines per file, the 60 Hz tick, the RNG registry (no global RNG), data as JSON. Determinism and replay parity hold: a change that moves the replay or parity goldens is a dated line in `docs/decisions.md` and a deliberate re-bless.
- Never touch the PoF repo. Kill only processes you started (`taskkill /F /T /PID <pid>`), never by name. Never close other windows.
- Clean as you go: delete throwaway worktrees and scratch renders you do not reference in frames.json.

## The merged main you start from (`9ebc5918`, merged at about 01:00)
- All six evening lanes are in. Their reports and journals are in `docs/eve/2026-11-03/<lane>/` (arena, rivet-motion, gunplay, enemy-ai, ghost-powers, visual-fixes); merge notes in `docs/decisions.md`.
- Gates green: lint 13/13, unit 695/695, scenarios 28/28, parity bit-exact, look 11/11 + block 5/5 (re-blessed once on the 12 m city).
- Idle bench of record now: p99 6.007 ms, 1 % low 124 fps (riot; the known `CityBlood` cost, gunplay owns the fix). **Drive p99 doubled to 3.56 ms (from about 1.7) and is not bisected**: suspects are the 12 m city's kerb furniture and parked cars, or the powers lane's city-path blood. The showcase lane benches it on every round and names the cause.
- Input bits: sprint and roll are bits 5 and 6; Hauler moved to bit 7 (Q / LB), Gearbox to bit 8 (G / RB). Look bits up by name.
- Open: gunplay's arena station draft sits in `evidence/gunplay/station-draft/`, not in `arena_stations/` (move it into `arena_stations/gunplay.json`); the arena's `range/strafe_05m` spawn lands in a building on the 12 m city (move it).
- The Godot export templates are linked into each lane's private app data (`gtai-n4\appdata\<lane>\Godot\export_templates`), so exports and the bench work under the private APPDATA.

## Director's checkpoint, 04:00 (binding from your next session)
I watched the 03:55 showcase reel, the brutality kill clips and the arsenal reels. The look is right (inked rigs, red blood, the flame burst, the corpses) and the breadth is there: nine signature kills, eleven guns, the melee line. **What fails the owner's "visual impression" test now is readability, not features:**
1. **Kills happen in clumps.** In the katana and electro clips the victim stands inside a pack of 3-5 cops; the halves, the skeleton flash and the fall overlap other bodies and the signature does not read. The lab rows of dummy cops in circles along the top of the frame pull the eye.
2. **The 32 px/m reels are an overview.** At game zoom Rivet, the gun and the victim are a few pixels; the owner cannot judge a kill there.

So from now until the freeze: **no new features unless your lane's list has an unstarted must-have; polish what exists so each piece reads in one viewing.** For every clip you add to frames.json from now on:
- the victim of a signature kill stands **alone, 2+ m from any other body**, on clean ground, no lab dummies in the frame;
- a **48 px/m camera that follows Rivet** (the 64 px/m close-up stays for detail); the kill sits in the middle third of the frame;
- the signature's key frame is held long enough to read at real time (the kill-beat hit-stop / slow-mo from the brutality table), and the clip shows the aftermath for 1-2 s;
- re-check your own top 3 entries against this and replace those that fail.
Bench numbers tonight are all CONTENDED (six lanes); don't chase them further, except the brutality rocket-kill first-frame spike.

## Extension, 09:00-11:00 (owner, 08:30: "continue with the lanes 2 more hours, I won't be available sooner to check")
The run continues until 11:00 (freeze 10:30, report 10:40). Your 08:40 REPORT stands; at 10:40 update it in place (same file), adding what changed after 09:00, rather than writing a second one.
- The 04:00 checkpoint rule still binds: polish what exists so it reads in one viewing; a new piece only if it can be built, tested and filmed before 10:30.
- Pick up what your 08:40 REPORT lists as open or deferred (merges you skipped for lack of time, REQUESTs, clips that fail the readability rule) first.
- showcase: the final round moves to 09:45-10:30: last merge, gates, the final directed reel (`reel-<HHMM>.mp4`) and the exe, with the play commands in REPORT.
