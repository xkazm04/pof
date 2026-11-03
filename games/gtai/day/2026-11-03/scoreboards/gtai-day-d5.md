# GTAI night: scoreboard

Generated 11/3/2026, 6:46:06 PM from C:\Users\kazda\kiro\gtai-day-d5\night.json. Total CLI cost $252.16.

| lane | iterations | cost (API key) | last | report | evidence |
|---|---|---|---|---|---|
| d5-city | 53 | $43.32 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-city/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-city/evidence) |
| d5-cast | 55 | $57.46 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-cast/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-cast/evidence) |
| d5-combat | 56 | $42.11 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-combat/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-combat/evidence) |
| slice-play | 54 | $45.13 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-slice/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-slice/evidence) |
| vehicles | 54 | $43.93 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-vehicles/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-vehicles/evidence) |
| audio | 59 | $20.22 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/d-audio/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/d-audio/evidence) |

## d5-city

cwd `C:\Users\kazda\kiro\gtai-wt\d-city`

Last journal line: 2. More T1-scale long plates; 3. overlay 32 px/m hatch A/B idle; 4. kerb/corner tiles 7-10, then the D5 sidewalk.

```
589a91c docs(d5-city): iter 53 REPORT.md (evidence paths verified), final NEXT
d267935 docs(d5-city): iter 52, lint green at 9ccc7af via pre-commit hook
9ccc7af docs(d5-city): iter 52, bench lock held (slice-play), no code delta since gates of record
e1f8c26 docs(d5-city): iter 51, bench lock held (collisions), no code delta since gates of record
35ac93f docs(d5-city): iter 50, idle bench blocked by lock (collisions), evidence verified, NEXT
ac0f8ce docs(d5-city): stabilize re-bench pass 2 inside section 20 limits (contended, partial), NEXT
7a8c8b1 docs(d5-city): iter 48 journal, re-bench still locked, NEXT unchanged
1a017d6 docs(d5-city): lint green at head, gates of record unchanged, frozen for 17:00
1a1a5c5 docs(d5-city): idle re-bench blocked by lock (d5-combat), frames.json verified, final NEXT
02519bd docs(d5-city): bench per-scenario split (riot regressed too: machine load), NEXT re-bench idle
```

## d5-cast

cwd `C:\Users\kazda\kiro\gtai-wt\d-cast`

Last journal line: 3+3 riot bench A/B for the open p99 lead.

```
94b2831 docs(report): d5-cast REPORT.md for the 18:00 sync, evidence paths verified (d5-cast)
5152b5f docs(journal): d5-cast iteration 54: stabilize, build unchanged since gates, evidence verified, NEXT (d5-cast)
1dd85fc docs(journal): d5-cast iteration 53: stabilize, lint re-run green, evidence verified, NEXT (d5-cast)
e34546c docs(journal): d5-cast iteration 52: stabilize, build unchanged since gates, evidence verified, NEXT (d5-cast)
b8d2e68 docs(journal): d5-cast iteration 51: stabilize, gates re-run green, bench called off (lock contention), NEXT (d5-cast)
ea6ab0e docs(journal): d5-cast iteration 50: freeze status, bench skipped on lock, lint green, NEXT (d5-cast)
000420d docs(journal): d5-cast iteration 49: bench skipped on lock, owner frames verified, shader cost read, NEXT (d5-cast)
76c26de docs(journal): d5-cast iteration 48: correct the bisect commits (704570f is art only), bisect patches ready in masters (d5-cast)
79f48f6 docs(journal): d5-cast iteration 48: perf lead narrowed (rig update ruled out), bench skipped on lock, NEXT (d5-cast)
7df6a8f docs(journal): d5-cast iteration 47 final status, perf lead in NEXT (d5-cast)
```

## d5-combat

cwd `C:\Users\kazda\kiro\gtai-wt\d-combat`

Last journal line: car-hit slide via FxTriggers.cued death speed; REQUEST 3; REQUEST 4 -> d5-city; split city_fight.gd (300 lines).

```
57f2e55 docs(d5-combat): REPORT blocked/next-steps sections, paths verified, journal iter 56
d4f58bd docs(d5-combat): journal iter 55, lint + scenarios re-check at freeze
7e1f034 docs(d5-combat): journal iter 54, freeze re-check
c7a767d docs(d5-combat): REPORT commit count + freeze check, journal iter 53
3550fd6 docs(d5-combat): STABILIZE gate re-check at 36d366d, unit flake noted (city texture threaded load), journal iter 52
36d366d docs(d5-combat): REPORT fact-check (iter5 riot vs overall p99, commit count), journal iter 50
430fef4 docs(d5-combat): REPORT.md draft at the freeze, journal iter 49
2bc93b0 docs(d5-combat): journal: freeze bench iter5 at 5a6e21b (CONTENDED), NEXT
55e4725 docs(d5-combat): sync lane evidence frames.json + ladder with the masters copies, journal NEXT
45fe279 docs(d5-combat): journal: correct the iter 46 timestamps
```

