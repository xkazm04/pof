---
name: gta
description: Continue the dual development of the game GTAI: Uprising and the PoF tool that manages it, from wherever the last session ended. Every run reads the current state (games/gtai/STATE.md, the design baseline, the overnight-spike workspace, git, fleet memory, the live PoF game workspace), shows the owner a short state brief, agrees today's or tonight's plan with them (the handshake), then executes it so that every game-development operation goes through a PoF pipeline, and any PoF gap the game exposes becomes PoF work. It ends by writing the new state back. Invoke with /gta, /gta status, /gta night, /gta morning.
---

# /gta: GTAI: Uprising + PoF, developed together

> The game is the proof that PoF works. PoF is how the game gets made.

Every session continues the same campaign. Nothing important lives only in a conversation:
- **`games/gtai/STATE.md`** is the campaign's memory: phase, decisions, next steps, PoF gaps and the session log.
- **`games/gtai/pitch.md`** is the design truth: tagged **[owner]**, **[proposal]** and **[open]**, plus the open-decisions table.

This skill reads both at the start and writes STATE.md at the end.

## Modes

| Invocation | What it does |
|---|---|
| `/gta` | State brief, then handshake, then execute, then wrap. The default |
| `/gta status` | State brief only. Change nothing |
| `/gta night` | Handshake about unattended work. Then **prepare everything before the owner leaves** (prep, preflight GO), launch, and report what is running |
| `/gta morning` | Review what ran overnight (scoreboard, evidence, journals, cost), take the owner's verdicts, record them, then plan the day |

## 1. State brief: always, before any question

Run these and read the results. Do not skip any, and do not trust memory over them:

1. `git fetch -q; git status --porcelain | head -40; git log --oneline -15 -- games/gtai src/lib/games .claude/skills/gta`
   - Note foreign WIP. Never sweep it into a commit.
2. Read `games/gtai/STATE.md` in full. Read `games/gtai/pitch.md` §10 (open decisions).
3. `grep -nE "\[(gtai|games)\]" .claude/fleet-memory.md | tail -8`. Follow the DECISION lines; never contradict one silently.
4. Overnight work. If `C:\Users\kazda\kiro\gtai-spike\spike.json` exists, run `node games/gtai/spike/spike.mjs status`. If `SCOREBOARD.md` exists there, read it.
   - When a lane says `LIMIT` or `BLOCKED`, or the billing line says the key was drained, report it plainly.
5. Live PoF.
   - Check whether the dev server on :3001 answers: `curl -s -m 5 localhost:3001/api/games/gtai/intake`. Port 3000 is Vibeman, not PoF.
   - If it is up, report pending intake proposals and whether the pitch is still a placeholder. If it is down, say so. Do not start one unless the plan needs it.
6. `df -h /c`. The drive has hit 0 bytes before.

Then print the **state brief**, at most about 15 lines:
- the phase and its exit criterion;
- what changed since the last session entry in STATE.md (commits, overnight results);
- the owner decisions that are still open, with the most blocking first;
- the top 3 next steps from STATE.md;
- anything broken.

## 2. Handshake: agree the plan before working

Use **one** `AskUserQuestion` call, with up to 4 questions:
- **Session shape:** a day session (interactive, owner in the loop) or a night session (unattended, until a set time).
- **What to do:** 2 to 4 concrete options built from STATE.md's next steps and the open decisions. Put the recommended option first, marked "(Recommended)". Write the trade-off in each option's description. Use multiSelect when the items can be combined.
- **Owner decisions that block progress.** Ask them directly, as single-select questions with the scouted options; for example camera pitch or art variant.

Rules:
- The handshake **decides**; it is not ceremony. When the owner answers with a doctrine rather than an option, it outranks the options. Record it.
- Never ask what STATE.md, pitch.md or the repo already answers.
- Write the agreed plan into STATE.md's session log **before** starting work (`### <date> <day|night>: plan`). A killed session then loses nothing.

## 3. Execute: dual development

**The game's operations go through PoF.**
- Canon goes through the pitch intake in the Canon view (`/layout?g=gtai`, then Canon).
- Missions and branches go through the story-decision-graph (`/story`).
- Assets go through the catalog pipelines in the GTAI manifest (`src/lib/games/gtai.ts`), and acceptance through the derived acceptance ladder.

