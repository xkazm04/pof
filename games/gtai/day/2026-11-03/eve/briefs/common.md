# RTAI evening run: the combat arena, 2026-11-03 until 00:00 (common brief for every lane)

You are one lane of a run on **RTAI: Uprising** (internal id `gtai`, Godot 4.7.2 + a GDExtension C++ city sim). The game repo is `C:\Users\kazda\kiro\gtai` (github.com/xkazm04/rtai). **Your lane works in its own git worktree (your cwd), on its own branch, cut from today's merged main**: the eight day lanes are in it (D5 city, blue cops, red blood, vehicles, body collisions and tackles, the quest 1 slice with bound input, autosave, audio).

## The owner's direction for tonight (verbatim, 19:10)
"Combat, Movement, AI behavior, Animations are now the weakest part we need to focus on before development of story, quests, static visual bugs and worldbuilding. We will need a test environment like shooting range or arena to design weaponery, test, design enemies and movement of both enemies and player, design and execute ghost powers, execute animations. Run daily run until 0:00 with this part where I can react to design decisions to create baseline for the arena, nightly run will then perfect all the mentioned aspects. Smooth combat on long and melee range would be the core piece of game we need to master."

And on Rivet: "Main character does not look like art concept, it is too large and large arms. It has no directional movement, no movement animation, no melee attack if without weapon."

## The owner's design decisions (binding, 19:20)
1. **The test environment:** a dedicated dev arena (shooting range, an open pit with cover, an obstacle course, a powers pad, a live tuning panel) **plus one cordoned block of the real generated city** as the proving ground. A value is tuned in the arena and must also hold in the city block.
2. **Ranged combat: twin-stick with visible bullets.** The mouse aims freely while Rivet strafes. Bullets travel and can be dodged, with tracers. Light aim assist on the pad only. Enemy shots must be readable and dodgeable.
3. **Bare-handed melee:** a 3-hit claw combo on click, a charged electroshock (stuns; chains to metal), and the sprint tackle (already built by the collisions lane: a sprint over 5 m/s knocks humans down). Melee stays viable all game.
4. **Ghost powers prototyped first:** **Hauler** (Rivet becomes the bulky ghost tank for N seconds: stomp, ram; a body-class change) and **Gearbox** (remote-hijack a car in view and drive it into enemies; the soul-hijacked car state exists).
5. **The goal is smooth combat at long range and in melee.** Story, quests, static visual bugs and worldbuilding are not tonight's work.

Standing verdicts from this morning still bind: D5 is the look; red is blood only; cops are blue; vermilion only for danger, objectives and Rivet's collar; teal only for souls; Rivet is only slightly larger than a human; the soul TRAIL stays off (powers are not the trail).

## Owner decisions during the evening: ASK, never block
The owner is at the machine until 00:00 to react. When you reach a real design fork (feel, look, numbers a player would notice), do not stop and do not guess silently:
1. Write `C:\Users\kazda\kiro\gtai-eve\decisions\asks\<lane>-<n>.json`:
   `{ "id": "<lane>-<n>", "lane": "<lane>", "question": "...", "options": [ { "key": "A", "label": "...", "tradeoff": "one line", "frames": ["<abs path to a frame or clip>"] } ], "default": "A", "asked": "<HH:MM>" }`.
   Give 2-4 options, each with evidence the owner can look at (a frame, a short clip, a number). Put your recommendation as `default`.
2. Carry on with the default. Build so the choice is one data value or flag, so switching later is cheap.
3. Answers arrive in `C:\Users\kazda\kiro\gtai-eve\decisions\answers.json` (`{ "answers": [ { "id", "choice", "note", "at" } ] }`). **Re-read it at the start of every iteration and every ~20 minutes**, apply any answer to your asks, and record it in JOURNAL and `docs/decisions.md`.
Ask few, good questions: 2-4 per lane in the evening is plenty.

