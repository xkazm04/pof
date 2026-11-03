# pof-arena - report (iteration 1, 2026-11-03 evening)

Branch `gtai-arena` (PoF repo). Evidence: `C:\Users\kazda\kiro\gtai-masters\eve\pof-arena\` (frames.json lists every screenshot).

## Delivered
1. **Decisions room** (`/layout?g=gtai&c=spellbook&v=game&room=decisions`). Reads `gtai-eve/decisions/asks/*.json` (open first, newest first), shows options side by side with frames/clips inline, the lane's default tagged, a choice + note + Save. Save is human gated (the Voice room's same-origin + page-token gate; agents and the CLI get 403). `answers.json` is written tmp+rename, one entry per ask id (a changed answer replaces the entry and logs the old one to `answers.history.jsonl`), earlier answers and unknown keys kept, an unreadable file refused, ask files never written. Media is served only by (ask, option, index) from paths an ask file lists, existing png/jpg/webp/gif/mp4/webm files, byte ranges honoured, 200 MB cap. The Game home entry button shows how many questions wait.
2. **Combat lab** (`room=combat`). Weapons / enemy archetypes / powers tables (each named with the source it came from), a measured time-to-kill-by-range chart (shared `ChartPanel`), the latest arena telemetry sessions (shared `DataTable`). Source picker: `auto` (game root, then each `gtai-eve` lane worktree), `main`, a lane, and the engine `user://` folder (telemetry only).
3. Config: `GameDef.decisions`, `GameDef.combatLab`, env `POF_GAME_DECISIONS_GTAI`; `gtai-eve` added to the lane runner roots. Docs: `docs/architecture/game-workspaces.md` (two new sections).

## Proof
- Tests: 20+ server (reader, writer incl. concurrent readers, media door, gate refusals), 6 component (Decisions), 9 (Combat route + component), 15 (combat readers); `npm run validate` green (15235 tests) before the last feature commits, re-run before the final commit.
- Screenshots at 1440 and 390 px, against fixtures (full browser flow: pick, note, Save, `answers.json` updated) and against the LIVE roots read-only (empty decisions board; combat tables "not written yet").

## Honest limits
- At 19:50 the `e-*` worktrees did not exist and no ask was written, so both rooms were proven on fixtures plus the live empty states, not on real lane output.
- The table and telemetry schemas are the lanes' to define. The readers are schema-tolerant (array / id map / keyed array; metrics by key name; ttk as nested map or record list) and say "unrecognised" rather than guess. The arena brief names no telemetry folder; `telemetryDirs` lists six candidates plus `user://`. Narrow them once the arena lane's JOURNAL names the folder.
- A PoF worktree is not a sibling of `gtai-eve`: run with `POF_GAME_DECISIONS_GTAI` / `POF_GAME_RUNNER_ROOTS_GTAI` / `POF_GAME_ROOT_GTAI` (see `start-pof-arena-live.cmd` in the evidence folder; `http://localhost:3013`). The owner's `:3001` has this only after the 00:00 merge.
- The gate stops accidents and the agent path, not a process forging browser headers (same limit as the Voice room).
