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

## 1.0 — 2026-10-09 — pof (W00)
- **Predict an area from its own shape, not the tree's average.** The whole-tree ratio (1.16
  records per header) predicted 220 Player records; Player is one-action-per-file and gave 200. In
  range, but on the low edge for a reason a per-area count would have shown.
- **A coverage table must be proven to partition the tree.** The first cut of Coverage.md silently
  missed 44 files: the "Action F, not Fork" alternation excluded every `Fo…` name. Only the
  partition check (0 overlaps, 0 unowned, sum = total) caught it. Generate rows with a script that
  reports both, never by hand.
- **Close a wave with an ingest AFTER its notes are written.** The STOP rule compares recorded
  rounds, and the vault counts ride on the ingest run; an ingest before the notes leaves the
  learning invisible until the next wave and makes that wave look like it moved.
- **Label an upgrade's evidence level.** Record-level (wrapped records) and structure-level
  (directory and file names only) findings read the same in a note; the frontmatter `level:` keeps
  a 'no PoF home' row from being mistaken for an analysed system.
- **Never write a vault note through `node -e "…"` in bash** — backticks in the text become command
  substitutions and silently delete words (W00's W01 proposal lost its technique name). Use the
  Write tool for prose.

## 1.0 — 2026-10-09 — pof (W01)
- **Predict with an instrument that shares no code with the reader.** A grep survey of the area
  (owners per `.cpp`, `enum` tokens, destructors) predicted every W01 number exactly (199 = 199,
  0 enums, 1 record-less file). Probing the new reader over the area first would have made the
  prediction a copy of the result.
- **A reader upgrade runs BESIDE the old walk, never inside it.** New record kinds read the chunk
  the old walk already built and never change how a chunk is classified; then `rawChanged 0` on the
  area plus an unchanged tree-wide count of the old kinds (4449 = 4449) prove the old records did
  not move. A lexer fix that would help the old kinds too (F6) waits for its own measured re-read.
- **When a reader version adds records, existing tests pin the old contract.** Keep each old
  assertion verbatim over the old kinds and add an exact assertion for the new — never loosen one
  to fit, and say which ones you touched.
- **Never find "new-version records" by technique label** — the store does not relabel rows whose
  raw did not move (F5); select by `kind`.

## 1.0 — 2026-10-09 — pof (W02)
- **Classify a column from THIS area's census, never by inheriting another area's verdict.** The
  same `methods` column is a gap in Player (behaviour hooks) and a drop in the parameter-group
  library (constructor 157 · name accessor 80 · nothing that carries design). Run the census of
  every design column over the stored records before keeping the map.
- **A spec that spans catalogs names one: assign every kind to the single catalog it would live
  in and take the plurality.** Write the whole distribution into the Decision — it is learning in
  itself (here: 13 of 79 groups have NO PoF home), and it makes the label reversible with a known
  `reprojected` count.
- **Regenerate Coverage rows with `scripts/zelda/coverage-rows.ts`, every wave.** It re-derives
  each row from the vault's own row globs and refuses a broken partition. Its first run caught a
  relative `except` glob that hand-checks had read correctly for two waves (346 false overlaps).
- **Survey a slice area per file SHAPE, not only per kind.** Predicting the records-per-file
  pattern (73 × class + definition, 5 × class, 1 × class + enum …) pins the reader's behaviour at
  the file level, so a matching total cannot hide two compensating misses.

## 1.0 — 2026-10-09 — pof (W03)
- **Survey out-of-line owners per file pair, not only per file.** A definition record's key carries
  no file, so one owner defined inline in a header AND in its source yields a duplicate id. Count
  such owners in the grep survey and predict `dupes` from it; W03 predicted its one duplicate before
  ingesting. Never split a spec to make the per-spec counter read 0 — the entity ids still collide.
- **Count what the reader cannot see as part of the prediction.** Enumerations written as one macro
  call and undecompiled classes (a constructor, a kind tag, one padding member) look like nothing or
  like ordinary records in the census; only the survey shows them. Say per area how many there are,
  and never cite a padding-only class record as record-level evidence of a system's behaviour.
- **Check the census against the map before the store sees the area.** One in-memory run of the
  same reader (a throw-away script, console output only) after the predictions are written lets the
  map be kept or corrected before the first store ingest, so a map fix never shows up as a
  `reprojected` count on the area's own first rounds.

## 1.0 — 2026-10-09 — pof (W04)
- **Survey what a source DOES, not only what it declares, before calling evidence "behaviour".** The
  census reads the declared and defined function SETS and is blind to an empty body; one grep for a
  branch or loop per source showed the mount's 36 node bodies are pass-through stubs (and 25 of
  ≈ 2800 generic node sources hold any control flow). Say "inventory and tunables" until that count
  says otherwise, and put the count in the wave survey.
- **A synthetic fixture copies the area's shape, so check its NAMES against the clone before the first
  test run, not only before the commit.** Mirroring a node library pulled the engine's lifecycle hook
  names into the fixture; the whole-word clone grep caught them and one type name. Coin every
  identifier (hooks, bases, parameter types, member suffixes) and grep the fixture alone first.