## slice-play

cwd `C:\Users\kazda\kiro\gtai-wt\d-slice`

Last journal line: 6) the one-frame warm-up particle burst on Continue/Start f1; 7) re-bench the slice.

```
6de5103 docs(report): slice-play REPORT.md: what works with evidence paths, gaps, blockers, merge notes, next steps
9bcc07f docs(journal): slice-play iteration 53: unit 359/0 and scenarios 10/10 re-run green at HEAD, exe in place, NEXT
ca3b3ad docs(journal): slice-play iteration 52: code unchanged since ebe1dd6, lint 13/13 at HEAD, exe in place, NEXT
17a85df docs(evidence): slice-play iteration 51: clip v5 on the exe build (ebe1dd6), light-pool fix verified on Start, NEXT
cadb24c docs(evidence): slice-play iteration 50: light-pool fix frame-proven and committed, gates green at ebe1dd6, exe re-exported, NEXT
ebe1dd6 fix(city): the view warm-up no longer leaks the explosion light onto the player
95f0e62 docs(journal): slice-play iteration 50: build unchanged since 162fbfa, light-pool patch applies on d-city too, waiting on bench.lock
77168ff docs(journal): slice-play iteration 49: bench.lock held by d5-combat to the freeze, light-pool patch unverified, NEXT carried
4841354 docs(journal): slice-play iteration 48: light-pool patch still unverified (bench.lock held by d5-combat to the freeze), NEXT carried
a7b3616 docs(journal): slice-play: root cause of the light pool on Rivet (ViewPrewarm leaks the explosion light via the glow twin); fix patch ready for d5-city, not applied (no frame proof before the freeze)
```

## vehicles

cwd `C:\Users\kazda\kiro\gtai-wt\d-vehicles`

Last journal line: for REQUEST 2-4; fire half 2 after splitting out vehicle_burn.gd; a drive48 bench variant with VehicleService.

```
33d1acd docs(vehicles): REPORT.md for 17:30 - per-claim evidence, blocked time, next steps
61fe4fb docs(vehicles): journal - iteration 53, stabilize handoff check (lint green at ebb2ed9)
ebb2ed9 docs(vehicles): journal - iteration 52, stabilize handoff check
d5e78ca docs(vehicles): journal - iteration 51, stabilize handoff check (lint green at fc6c092)
fc6c092 docs(vehicles): lane REPORT.md for the 17:30 report, journal iteration 50
09bb530 docs(vehicles): gates re-run green at eb7d066 (scenarios 11/11), evidence it6, journal iteration 49
eb7d066 docs(vehicles): journal - iteration 48, freeze handoff check
a86da79 docs(vehicles): journal - iteration 47, freeze handoff check
cd992e9 docs(vehicles): gates at 2b62519 (city_chase contention flake, alone green), evidence it5, NEXT
2b62519 docs(vehicles): journal - fire kill reaches actor_killed only via combat's chokepoint (REQUEST 10)
```

## audio

cwd `C:\Users\kazda\kiro\gtai-wt\d-audio`

Last journal line: NEXT (iteration 59 end): unchanged from iteration 52; see REPORT.md section 4 (Director applies quest1_game_audio.patch + radio_next row + `_ready_blood()`; slice-play decides line timing; a human must LISTEN to every SFX, the 23 TEMP voices and the 3 radio loops).

```
27ca9cd docs(audio): REPORT.md, journal iteration 59
e244e44 docs(audio): journal iteration 58, stabilize tip check, lint green, no new unhooked events
9d6f76b docs(audio): journal iteration 57, stabilize tip check, lint green, no new unhooked events
9d7f8b7 docs(audio): journal iteration 56, tip check, no new unhooked events
1c99937 docs(audio): journal iteration 55, tip check, no new unhooked events
95d90a2 docs(audio): journal iteration 54, tip check, no new unhooked events
eb2dc3f docs(audio): journal iteration 53, six-tip merge check green (463 unit, 13 scenarios)
f2c955d docs(audio): journal iteration 52, five-way merge check at the latest tips, _ready_blood extraction for the slice/combat conflict
e417bd2 docs(audio): journal iteration 50, gates green at a14dd64, NEXT
a14dd64 docs(audio): journal, bodies merge check
```