The owner must be able to open the PoF UI and see the current state of each operation in its pipeline page.

**When PoF cannot do an operation the game needs**, that is the point of the campaign, not an obstacle:
1. Record it in STATE.md under `## PoF gaps found by the game`: what was needed, what PoF lacked, and its severity.
2. Then do one of two things:
   - **(a)** build the missing PoF capability. Use `/spark` for a feature-sized gap, or a direct fix for a small one.
   - **(b)** do the game step by hand *this once*, and mark the gap `worked around`.

   Ask in the handshake which one to take when the gap is bigger than an hour.

**Tools that already exist. Reuse them; do not reinvent them:**

| Need | Tool |
|---|---|
| A design fork with no agreed shape | `/contest` (all CLI providers with remaining usage may be seated for GTAI; fleet DECISION 2026-11-01) |
| A PoF feature | `/spark` |
| Engine choice, or other overnight engineering experiments | `games/gtai/spike/spike.mjs` (`init`, `prep`, `preflight`, `run`, `status`, `report`) |
| Concept art | `POST /api/visual-gen/generate-2d` (Leonardo, or `qwen-image` when Leonardo's API credit is out), or the owner pastes `games/gtai/art-direction/LEONARDO-PROMPTS.md` into Leonardo |

The concept-art row is for concept art only. **Production assets are Blender + code** (fleet DECISION 2026-11-01).

## Night sessions

A night session is development only. Everything else happens **before the owner leaves**:
1. Downloads, project bootstrap and toolchain proofs: `spike.mjs prep` or its equivalent.
2. Preflight must be GO. Check sleep (`powercfg /change standby-timeout-ac 0`), that Unity Hub is running (Unity batchmode takes its licence token from the Hub), and disk.
3. Billing follows the owner's rule: **drain the Anthropic API key in `.env` first, then the Claude subscription.**
   - `spike.mjs run` does this by default (`--billing api-first`). It switches every lane when the key is refused or out of credit, and records the switch in `billing.json`.
   - The key line in `.env` may be spelled `ANTRHOPIC_API_KEY`; both spellings are read.
4. Launch, confirm the first iteration of every lane started (`spike.mjs status`), and give the owner the exact morning command.
5. Write the night plan and the launch time into STATE.md.

Unattended runs need clear briefs. Each lane brief carries the honesty rules: evidence or it is not done; unmeasured is not zero; never fake a frame. It also says to kill only your own PIDs, and never to touch the PoF repo or the PoF UE project.

## Morning sessions

1. `node games/gtai/spike/spike.mjs report`, then open `compare.html` and `SCOREBOARD.md`. Read every lane's `REPORT.md` and its top frictions.
2. **Open the evidence files themselves** (frames, `autoplay.json`, the build exe). Never accept a scorecard on its own word.
3. The owner plays each build and gives verdicts. Record them in STATE.md and, for design decisions, in pitch.md (move the item from **[open]** to **[owner]**).
4. Re-plan the day from the results.

## 4. Wrap: every session, even a short one

1. **STATE.md:**
   - append the session log entry: done, evidence (commits, files), what is still open;
   - update `## Now` (phase, next 3 steps), the decisions log and the PoF gaps.
2. **pitch.md:** any owner decision taken today moves from **[open]**/**[proposal]** to **[owner]**, with the date.
3. **Commit your own paths only:** `git add <paths>`, then `git commit --only <paths>`. Never push. Never `git add -A` or `.`. After committing, confirm with `git log --oneline -1`.
4. **Fleet memory:** at most 2 lines (a DECISION and/or DELIVERED, tagged `[gtai]`), committed with `git commit --only .claude/fleet-memory.md`. If the file is over 200 entries, run `node scripts/fleet-memory-cap.mjs --prune` and commit both files.
5. **Auto-memory:** keep `project_gtai_uprising.md` current. It holds the phase, the next step and the blockers.
6. **End with:** what is done, what is next, and what is waiting on the owner.

## Repo law that applies here
- Read `.claude/CLAUDE.md`.
- Commit on the current branch and never push.
- Never `git stash` or `git reset --hard`.
- Never kill processes by name.
- Docs stay in sync with structural changes; `docs/architecture/game-workspaces.md` covers games.
- PoF code conventions: `@/` imports, `logger` instead of console, no hex colours, and the API envelope.
