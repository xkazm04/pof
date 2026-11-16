# Lane: visual-fixes (three owner calls from the 18:00 sync)

Three bounded items from the owner's verdicts on the day. Keep each one a clean, separate commit with before/after evidence.

1. **Thin the white border on every character by 50 %.** The owner: "All characters in the theme have thick white border, we need to thin this layer to 50% reduction from today."
   - Find where the cream/white rim around character parts comes from (the "sticker rim": baked alpha outlines in the part art, the print shaders `print_part.gdshader` / `look_d5_part.gdshader`, the crowd atlas bake `crowd_baker.gd` / `crowd_atlas.gdshader`, and any outline pass). Measure today's rim width in pixels at 32, 48, 64 and 128 px/m on Rivet, a cop, a ped and a robot.
   - Halve it everywhere it appears: the live rigs (both tiers), the crowd atlases, the portraits only if they carry the same rim. Prefer a shader or bake parameter over repainting art. The silhouette must still separate from the asphalt; measure that (edge contrast) before and after.
   - Re-bless the look goldens deliberately, with a dated line in `docs/decisions.md`.
2. **Narrow the roads (owner call C1).** Streets are about 17 m kerb to kerb; the target T1 (`C:\Users\kazda\kiro\pof\games\gtai\art-direction\directions-v2\d4h2_mock.jpg`) shows about 10 m. The d5-city lane left a what-if in `docs/day/2026-11-03/d5-city/` (its `11-road-width-mock`).
   - This is sim and generator data: lane count or lane width, sidewalks, junction boxes, traffic routes, the nav flow field, vehicle handling on narrower lanes, parked cars. Make the change in the generator's data, re-bake, and keep traffic, parking, the vehicles lane's driving scenarios and the quest 1 slice working.
   - Replay and parity goldens will move: record it in `docs/decisions.md` and re-bless deliberately. Parity must stay exact.
   - Frames of the same real-city foci before and after at 32 and 48 px/m, beside T1. ASK the owner if the right width is unclear between 2 candidates (for example 10 m and 12 m).
3. **Voice lines play in full (owner call C21).** In quest 1, 6-7 of the 23 voiced lines are dropped because each line's time is set by its text, while the voice runs longer (272 s of speech vs 121 s of subtitles). Make each line's duration `max(text time, voice length + 0.4 s)` using `data/tables/voice_lengths.json` (from the audio lane; see `docs/day/2026-11-03/audio/REPORT.md`, its REQUEST 1). The quest timeline and its goldens move: record and re-bless. Prove with the slice: every one of the 23 lines plays to its end.

**You own** exactly what these three items touch; nothing in combat, movement or AI (other lanes own those tonight).

**Branch:** `e-fixes`. **Evidence:** `C:\Users\kazda\kiro\gtai-masters\eve\visual-fixes\`.

## Added 22:30 by the Director: item 4, the riot-scene slowdown (your three items are done)
The merged main's riot p99 doubled against this morning: 2.405 ms became 4.835 ms (idle, `tools/evidence/run.mjs` bench). Rig cost is flat (0.407 -> 0.431 ms), so the cost is elsewhere. The d5-cast lane left bisect patches in `C:\Users\kazda\kiro\gtai-masters\day-d5\d5-cast\perf-bisect\`; the merge notes are in `docs/day/2026-11-03/int-day/` and `docs/decisions.md`.
1. Bisect over the 8 day-lane merges on main (`git log --first-parent main`), one bench per step, in a throwaway worktree you delete after. Respect the bench lock (`gtai-eve\bench.lock`) and note the machine load: five other lanes are running, so repeat each measurement 3x and use the median. Unmeasured is not zero.
2. Name the commit and the cost (profile the riot scene at that commit: which node or system).
3. Fix it on `e-fixes` if the fix is small and stays inside the look, render or city code; otherwise write the finding and a REQUEST in JOURNAL.
Evidence: the bisect table (commit, median p99, 1 % low) in `C:\Users\kazda\kiro\gtai-masters\eve\visual-fixes\riot-bisect.md`.
