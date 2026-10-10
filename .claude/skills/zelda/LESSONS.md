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

## 1.0 — 2026-10-10 — pof (W05)
- **A re-key is not finished when the per-spec counter reads `dupes 0`.** The store never deletes, so
  a changed key shows as `created` and leaves the old row holding the old entity id. Back up with
  SQLite's own backup, write the stale count in the wave note, retire only through
  `scripts/zelda/retire-stale.ts --expect <N>`, and end with a whole-source SQL check that no entity
  id is held twice.
- **When the survey and the reader disagree, read the disputed record's source line before blaming
  either.** W05's one miss (25 predicted, 26 read) was the SURVEY's: its statement buffer did not reset
  at an access label after a macro line. Build a survey's scope rules from C++ semantics (access labels,
  line splices), not from the area's usual layout, and re-run it after the fix so the two agree call
  for call.
- **A test that pins a defect must move when the defect is fixed.** Before a reader wave, grep the
  tests for the defect's own words ("stays invisible", "duplicate id") and list those assertions in
  the wave note as moving, with their exact new values — they are neither a label nor a key, so a
  brief that allows only those will not have named them.
- **Negative-control a shape rule one clause at a time.** Loosen each condition alone (argument
  count, case, keyword, valued argument, enclosing name) and show each loosening turns a test red; a
  rule whose clauses are only tested together can lose one unseen.