## The shared machine (seven lanes, one GPU)
- Every performance number is **CONTENDED** unless you say otherwise.
- **Bench one at a time:** create `C:\Users\kazda\kiro\gtai-eve\bench.lock` exclusively (`set -o noclobber; echo <lane> > bench.lock`), delete it afterwards. If it exists and is younger than 20 minutes, skip the bench this iteration; older is stale, delete it.
- Keep renders short and free your Godot processes (by PID) when a capture ends.
- The runner gives each lane a fresh session per iteration (about 45 minutes in the evening). Commit before your session ends.

## Read first, every session
1. Your `JOURNAL.md` in your cwd (create it if missing; append as you work).
2. `git log --oneline -15`; `C:\Users\kazda\kiro\gtai-eve\decisions\answers.json`.
3. `STANDARDS.md` (§9 and the GDS limits), `AGENTS.md`, `docs/decisions.md`, and the day lanes' reports in `docs/day/2026-11-03/<lane>/REPORT.md` (especially `collisions`, `slice-play`, `d5-combat`, `d5-cast`, `vehicles`).
4. Before a design decision, read the governing registry subject: resolve the slug through `C:\Users\kazda\kiro\ai-registry\knowledge\game-production\index.json` (`subjects["<slug>"].file`) and read its golden path plus the techniques that fit. Write in JOURNAL which rules you applied and any deviation.

## Tools
- **Godot:** `GODOT_BIN=C:\Users\kazda\kiro\gtai-spike\tools\godot\Godot_v4.7.2-stable_win64_console.exe`, with `--rendering-driver d3d12`. The native DLLs are git-ignored: copy `project/native/bin` from `C:\Users\kazda\kiro\gtai-wt\int-day` if missing (an LFS pointer is about 130 bytes). A parse error can hang a windowed run, so run new scripts with `--headless --check-only` first.
- **Gates (all must stay green):** `node tools/lint/lint.mjs`, `node tools/tests/run_unit.mjs`, `"$GODOT_BIN" --headless --path project -s res://tests/run_scenarios.gd`, `node tools/evidence/run.mjs`. Known flakes under load: `test_noir_shadows` and the `scenario_city_chase` 2 ms nav budget; re-run alone before calling them red.
- **Images:** Codex CLI `image_gen` (recipe: `C:\Users\kazda\kiro\pof\games\gtai\research\chatgpt-pro-image-route.md` §8; one `codex exec` at a time; never name an existing comic, film, game or franchise in a prompt). Provenance line per AI asset in `steam/ai-provenance/2026-11.jsonl`. Most of tonight is code, data and motion, not new art.

## Evidence (the owner reviews it on a page that labels every frame)
- Evidence or it is not done. Unmeasured is never zero. Never fake a frame. Look at every image yourself; reject camera breaks.
- **Feel is shown in motion:** a short real-time clip (10-25 s, 32 or 48 px/m, `--fixed-fps` for timing-true capture) beats a still for anything about movement, animation or combat. Pair it with numbers (time to kill, hit rate, input-to-motion latency, turn rate).
- Write `C:\Users\kazda\kiro\gtai-masters\eve\<lane>\frames.json`: `{ "file", "title", "source": "game-city|dev-scene|concept", "branch", "look", "ppm", "before", "note" }`, 8-15 entries that matter most. The arena counts as `dev-scene`; the city proving block as `game-city`.

## Repo rules
- Commit on your branch, per change, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Never push, never merge, never touch `main`.** The Director merges at 00:00 with the owner, then a night run continues from the merged main.
- Stay in your lane's scope. A shared file (`project.godot`, autoloads, `data/schemas/events.json`, `data/tables/input_actions.json`, `launch_args.gd`) gets a minimal change recorded in JOURNAL. A change another lane needs goes in JOURNAL as `REQUEST <n> -> <lane>`.
- **Arena stations:** the `arena` lane owns the arena scene. Every other lane plugs its content in through its own data file `project/data/tables/arena_stations/<lane>.json` (one file per lane, so branches never conflict) plus code in its own folder. Until the arena exists on your branch, prove your work in your own small dev scene under `project/dev/<lane>/`.
- Typed GDScript, at most 200 lines per file, the 60 Hz tick, the RNG registry (no global RNG), data as JSON. Determinism and replay parity hold: a change that moves the replay or parity goldens is a dated line in `docs/decisions.md` and a deliberate re-bless.
- Never touch the PoF repo (except the `pof-arena` lane, whose repo it is). Kill only processes you started (`taskkill /F /T /PID <pid>`). Check `df -h /c` before big renders.

