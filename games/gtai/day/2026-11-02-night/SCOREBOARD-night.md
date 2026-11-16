# GTAI night: scoreboard

Generated 11/3/2026, 7:28:19 PM from C:\Users\kazda\kiro\gtai-night\night.json. Total CLI cost $438.90.

| lane | iterations | cost (API key) | last | report | evidence |
|---|---|---|---|---|---|
| visual-engine | 27 | $112.10 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/n-visual/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/n-visual/evidence) |
| d4-production | 32 | $176.23 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/n-d4/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/n-d4/evidence) |
| d5-close | 23 | $150.57 ($0.00) | REPORT exit 0 | [REPORT.md](file:///C:/Users/kazda/kiro/gtai-wt/n-d5/REPORT.md) | [evidence/](file:///C:/Users/kazda/kiro/gtai-wt/n-d5/evidence) |

## visual-engine

cwd `C:\Users\kazda\kiro\gtai-wt\n-visual`

Last journal line: 3 native RigArm / RigGait for the 0.3 ms rig target; 4 FX / night / traffic-state sources; 5 Deck numbers.

```
ef7a51c docs(report): visual-engine lane night report (evidence stamp 8bd2ec0); journal iteration 27
339ded4 docs(journal): iteration 26 stabilize check (code unchanged since 8bd2ec0, lint 13/13)
8d4750d docs(journal): iteration 25 stabilize check (code unchanged since 8bd2ec0, lint 13/13, unit 247)
0ea52b9 docs(journal): iteration 24 stabilize check (code unchanged since 8bd2ec0, lint 13/13)
d1d1578 docs(journal): iteration 23 stabilize gate re-check (unit 247, scenarios 8 green; code unchanged since 8bd2ec0)
03d79cd docs(journal): iteration 22 stabilize check (code unchanged since evidence stamp 8bd2ec0, lint 13/13)
239ee56 docs(journal): iteration 21 session end
4035fce chore(evidence): visual-engine lane evidence refreshed at 8bd2ec0 (all PASS, selftest frames md5-identical to iteration 16); journal iteration 21
8bd2ec0 docs(journal): iteration 19 session end before freeze
19260d5 docs(journal): iteration 18 gate re-check at HEAD (lint, unit 247, scenarios 8 green)
```

## d4-production

cwd `C:\Users\kazda\kiro\gtai-wt\n-d4`

Last journal line: Nothing pushed or merged.

```
344cdb5 docs(report): lane d4-production night report (what works with evidence paths, gaps, blocks, morning order); gates green at 0e733b6
0e733b6 docs(journal): iteration 31 stabilize re-check (lint/unit/scenarios green at e6dcac5), final NEXT
e6dcac5 docs(journal): iteration 30 stabilize re-check (lint/unit/scenarios green at 2471640), final NEXT
2471640 docs(journal): iteration 29 stabilize re-check (lint/unit/scenarios green at 02e21c1), final NEXT
02e21c1 docs(journal): iteration 28 stabilize re-check (lint/unit/scenarios green at 45e4478), final NEXT
45e4478 docs(evidence): put the iter27 row inside the folder index table
e62b674 chore(evidence): iteration 27 full gates with bench at 31f8c4c (all 6 PASS), manifest + provenance check
31f8c4c docs(journal): iteration 27 survey, idle box, full evidence run starting
f72b913 docs(journal): iteration 25 HUD check, session end
0c4eab6 docs(journal): iteration 24 roofs + FX check, session end
```

## d5-close

cwd `C:\Users\kazda\kiro\gtai-wt\n-d5`

Last journal line: NEXT (final): lane closed. Morning: Director merges n-d5 per evidence/README.md and REPORT.md; open items 50 and 51.

```
ed51fdf docs(d5): REPORT.md - night summary with evidence paths, gaps, blockers, next steps
2b60a78 docs(d5): journal - iteration 22, evidence matches HEAD (docs-only diff), final NEXT
a3875a8 docs(d5): journal - iteration 21, evidence matches HEAD (docs-only diff), no change
a55382e docs(d5): journal - iteration 20, evidence matches HEAD (docs-only diff), no change
5526cae docs(d5): journal - iteration 19, gates green and evidence refreshed at HEAD
850652b docs(d5): journal - iteration 18, parity and bench measured on n-d5, NEXT 51-52
4b61ff4 docs(d5): merge sheet - parity measured on n-d5 (native built), bench still open
8aa9774 docs(d5): journal - iteration 18, native built in the worktree for parity
06fa2cf docs(d5): journal - iteration 16, range test measured hollow and reverted, NEXT 50
f5241a3 docs(d5): merge sheet - look_d5_soul uniforms are test-guarded
```
