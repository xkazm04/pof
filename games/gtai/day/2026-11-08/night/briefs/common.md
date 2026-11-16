# RTAI night run n10 (2026-11-08 21:00 to 2026-11-09 09:00): four lanes

You are one of four lanes in an unattended night run on **RTAI: Uprising** (internal id `gtai`), built in Godot 4.7.2 with a GDExtension C++ city sim, repo `C:\Users\kazda\kiro\gtai`. Your cwd is your own git worktree on branch `n10-<lane>`, cut from main `9bbe6d0a` (lane `world` from `c394af55`, main plus the true-70 block test).

## Where the game is
- Main boots **combo** (70 degrees in play, 55 in boss fights), bikes 6 %, BC7 in every build. Rivet is 1.65 m with a walk and run that plant. Quest 1's freeze (F-19) is fixed with mailbox vsync.
- **Owner's verdicts 2026-11-08 (in `docs/decisions.md`, do not reopen):** every n9 lane call stays as built. The city's camera is a **true 70 degrees**, walls stay at **half height** (`city_facades.json` `height_k` 0.5), the **grey print look stays** (do not make the brick red).
- Reports from n9: `docs/day/2026-11-08/<lane>/REPORT.md`.

## The owner is asleep: decide, never block, never ask
At a design fork, build what best serves the owner's verdicts, make the alternative one data value or flag, and record it as `DECISION` in JOURNAL and `docs/decisions.md`. Forks worth judging go in REPORT under `## Calls for the owner`, each with a frame or clip.

## When your queue is really empty, stop
This run has a finite usage budget, and last night four lanes drained a week's limit. Do not invent features to fill time. When your brief's list is done or blocked, write `QUEUE EMPTY: <what is done, what is blocked>` in JOURNAL, make sure your work is committed, and end the session. If the journal already says so and nothing has changed, end at once. **Work that would be nice but is not on your list goes in REPORT's next steps, not in the tree.**

## The shared machine
- Every performance number is **CONTENDED** unless you say otherwise.
- **Bench one at a time:** create `C:\Users\kazda\kiro\gtai-n10\bench.lock` exclusively (`set -o noclobber; echo <lane> > bench.lock`), delete it afterwards; if it exists and is younger than 20 minutes skip the bench this iteration, older is stale.
- **Before every Godot or gate run:** `export APPDATA=C:/Users/kazda/kiro/gtai-n10/appdata/<lane> TMP=C:/Users/kazda/kiro/gtai-n10/tmp/<lane> TEMP=C:/Users/kazda/kiro/gtai-n10/tmp/<lane>`.
- **Never delete `project/override.cfg`** (it keeps windows on the secondary monitor); pass `--screen 0` if you set your own window flags.
- **Images:** do not run image generation yourself. Write `REQUEST <n> -> assets: <what, angle, size, the reference paths>` in JOURNAL; the asset lane (`kiro/gtai-assets`, library `kiro/gtai-art/library`) reads the lane journals. Check `library/deliveries/` for what arrived, and build around a late delivery rather than waiting on it.
- The runner gives you a fresh session of about 60 minutes per iteration. Commit before your session ends.
- Never name an existing comic, film, game, franchise or real weapon brand in a prompt, asset, code or game text.

## Read first, every session
1. `JOURNAL.md` in your cwd (create it if missing; append as you work).
2. `git log --oneline -15`.
3. `AGENTS.md`, `STANDARDS.md`, and the last 40 lines of `docs/decisions.md`.
4. The other lanes' JOURNALs (`C:\Users\kazda\kiro\gtai-wt\n10-<lane>\JOURNAL.md`), for a `REQUEST -> <you>`. You may merge another night lane's committed work into your branch (record it); never edit another lane's worktree.
5. Before a design decision, the governing registry subject: resolve the slug through `C:\Users\kazda\kiro\ai-registry\knowledge\game-production\index.json` (`subjects["<slug>"].file`).

## Tools
- **Godot:** `GODOT_BIN=C:\Users\kazda\kiro\gtai-spike\tools\godot\Godot_v4.7.2-stable_win64_console.exe`, with `--rendering-driver d3d12`. Native DLLs are in `project/native/bin`.
- **Native:** `just` is NOT on PATH. Build with `cd native && scons platform=windows arch=x86_64 target=template_debug` and `target=template_release`, after any native change.
- **Fast loop:** `node tools/tests/run_unit.mjs --changed` (or `--select=`); the full run before an item is done.
- **Gates (green):** `node tools/lint/lint.mjs`, `node tools/tests/run_unit.mjs`, `node tools/evidence/run.mjs --no-bench` (keep the log outside the tree), and the director reel in top, tilt70 and combo with **`--quit-after 40000`** (owner, 2026-11-08; 16000 cuts it off): `"$GODOT_BIN" --headless --path project --quit-after 40000 res://dev/arena/arena.tscn -- --rigs --bot=reel --reel=director --view=<v>`, expecting 19 chapters fully down and 0 SCRIPT ERROR.
- **Filming:** `--view=<id>`, `--rigs`, `--ppm=<n>`, `--write-movie <abs path>`, `--fixed-fps 60`, `--quit-after`, `--seed=<n>`. City block stills: `res://dev/showcase/block70_still.tscn` (lane world's branch).
- **Provenance:** when an AI image enters the game repo, append a line to `steam/ai-provenance/2026-11.jsonl` with the library's `round` and `prompt_hash`.
- **Exe:** at the freeze, `"$GODOT_BIN" --headless --path project --export-release windows-showcase ../build/export/windows/RTAI.exe`, and name it in REPORT with the exact command.

## Evidence
Evidence or it is not done. Unmeasured is never zero. Never fake a frame. Look at every image yourself. Clips and stills go in `C:\Users\kazda\kiro\gtai-masters\n10\<lane>\`: a before/after at 32 px/m plus a close-up at 48 or 64 px/m per subject. `frames.json` there: `[{ "file", "title", "source", "branch", "ppm", "view", "before", "note" }]`, 8-15 entries, best first.

## Repo rules
- Commit on your branch, one commit per change, each message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Never push, never touch `main` or another lane's branch.** The Director merges.
- Banned: `git stash`, `git add -A/./-u`, `git commit -a`, `reset --hard`, `--no-verify`. Stage per path.
- Typed GDScript, at most 200 lines per file, the 60 Hz tick, the RNG registry, data as JSON. New launch flags go into `LaunchArgs.KNOWN_FLAGS`. View code reads the sim and never writes to it. Replay and parity hold.
- Never touch the PoF repo or the asset library (read only). Kill only processes you started (`taskkill /F /T /PID <pid>`), never by name.
- Delete scratch renders and raw `.avi` captures that `frames.json` does not reference.

## Run times
**Commit often and keep `REPORT.md` current from your first hour: this run can lose its billing without warning, as last night's did at 09:08, and the freeze session may never come.** Freeze at 08:30 (finish, export the exe, commit); `REPORT.md` final by 08:40, covering what works with its evidence; what does not; what blocked you and for how long; Calls for the owner; next steps.
