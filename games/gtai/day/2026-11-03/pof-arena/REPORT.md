# pof-arena - report (final, 2026-11-03 evening, written 23:40)

Branch `gtai-arena` (PoF repo, 44 commits over `master`). Evidence folder: `C:\Users\kazda\kiro\gtai-masters\eve\pof-arena\` (`frames.json` lists 38 screenshots; every file named below was checked to exist at 23:40). Live server for the owner: `http://localhost:3013` on the live roots, read-only (restart recipe `start-pof-arena-live.cmd` in the evidence folder). The owner's `:3001` has the rooms only after the 00:00 merge.

## What works

### 1. Decisions room (`/layout?g=gtai&c=spellbook&v=game&room=decisions`)
- Reads `gtai-eve/decisions/asks/*.json`, open first and newest first, options side by side, the lane default tagged, frames and clips inline, choice + note + Save. Answered questions move below with the answer. Polls, so a new ask shows without reload.
- **Live state at 23:40:** 11 asks on disk, 11 answered, 0 open, 0 problems (`curl localhost:3013/api/games/gtai/decisions`). The owner answered through this page; `answers.json` was read fine, including a pretty-printed 1-space file written by someone else.
- Write safety: tmp file + rename, one entry per ask id, earlier answers and unknown keys kept, a changed answer logs the old one to `answers.history.jsonl`, an unreadable `answers.json` is refused, ask files are never written (test: `src/__tests__/games/decisions/`, incl. concurrent readers).
- Human gate: same-origin + page token (the Voice room's gate); agents and the CLI get 403 (`src/__tests__/api/decisions-gate.test.ts`).
- Media is served only by (ask, option, index) from paths an ask lists: png/jpg/webp/gif/mp4/webm with byte ranges, text frames (.md/.txt/.csv/.log, 1 MB cap) as plain text. A clip still being encoded offers Retry.
- Lane output that was malformed is read instead of hidden: BOM/UTF-16 tolerant, and single-backslash Windows paths repaired once on a failed parse (`src/lib/games/laneJson.ts`, `src/__tests__/games/laneJson.test.ts`). That rescued `visual-fixes-1`.
- Evidence: `decisions-1440-open.png`, `decisions-1440-picked.png`, `decisions-1440-saved.png` (full browser flow on a fixture, `answers.json` updated), `decisions-390-open.png`; live read-only: `decisions-live-it16-1440.png`, `decisions-live-it16-390.png`, `decisions-live-textframe-1440.png`, `decisions-live-ai2-1440.png`, `decisions-live-visualfixes-repaired-1440.png`.

### 2. Combat lab (`room=combat`)
- Weapons (12 rows), enemy archetypes (4), powers (5) and melee (2, from rivet-motion's real `rivet_melee.json`, one row per hit with derived `windup_s`/`cycle_s`), each labelled with its source. Source picker: auto (game root first, then each lane worktree), main, any lane, engine `user://`. A missing table says what is missing and where it is expected, not a zero.
- Arena stations table from the lanes' `arena_stations/<lane>.json` (`stations` arrays; a station carried by two worktrees lists once, the owning lane's copy winning).
- Telemetry sessions (5 live: range, pit, course, city, city-clip) read from `e-arena/evidence/arena/` and `user://arena/`; `ttk_s` per spawn id, -1 latency and no-shot hit rate read as "not recorded"; pit/course columns appear only when a session has them.
- Time-to-kill-by-range chart: measured bars from a session, plus a table-derived (perfect-shooter) model with target and range pickers, labelled as a model. Uses shared `ChartPanel` (new optional `valueText` so bars print `1.00s`, not `1s`) and `DataTable` (header wrap fix; snake_case ids wrap after the underscore).
- Evidence (live roots, read-only): `combat-live-full-1440.png`, `combat-live-full-390.png`, `combat-live-it17b-1440.png`, `combat-live-it17b-390.png`, `combat-live-measured-1440.png`, `combat-live-melee-1440.png`, `stations-live-it15-1440.png`; fixtures: `combat-fixture-1440.png`, `combat-realschema-fixture-1440.png`.
- Tests: `src/__tests__/games/combatLab/` (combatLab, combatLabRealSchema, meleeRecords, readStations), `src/__tests__/api/combat-lab-route.test.ts`, `src/__tests__/components/layout-lab/combatLabRoom.test.tsx`, `src/__tests__/components/layout-lab/decisionsRoom.test.tsx`, `decisionTextFrame.test.tsx`.

### 3. Gates
- `npm run validate` green at `be4500ae`: 1987 files, 15276 tests passed, 0 failed (`validate17.log` in the evidence folder). Tip `738c61a3` is only a fleet-memory line over that commit. Earlier full runs showed single load flakes in unrelated files (`stage-render`, `useDeepEvalResults-project-scope`, `debug-snapshot-hook`) that pass alone.
- `docs/architecture/game-workspaces.md` documents both rooms, the real schemas, the gate and the config (`GameDef.decisions`, `GameDef.combatLab`, env `POF_GAME_DECISIONS_GTAI`).

## What does not work / honest limits
- `ChartPanel` and `DataTable` are shared components I edited additively; long single words (`flamethrower`, `AGGRESSION`) still wrap mid-word in narrow table headers.
- Enemy-ai stations carry only `script`, so their counts read "not in file" (honest, not a bug).
- The predicted-TTK curve is a perfect-shooter model from table columns, not a measurement; the measured bars come only from arena sessions, and only the range-bot session has per-range shots.
- The gate stops accidents and the agent path, not a process forging browser headers (same limit as the Voice room).
- A PoF worktree is not a sibling of `gtai-eve`, so my server needs `POF_GAME_DECISIONS_GTAI` / `POF_GAME_RUNNER_ROOTS_GTAI` / `POF_GAME_ROOT_GTAI`. On `:3001` after the merge they come from the GTAI manifest defaults only if the layout matches; otherwise set the env var.
- The brief said evidence under `evidence/` in the cwd; I kept it in the gtai-masters folder named by the common brief (that is where `frames.json` is read).

## What blocked me, and for how long
- 19:40 to 21:08 (about 1.5 h): the `e-*` worktrees and asks did not exist (runner not started), so only fixtures and honest empty states could be proven. No schema was invented during that time.
- Schema mismatches found once real output landed, each fixed within one iteration: `rivet_melee.json` instead of `melee_weapons.json` (the melee table read a file nobody wrote for ~2 h), `arena_stations` as `stations` arrays, `ttk_s` keyed by spawn id, invalid JSON from visual-fixes, a duplicated station via the arena worktree's copy.
- One self-inflicted outage: a scripted edit wrote a non-UTF-8 degree sign and broke the live page until `fd5ec9be` (use `encoding='utf-8'` in scripted edits).

## Next steps
1. After the 00:00 merge, confirm on `:3001` that `GameDef.decisions` resolves the decisions root without the env var; set `POF_GAME_DECISIONS_GTAI` if not.
2. When the arena lane writes more per-range sessions, narrow `GameCombatLab.telemetryDirs` to the real folder (`evidence/arena`, `user://arena`) and drop the speculative candidates.
3. Replace the model-only TTK curve with measured-vs-model overlay once two or more range sessions exist.
4. Fix mid-word wrapping of long single words in `DataTable` headers (needs a column-width decision, not a CSS tweak).
5. After the game lanes merge, tables read from rtai main; the lane picker can then default to `main`.