## The merged main you start from (`baf2e80`, merged 20:45)
- All eight day lanes are in. Their reports are in `docs/day/2026-11-03/<lane>/REPORT.md`; the merge notes in `docs/day/2026-11-03/int-day/` and `docs/decisions.md`.
- Gates green at `a5019f2`: lint 13/13, unit 537/537, scenarios 19/19, parity exact, look goldens re-blessed once.
- **Known open on main (not yours unless your brief says so):** the riot-scene p99 doubled (2.4 -> 4.8 ms, still under 7 ms; cost is outside the rigs; bisect patches in `gtai-masters/day-d5/d5-cast/perf-bisect/`); `scenario_vehicle_yield` gridlocks with the car parked 24 m down the lane (moved to 32 m); quest 1's session has no vehicle service, so the car cannot be driven in the exe; combat's blood only shows in the old quest-1 view.
- Bench numbers of record (idle): p99 4.835 ms, 1 % low 176 fps. Measure your own change against these, never against an earlier morning.

## Owner direction 21:25 (binding, overrides the work order where they conflict)
**The owner, verbatim:** "i don't think this state is judgable. We don't have weapon design, final animation, oponent reaction on hit. The visual impression is the key for judgement and we need to go all the way in with the design"

What this means for every lane, from now until 00:00 and for the night run:
1. **Depth before breadth.** Finish ONE thing to final quality before starting the next: the first weapon fully designed, held, fired and landing on an enemy who reacts, before the second weapon. A numbers table over six debug weapons is not progress the owner can judge.
2. **The full chain of a hit, in the game's look (D5 inked grime), never debug circles:**
   - the weapon is designed: its art, held in Rivet's claw on the rig, and readable at 32 and 48 px/m;
   - the attacker's animation: windup, recoil, muzzle flash, and the shell or spark;
   - the projectile: tracer and travel;
   - the impact: hit flash, hit-stop, shake and knockback;
   - the opponent's reaction: a flinch or stagger in the direction of the hit; the knockdown; a death animation; blood (red, from d5-combat) on humans and sparks or oil on robots;
   - the sound hook.
3. **Real characters only.** Enemies are the cast rigs (cop, riot cop, SWAT, robots) on the arena floor, not labelled circles. A lane that only has debug shapes builds the rig and the animation first.
4. **Questions (asks):** every open ask is answered "default as a placeholder". Do not tune it further on numbers. An ask is valid only when its options are shown as **real-time clips in the final look, with the full hit chain**. Stills and tables are supporting evidence, never the basis of a question. Tuning numbers are your call; write them in JOURNAL.
5. **Image generation is allowed for weapon and character art** (the Codex `image_gen` route, one at a time, the provenance line). Use original names only.
6. **The vertical sample the owner judges at 00:00:**
   - Rivet with the concept proportions and his locomotion;
   - one finished gun (the pistol) and one finished melee move (the claw combo);
   - against a patrol cop and a robot thug, both with full hit reactions and deaths;
   - in the arena, with Gearbox or Hauler as one finished power if it fits.

   One 20-40 s clip per lane, showing its part of that sample, at 32 px/m.

## Test isolation (found by visual-fixes, 22:20)
Six lanes run Godot at once and share the `user://` save slots, so unit runs fail by the hundreds when two overlap. Before the gates, give your shell a private app-data folder: `export APPDATA=C:/Users/kazda/kiro/gtai-eve/appdata/<lane>` (create it). With that, unit is 538/538.