## 1.0 — 2026-10-10 — pof (W06)
- **Before adding a spec, grep the existing tests' fixtures for paths under its glob.** Earlier waves
  park synthetic "sibling stays open" files beside their own area; a later spec covers and READS them,
  so those coverage, read-list and store assertions must move. W06's glob swallowed W02's
  `Resource/Actor` sibling (four assertions beyond the brief's three). List them in the wave note with
  their exact new values before the first test run; never move the fixture to dodge them.
- **Split a source's control flow by function kind before calling it behaviour.** "Sources with any
  branch or loop" over-reads parsers: 25 of 28 parameter-file sources had control flow, but 266 of
  their 369 statements were parse code. Count per function (parse / create vs the rest) and say
  "schema and query contract" unless the rest is real — as Cooking's was (178 of 207).
- **Run the clone-identifier check on a new map's reason strings BEFORE the store sees the area.** A
  reason is part of the map's content hash: rewording one after the area round changes the map version
  the store and the wave note already record. Grep the prose of the maps (and the fixture) first, then
  ingest.

## 1.0 — 2026-10-10 — pof (W07)
- **Cross-check every survey column with a one-line crude grep before writing it as a prediction.** W07's
  scope tracker read brace-initialised members (`x{}`) as blocks and counted 5 fields where a member-line
  grep counted 19; the disagreement was caught before the wave note, so the prediction stayed exact. A
  survey that is the only instrument for a column has no witness — give each column a second, dumber one.
- **In a node area, count SHELLS (classes that declare construction only) beside stub bodies.** F12 says a
  stub's hook set is still real; in the camera area 60 of 68 nodes had no hook set and no parameter at all.
  The shell share decides what "record-level" can mean for the area (inventory only, or inventory plus
  tick rule and tunables), so put it in the survey and the upgrade note's level line.
- **When the halves of an area land in different catalogs, split the spec by half but keep ONE map.** The
  census is one shape; two maps would fork reasons that must stay equal. Write the merge reversal into the
  Decision with its cost (`reprojected` of the smaller half, no raw or id change — wrapper and entity ids
  carry the record's file and key, never the catalog).

## 1.0 — 2026-10-10 — pof (W08)
- **Before calling a folder "engine only", grep for EVERY schema idiom, not the one the brief names.** A
  parameter-object grep found the sound folder's 2 schemas; the per-actor sound settings are a third, read as
  keys from a binary table inside one-line accessors. A crude witness for "is there design here" needs one
  pattern per way the source stores data (parameter handles, table-key reads, initialiser lists of defaults).
- **A descope test derives its names from the patterns at run time; the clone check covers the test's own
  filters too.** Spelling a descoped file name in a fixture copies a clone identifier; deriving it from
  `BOTW_DESCOPES` does not. W08's first clone check still caught a folder name inside the test's selection
  regex — select by pattern SHAPE (ends in a code extension, sits in a named folder) instead of listing folders.
- **A descope wave still learns, also from what it descopes.** Infrastructure files can carry evidence about a
  DESIGN elsewhere (a memory check that forces the world reset early); read them for that before writing the
  glob, and record the finding as structure-level with the descoped path as evidence.
- **When a file stays open for a later slice, say what the reader will see of it.** If the design lives in
  constructor arguments or bodies (F17), a slice yields names only; write that into the Backlog item so the
  next wave's prediction and its "record-level" claim are honest.

## 1.0 — 2026-10-10 — pof (W09)
- **Check every COINED fixture name against the clone directly, not only through the diff method.** The diff method
  exempts a clone hit the repo already holds at the base commit, so a coined type name that is also an ordinary word
  passes it. W09's fixture passed the diff method with 0 new hits, yet two of its coined type names were clone
  identifiers. List the names you coined and grep each whole-word at the pin; rename on any hit.
- **A shared map hides a row that departs from it, so adopt it per row only after a column-by-column match.** The store
  reports `unclassified 0` and the same column coverage for every row under one map, whatever the row holds. Each row's
  wave note must set its census (hook set, shells, stubs, field shares) beside each reason of the map and say it fits,
  before the store sees the row.
- **Before ordering a reader item against breadth, measure what the loss costs.** Count the lost attribute by kind
  (W09: parameter types by type kind), test how much a cheap heuristic recovers, and ask whether the fix is additive (no
  re-read of earlier rows). That turns "do the reader item first?" into a number and a cost, not a preference.
- **When a brief's crude number does not reproduce, do not copy it and do not silently replace it.** Give your two
  witnesses, the nearest grep that comes close, and say that none reproduces it. W09's "about 464 handles, 75 headers
  with none" matched no grep tried; two instruments agreed on 550 and 56.

## 1.0 — 2026-10-10 — pof (W10)
- **Write a heuristic's RULES into the vault the wave it is built, not only its score.** W09 recorded "420 of 550" and
  deleted the script; W10, asked to apply it unchanged, had to recover the rules from the run transcript. A number that
  a later wave must re-measure out of sample is only reproducible if its instrument is written down in prose.
- **Calibrate a fresh survey on the previous wave's area before trusting it on the new one.** Rerun unchanged over A–B,
  W10's new scope tracker had to reproduce every W09 number (550 · 126 · 85 / 97 · 6 shells · 1113 · 420 of 550) before
  any C–D number was written. A survey that cannot reproduce settled numbers is not a witness for new ones.
- **Re-measure an in-sample score out of sample before it orders the backlog.** The type heuristic tuned on A–B fell
  from 76 % to 64 % on C–D, and the loss sat in the kind whose share doubled between rows. A recovery rate quoted to
  defer a reader item is a claim about the NEXT row, so test it there first.
- **Count families from the base-class graph or by reading, never by a name-prefix grep.** Shipped names misspell their
  own family stem (F19); a prefix grep silently drops the misspelled member while its parent link still names the
  family.
- **Derive a "stays open" fixture from what NO spec reads, at run time.** A fixture built as "the next initial after my
  row" is swallowed by the next row's spec (the W06 lesson in another shape). Compute it from every registered spec, so
  a later wave moves no count in it.

## 1.0 — 2026-10-10 — pof (W11)
- **When new information has no honest column in the reader, add a TECHNIQUE over the same globs, not a kind.** A kind
  rides the existing columns, so it only qualifies when each column keeps its meaning; a scope word and a declared type had
  none. Measure the rejected design's cost anyway (W11 bumped the old technique against a copy of the store: 0 moved), so
  the choice rests on honesty, not on a count nobody took.
- **Rehearse the store round against a COPY of the real store.** Copy the source rows into `:memory:` and run the full
  ingest there twice: it predicts `created · rawChanged · reprojected · unchanged`, stale and the id check against the
  store's real state, not only the area's census, and it costs nothing to throw away.
- **Pin a byte-identity fixture with the BASE commit's reader.** When a fixture grows after the change, re-run the old reader
  on it (`git show <base>:<reader>` into a throw-away module) before re-pinning, so the "before" rows are never produced by
  the code under test.
- **The clone check tokenizes hex literals as identifiers** (the digits after `0x` read as an `x…` word), so a fixture's coined numbers collide
  with the clone's. Coin one distinctive value, check it against the clone, and use it everywhere.
- **The prose rule covers every interpreter, not only `node -e`.** A python heredoc that edits vault notes or test text can
  rewrite escapes silently (W11 lost a quote escape in a test string that way); edit prose with the Edit or Write tool, and
  re-read any note an interpreter touched.
