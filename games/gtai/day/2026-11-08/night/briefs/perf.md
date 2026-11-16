# Lane perf: the rig cost under combo, then the research loop

The owner kept n9's calls: mailbox vsync for everyone, efficient pacing, the rig cost "as built until perf cuts it".

1. **Rig cost under combo.** Measured 1.1-1.4 ms p50 at 50 people against a provisional 1 ms (`top` 0.5-0.76 ms). Cut it: gait, pose, street walkers, head cards (about 1.4 ms a riot tick; per-system numbers in `docs/perf/LEDGER.md`). You may touch other lanes' rig files for this; note it in JOURNAL. Target at most 1 ms; if you cannot reach it, say what stops you and what would.
2. **The feed's snapshot scan** (about 120 us a riot tick), which needs native code: world's native work is merged.
3. **The riot release confirm** that n9 did not run: a quiet release riot A/B against main `9bbe6d0a`, under `bench.lock`.
4. **The research loop**, with the ledger: `docs/perf/LEDGER.md`. A breakthrough is one measured at the bench, kept as the new baseline before the next idea. Stop when two ideas in a row are washes.
