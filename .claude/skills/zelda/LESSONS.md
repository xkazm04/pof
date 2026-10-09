# Lessons — zelda

## Inherited from /diablo (v1.0–v2.3, 2026-09-22 → 2026-09-28)

Only the lessons about running a loop carry over; those specific to codex delegation, UE import
and media generation were dropped with those sections.

### Measurement
- **Write the wave note — with predictions — before running anything.** Only a prediction written
  down first catches a silent shortfall (D1's positional ids: 50 items keyed where 168 existed).
  Make the prediction precise enough to fail.
- **Look at the data before trusting a mapping.** Every Diablo mapping defect was a vocabulary nobody
  had looked at. Read the census and a sample of raw records first.
- **A wave can change the picture and move no number.** When that happens, the missing number is the
  finding — say so rather than let a flat snapshot read as no progress.
- **Every reader of an aggregate must apply the same aggregation.** A snapshot tool that disagrees
  with the path the loop actually uses lies at scale (82 false "stale" in /diablo).
- **Commit derived snapshots in the same step you regenerate them** — an uncommitted generated file
  is silently reverted by the next checkout.

### Instruments that cannot fail
- **An instrument that cannot fail is not an instrument.** Before trusting a measurement, check it
  can produce a failing number on a plausible bad input.
- **Negative-control every new gate on the code it replaces.** Reverting only the new piece turns a
  passing test into proof the test can see the defect.
- **A dead mechanism usually fails silently at its edges.** Make every generator and tool REFUSE a
  missing input instead of reporting success on nothing.
- **Vitest has two failure channels.** An unhandled rejection is a run `Errors` line while every file
  passes. Read the `Errors` line, not only `FAIL`.
- **A cheap static guard beats a behavioural test for load-order bugs** (two canon imports crashed
  for weeks unseen under vitest's loader).

### Scrutiny of passes
- **A pass needs the same scrutiny as a fail** — at fleet scale too. Read passing outputs and grep
  all of them for the defect marker; shape graders cannot see parity.
- **Claim-level audits beat shape graders and numeric parity.** Errors cluster in CONDITIONS (gates,
  predicates, failure branches, runtime order), never in the headline numbers.
- **Audit a new law before anything amplifies it.** A wrong law is copied into every entity that
  cites it.
- **Before blaming the system, check the checker's key** (a name collision in the reference looked
  like 15 defects).
- **Before calling a failure pre-existing, reproduce it on a clean base.**

### Delegates' reports are claims
- **A delegate's report is a claim; the overseer's re-run is the evidence.** Re-run the acceptance
  commands yourself and re-ingest real data (`unchanged` means nothing moved that should not have).
- **A delegate's acceptance scope is a claim about coverage** — brief every test directory that the
  change can reach.
- **Delegates loosen tests to fit their text.** Diff every test file a task touches; any removed or
  relaxed assertion is a red flag.
- **The same misread recurs across fresh readers.** When a misreading recurs, encode the verified
  fact so the next reader does not re-derive it.
