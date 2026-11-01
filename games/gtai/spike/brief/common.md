# GTAI engine spike: lane rules (every lane reads this)

You are one of several lanes running **in parallel overnight** on the same machine. Each engine lane builds the
same MVP (`MVP.md`, beside this file) in a different engine. An art lane feeds them a shared asset pack. In the
morning the owner plays every build and picks the engine for **GTAI: Uprising**, a top-down crime sandbox in the
GTA 2 lineage, about 5 hours long, shipping on Steam.

**What is being measured** is how hard it is to build a great-feeling 2D or 2.5D top-down action game in your
engine, with an AI agent doing the work. Your honest record of friction is worth as much as your build. A lane that
hides its struggles makes the decision worse.

## Already prepared: the night is for development
The host ran environment prep before launch, and `PREP.md` in your lane folder records it:
- the engine, templates and packages are installed;
- `project/` is bootstrapped;
- one build or export was proven end to end.

So:
- **Do not re-download or re-create the project.** Start from `project/`.
- You may restructure it freely. It is your project.
- If a `PREP.md` step says FAIL, fixing it is your first job. Log the time as FRICTION.

## The clock
- The runner tells you, in every prompt, the current time and three times: **freeze**, **report** and **deadline**.
- Before freeze: build and polish.
- After freeze: only fix bugs, run the automation, and record evidence.
- At report time the runner starts a final session that writes `REPORT.md` and `scorecard.json`.
- You work in **iterations**. Each runner prompt is a fresh session with no memory except your files. `JOURNAL.md` is your memory.

## JOURNAL.md: append-only, the most important file you write
- At the **start** of every iteration, read `JOURNAL.md` (create it if missing) and the last 30 lines of `git log --oneline`.
- **During** the iteration, append timestamped entries: `- [HH:MM] <what you did, what happened>`. Use these markers:
  - `MILESTONE: <checklist item> - evidence: <file>`, when an MVP checklist item first works.
  - `FRICTION: <minutes lost> min - <what fought you> - <how you got past it, or "unresolved">`. Write one for **every** obstacle over about 5 minutes, and be honest.
  - `BLOCKED: <what needs a human>`. Then work around it and keep going.
  - `LOOP: <seconds>`. Measure the edit-to-visible-change loop at least three times during the night (change a constant, see it in game) and log each.
- At the **end** of every iteration (or when you sense the session getting long), append `NEXT:` with the 3 most valuable next steps, so the next session starts warm.

## Git: your own repo only
- Run `git init` in your lane folder on the first iteration. Commit early and often with clear messages: the commit timeline is evidence.
- Never touch any other git repository. In particular, never touch `C:\Users\kazda\kiro\pof` or `C:\Users\kazda\Documents\Unreal Projects\PoF`.
- Add the engine's cache folders to `.gitignore` (Library/, .godot/, Intermediate/, Saved/, DerivedDataCache/, Binaries/, build/).

## The machine is shared tonight. Hard rules:
- **Never kill a process by name** (`taskkill /IM`, `Stop-Process -Name`, `pkill`). Another lane runs the same engine executables. Kill only a PID **you** started: record the PID when you start something.
- Do not change system settings, drivers, the global PATH, or other lanes' folders. Read `../../shared/` only. The art lane alone writes `../../shared/assets/`.
- **Every file you write goes inside your lane folder**, scratch and debug output included. Use `scratch/` for throwaway output; never write to `C:\out`, `%TEMP%` paths you cannot clean, or a drive root. Pass absolute lane paths to Blender and engine tools, because a relative `//out` or `/out` resolves outside the lane. (Pre-check, 2026-11-01: a Blender render landed in `C:\out\`.)
- Close the editors and game processes you start when you are done with them. Leave nothing running at the end of an iteration except what you have deliberately backgrounded and logged.
- Disk: keep your lane under about 40 GB. Delete your own build intermediates if you approach that.
- Network: allowed for docs, engine packages and downloads you need. Log each download in the JOURNAL.

## Honesty rules
- A checklist item is done only when there is **evidence** you produced: a screenshot or log from a real run of the game. "It compiles" is not done. "Should work" is not done.
- Unmeasured is not zero. If you could not measure FPS, write `null` and say why.
- Never fake a frame, a video or a number. A false scorecard is the worst possible outcome of this night.

## The final scorecard (written in the report iteration, at `scorecard.json`)
```json
{
  "lane": "ue|godot|unity|art",
  "engine": "name", "engineVersion": "x.y.z",
  "approach": "one line: e.g. 'Paper2D sprites', '3D low-poly + ortho camera + post shader', 'Sprite2D + rotated sheets'",
  "minutesToFirstPlayable": 0,
  "minutesToMvpComplete": null,
  "checklist": { "move": false, "aim": false, "shoot": false, "reload": false, "roll_iframes": false,
                 "hit_react": false, "death_anim": false, "walk_cycle": false, "idle": false, "ai_opponent": false,
                 "round_flow": false, "kill_bark": false, "style_applied": false, "shared_assets_used": false,
                 "autoplay": false, "stress": false, "video": false, "windows_build": false, "melee_stretch": false },
  "evidence": { "<checklist key>": "relative path to the proof" },
  "stretch": { "readability": null, "car": null, "crowd": null, "soul_swap": null, "gamepad": null },
  "stretchNote": "per item: an evidence path when done, null when not reached; one line on what was hardest",
  "loopSeconds": [0, 0, 0],
  "buildSeconds": null, "buildSizeMB": null, "coldStartSeconds": null,
  "autoplay": { "avgFps": null, "minFps": null },
  "stress": { "robots": 60, "avgFps": null, "p1LowFps": null },
  "frictionMinutesTotal": 0,
  "blockedOnHuman": ["..."],
  "headlessAutomation": "full|partial|none - can an agent build, run and capture frames with no human?",
  "agentFriendliness": "1-5 with one sentence: how well text-only tooling could drive this engine",
  "wouldShipGtaiOnThis": "yes|maybe|no - two sentences, honest"
}
```

## REPORT.md (also written in the report iteration)
At most 2 pages:
1. What you built, and how to run it (the exact command for the build and for `--autoplay`).
2. A timeline of milestones.
3. The top 5 frictions, ranked by minutes lost.
4. What a full 5-hour game would cost in this engine: the top three risks for vehicles, a city of blocks, 60+ actors, many animations, and Steam.
5. Your verdict.
