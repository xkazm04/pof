# GTAI night: scoreboard

Generated 11/7/2026, 6:55:08 PM from C:\Users\kazda\kiro\gtai-d9x\night.json. Total CLI cost $117.44.

| lane | iterations | cost (API key) | last | report | evidence |
|---|---|---|---|---|---|
| perf | 28 | $60.14 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d9-perf/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d9-perf/evidence) |
| handheld | 26 | $57.30 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d9-handheld/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d9-handheld/evidence) |

## perf

cwd `C:\Users\kazda\kiro\gtai-wt\d9-perf`

Last journal line: - Session end 18:47 (it28): all committed.

```
cdc5204a perf: it28 REPORT: the clip list with the perf HUD and the REPORT-phase path check (the edit be2e34b2 meant to carry), JOURNAL FRICTION
be2e34b2 perf: it28 REPORT phase: every cited evidence path checked present, clip list with the perf HUD added, JOURNAL + NEXT
00c3c7f0 perf: it25 at the freeze: journals read (no REQUEST to perf), exe vs last project commit re-checked, no Godot run, NEXT
aa85cc98 perf: it24 after the freeze: journals read (no REQUEST to perf), exe vs last project commit re-checked, no lever started (an ABAB does not fit before 18:30), NEXT
d13946cb perf: it23 after the freeze: journals read (no REQUEST to perf), exe vs last project commit checked, frames.json checked, NEXT
f8de1139 perf: it22 session end: REPORT wording (exe vs HEAD, P-3 next try), JOURNAL clean-up + NEXT
a26a7df3 perf: L15 low-processor mode under the 60 Hz limiter in play (Call P-3 (b) for free?): riot60 CPU cap 0.57 -> lpcap 0.50 cores but pacing like plain vsync (p99 32.5 -> 37.9 ms, skipped tick images 20 -> 42); DROPPED, one job on a loaded machine; LEDGER / REPORT / JOURNAL, evidence
e941b5b5 perf: it22 freeze gates at 5f436fc8 / 72ac1254 (lint 15/15, unit 1712/0, scenarios 52/0, parity exact, goldens 11/11 + 5/5, release-compile 601/0, reels top/tilt70/combo 19/19 0 SCRIPT ERROR), RTAI.exe exported + smoke, REPORT gates and exe sections, JOURNAL
72ac1254 perf: it22 freeze: REPORT final (summary, final table, dropped, blocked, tooling, next), LEDGER final-table rows for L12+L14 minimized and L13 title, commit ids for L10/L13/L14, the L4b BC7 import params saved as a patch (Call P-1 (b) is git apply away), JOURNAL it22
5f436fc8 perf: it21 session end: DECISION L14, REQUEST FYI to handheld (L13 / L14 / F19), NEXT for the freeze session
```

## handheld

cwd `C:\Users\kazda\kiro\gtai-wt\d9-handheld`

Last journal line: - Session end (it26): all committed.

```
f55a98a1 handheld: REPORT it26 every cited path re-checked, the one stale still name in Call 5 fixed
a5e722a4 handheld: JOURNAL it23 the stabilize check (no new REQUEST, exe current with the branch, glyph REQUEST still unserved)
f91e75f7 handheld: JOURNAL it22 the freeze check (no new REQUEST, exe current with the branch, glyph REQUEST still unserved)
cd5f7fcf handheld: JOURNAL it21 the freeze check (no new REQUEST, exe current with the branch, glyph REQUEST still unserved)
f1502ffe handheld: JOURNAL it20 the freeze check (no new REQUEST, exe current with the branch, glyph REQUEST still unserved)
e54826b3 handheld: it19 answer perf's L13 / L14 / F19 FYI (no number of mine is a quest 1 timing), glyph REQUEST still unserved
47f86404 handheld: JOURNAL it18 the exe check, session end
f350f826 handheld: the freeze exe runs the owner's lines: deck / deck40 / switch_handheld / desktop on the city course, exit 0, 0 SCRIPT ERROR, the device row live only on the handheld runs
bf22dd92 handheld: JOURNAL it18 (E15 / E15b, the withdrawn tail claim, perf's FYI answered, cleanup, NEXT)
891b45df handheld: E15b re-run in 3 interleaved rounds: one core holds 60 at the median every round; round 1's tail cost (5 vs 1 frames > 33 ms) is inside the contention noise (17 vs 12, 4 vs 4) and is withdrawn; the Switch-class row has the same one-thread shape
```
