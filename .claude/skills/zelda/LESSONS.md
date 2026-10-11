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

## 1.0 — 2026-10-10 — pof (W12)
- **A brief's list of moving assertions is a claim; derive the list from the tests' own selectors.** A new spec moves every
  assertion over a filter it joins (`map === X`, `technique === Y`), in every file that filters that way. W12's brief named
  `ROW_SPECS` in the W09 test and missed the identical filter in the W10 test. Grep the tests for each predicate the new spec
  satisfies and list every count over it before the first run.
- **Rule a catalog from the candidate pipelines' STEPS, not from their names.** W12 counted three fog commands as "no home"
  until the learning pass read `cutscenes.ts`, whose Lighting step already holds fog density and time of day. Read the step
  contents of every catalog a node group might belong in before the distribution is written, or the Decision records a
  correction after the store round.
- **When a row shows a new shape, measure it on the earlier rows before calling it the row's.** 35 E nodes declare no acting
  hook; the same calibrated survey found 12 in A–B and 34 in C–D, which turned a row note into a library finding (F22) and
  corrected an earlier wave's reading of "no per-frame update" as one shape.

## 1.0 — 2026-10-10 — pof (W13)
- **A row's name says what its nodes ARE only after you find the node that uses them.** The brief and Coverage called the stem row
  "branching nodes"; the census found 0 nodes with children, and the composite that runs them sat in the engine folder. Before matching
  a map to a row's supposed shape, grep for the row's stem OUTSIDE the row and read the user, so the map question is asked of the right
  nodes.
- **Count a hook-set shape through the parent chain, not per node.** "Declares no acting hook" over-counted "action not recovered": the
  four such nodes of W13 and four of W12's 81 inherit an acting hook from a parent. Any per-node hook census (shells, tick rule, F22) walks
  the node's ancestors inside its namespace before it is written down.
- **Pin a row's test to its row by position among the row specs, never by "last".** Every row test that selects itself with `.at(-1)`
  breaks when the next row appends (W13 re-pinned W12's). A new row test takes `ROW_SPECS[i]` for its own index from the start, and its
  "ends the block" assertion is moved by the next wave to "is followed by the next row".
- **The spec glob language has no negation, so a row defined against another spec's stem is an enumeration.** Write it from the
  continuations the pin actually holds, and prove it by the partition check AND a test that the two specs of one technique read disjoint
  files — an overlap would wrap one file twice under one wrapper id.

## 1.0 — 2026-10-10 — pof (W14)
- **Prove two prefix globs disjoint by argument, then by probes.** `<p>{a,…}*` and `<p><stem>*` can share a name only if an alternative
  and the stem begin one another — assert that for every alternative, then sweep border probes (every head of the stem followed by every
  letter, both cases). The argument covers names no sample would think of; the probes show the globs really read files. W14's negative
  control (one alternative widened into the stem) turned the test red.
- **A derived "stays open" fixture must BE the probe it was derived from, not the probe's first letter plus a tail.** W10's rule kept the
  open INITIAL right, but three fixtures added a lower-case tail after it, and an enumerated glob read all three. Build the fixture path
  from the exact probe string the derivation tested, so no later spec can read it without also changing the derivation.
- **When a row holds whole species families, put the family sensitivity into the plurality ruling from the start.** The concept rule
  (a walk is a state whoever walks) and the unit rule (a family is one bestiary entry) gave state-graph 47 and bestiary 77 on the same
  179 nodes; earlier rows used both rules unnamed. Write both counts and say which rule the label follows.
- **Every store-touching command runs alone, in the skill's order.** A convenience re-run chained into the same shell line (W14: a second
  BOOT ingest, and an idempotence round before `status.ts`) is a recorded round in the history the STOP rule reads. It moved no number this
  time, but it must still be disclosed. Run ingest, status and the stale check as separate calls.
- **String literals are tokens too.** The clone check flagged the lower-case alphabet written as a literal (the repo held only the
  upper-case one). Derive a literal from one the repo already holds, rather than typing a new one.

## 1.0 — 2026-10-10 — pof (W15 part 1)
- **A derived initial is computed with the repo's own glob matcher, never taken from a brief.** The W15 brief said the first open initial
  moves H → M; `expandGlob` over the registered specs, run once without and once with the new specs, said F both times (the bare F probe
  is read by neither the stem spec nor the enumerated F + G spec). Run that two-line check before any fixture is touched.
- **A released wave resumes from its own note, and its unrun code is a draft, not a delivery.** Read the salvage line by line, write each
  file again in the live worktree, and run it before believing it: the released run's new test compared `expandGlob`'s SORTED result with an
  unsorted probe list and was red on the first run, and its header claimed a clone check no evidence backed. Drop a claim until you have
  earned it; compare globbed lists sorted.
- **When a wave is split, the first part ends at the store-side wrap and the note says which half owns each claim.** Put the claims in the
  note before the slice (they were), the real numbers in a section headed "part 1", and the learning pass as the State resume point — the
  next run then reads claims from the 833 stored records and touches neither the store nor the repo.

## 1.0 — 2026-10-10 — pof (W15 part 2)
- **The first learning pass run on its own from stored records: the records carried every COUNT but not three things — bodies, parents in
  unwrapped rows, and anything outside `src/Game/Actor/Action`.** Bodies, the 23 parents of the row in rows not yet wrapped, and the AI
  folder's names came from the clone, read-only, and each claim says which part did. Plan a learning pass as "store first, then name the clone
  reads in the claim"; none of it needed a write.
- **Validate a clone-built parent index against the store before trusting it.** The index of class heads over the Action folder agreed with
  the store's class records on all 972 classes both hold (same first parent, 0 disagreements); only then were its 23 extra links used. Also
  confirm a "no acting hook in the chain" node's chain really ends at the engine base through store-held nodes (here all 7 do), because a
  store-only walk is blind past a parent the store lacks.
- **A survey's COUNT can be exact while its explanation is wrong; check the holder, not the number.** The prediction (3 nodes inherit an
  acting hook, 2 from a T–Z base) matched on 10 / 7 / 3, but the chain showed the T–Z node declares no hook itself and the hook comes from
  the player folder's action base: the library crosses an area, which no count would have shown. Print the chain of every inherited case.
- **Do not force a name-classified count to a survey's number.** The completion-policy handles came to 15 on 11 nodes by a strict rule
  against the survey's 18 on 14; the 3-and-3 gap could not be reproduced from names. Report the rule, the count and the gap, and give the
  verdict PARTLY with the kinds list complete — never tune the rule until it matches.
- **A class name containing a word is not a reference to the thing the word names.** Eighteen AI-folder pairs are named for riding, yet no
  AI source names an Action-side rider node: the link is tree data. Grep what a file REFERENCES, not what it is called, before a note says one
  side "runs" the other.
- **Append a multi-claim section by anchoring on the paragraph's LAST line.** An `Edit` anchored on a substring in the middle of claim 5's
  paragraph pushed claims 6 and 7 into it, with the paragraph's tail left below them; found by grepping the claim numbers' line order, fixed
  by moving the tail. Grep the headings' order after any multi-paragraph edit of a note. And write throw-away scripts with the Write tool: a
  heredoc stripped the backslashes from a regex and the script did not even parse.

## 1.0 — 2026-10-10 — pof (W16 part 1)
- **A negative control must widen the glob into an initial ANOTHER spec owns.** Widening both M–O specs to include P, which no spec reads yet,
  left every test green: the new test derives its initials from the glob, so a wider glob is just a different (consistent) row. Widening into
  the lower neighbour (L, H–L's last initial) went red, 8 tests in 2 files. The control proves the disjointness test only when the added
  letter is already read elsewhere; try the owned neighbour first and keep the unowned one only as a documented non-control.
- **Calibrating a delegated instrument is cheap and decisive: give the author the settled numbers as targets and re-run both rows yourself.**
  The survey script was written by a sub-agent from the previous note's description, reproduced H–L and F + G exactly on its first run, and I
  re-ran both calibration rows before using one number. The write-up (survey → classification → predictions) then took about 15 minutes, so a
  one-run part 1 fits the policy's hour with the seam never reached. Say in the note who wrote the instrument.
- **Predict the store census from the survey and check it against the stored RAW columns, not only the ingest summary.** The 678 rows' scope
  words, type kinds, bases (106 qualified, 68 bare), fields (332) and methods (959 / 959) were summed from the stored `raw` JSON after the round
  and equalled the survey line for line; a summary that only says "created 678" cannot show a mapped-but-wrong column.

## 1.0 — 2026-10-10 — pof (W16 part 2)
- **The records carried every COUNT of four claims alone; the clone was needed for bodies, parents in unwrapped rows and a folder no spec reads.**
  F22 (all 17 cases at depth 0), the commerce and world-name census, the vehicle and stable census and the handle side of the completion policy came
  from the store; the 171-of-174 stub count and three real bodies, the 14 + 11 borrowed parents, the 20 extenders in unwrapped rows and the NPC
  folder's two nodes came from the clone. Name each clone read in its claim; a validated index (1146 shared classes, 0 disagreements) came first.
- **Before recommending the next row, measure the WHOLE remaining stopgap, not the last wave's.** The claim asked "9 of 23"; the useful number for
  the choice was the tree-wide one (89 of 528 library links unresolved, by row: S 35, T-Z 27, P-R 15), computed from every stored class against the
  clone index in one pass. It turned a "which row next" opinion into a per-file yield (T-Z 9.8 %, S 8.0 %, P-R 7.7 %).
- **Do not carry a previous row's theme into a new row's write-up from memory.** I wrote "stem-row side actions built on this row's moves" (true in
  W14 and W15) before checking; listing the 50 extenders' file names showed none was. Grep the file names behind any "again" sentence.
- **When a count depends on a name rule, give both rules if the survey's set came from reading.** The 22 commerce nodes (survey) were 18 by commerce
  words and 22 only with four outfit commands; the 7 handles were 3 and 7. Stating both, and which one is the concept set, kept the claim honest
  without tuning the rule to 22.
- **Filter stored records by the raw JSON's `kind`, not by `key_kind`** (it reads `column` for every botw row), and take the area from the file path.
- **Anchor an `Edit` on text copied from `grep -n` of the file, not retyped.** Two anchors typed from memory failed on a wrapped line's punctuation.
  LESSONS.md is all CRLF and the Edit tool kept it so (350 of 350 lines after the append): check with `grep -c` before reaching for a converter.

## 1.0 — 2026-10-10 — pof (W17 part 1)
- **A row that does not follow its neighbour breaks the previous row's adjacency assertion, and its own gap assertion must look only BACKWARD.** M–O's test says "my
  first initial is the letter after the earlier row's last"; T–Z registers after M–O but P–S lie between, so the new test asserts consecutive-among-themselves, first
  after the earlier last, and every gap letter unread by the specs registered up to and including the row (rows registered later are excluded by position, so the P–R and
  S waves do not turn it red). Put no fixture in the gap and derive the open-initial fixture from what no spec reads.
- **A glob initial with no file stays in the glob.** Y has no file at the pin, but the coverage row is written over it, so dropping it would make the two tools disagree.
  The border-probe tests are path-address tests and keep passing; just never assert that every initial has a file.
- **A delegated survey calibrated on the settled rows is again the fast path** (~6 minutes for a script that reproduced two rows exactly): hand over the targets, re-run
  both rows yourself, then run the new row. The throw-away helpers (home assignment, users search, key collisions) are small files written with the Write tool.
- **Never put a stray `cat` ahead of a heredoc in one shell call.** `cat > /dev/null; node - <<EOF` waited on the terminal until the harness killed it at its time limit;
  the payload never ran. Make the edit with the Edit tool when it is a few lines.
- **Open a file-copy of the backup for the rehearsal, not a serialized buffer of a WAL store** (`new Database(buffer)` failed with "unable to open database file");
  back up first with the backup API, then copy that file to a temp path and run the full ingest twice on the copy.

## 1.0 — 2026-10-10 — pof (W17 part 2)
- **The records carried four claims alone (2's handle side, 4, 5, 6 and 1's counts); the clone was needed for named parts only:** the 138-of-138 stub count (732 bodies), the S and P–R ancestors in
  the deepest chain and in the update-hook holders, the 69 unstored parents and the 33 extenders. Name each clone read in its claim; nothing needed more than a read.
- **Index every header of the clone, validate it against the store, and measure the stopgap by the PLACE of the parent file, not by row.** One index over all 3842 headers agreed with 1747 of the 1754
  stored classes (the 7 misses were nested classes) and put the whole remainder in one pass: S 40 · P–R 17 · the area folder 10 · the NPC folder 2. Framed by row, the two small folders (16 and 14 open files)
  would have stayed invisible; by place they are the best yield per file (62.5 % and 14 %), which changes how the closing wave of F18 is planned.
- **Never write a sub-count of a gap, or a "no X in other rows" claim, from memory of a printed list.** My first draft of claim 2's gap carried two category counts I had not computed (11 and 15); the
  grouping script gave 8 and 20. Run the grouping, then write the sentence. The same slip would have kept "34 extenders": the part-1 note's total did not equal its own by-row list (33); recount from the list.
- **Read a classifier's leftover bucket before reporting its split.** The body reader left 6 load bodies as "other"; all six were registrations through a third call name, which made the split the survey's
  exactly (58 + 47). A "6 unexplained" would have read as a defect.
- **A predicted sharpening is still a claim: check each note against the record.** Claim 6 listed U044 and U051 for the wait-for-UI commands; only U051 gained (6 of 8 waits take no argument at all, so
  U044's argument schema learns nothing). Say which prediction failed even when every count held.
- **Before re-reading a judgment call "from the factory, the extenders and the tree data", check that each source carries any grouping.** The node factory is an alphabetical include list plus a table in hash
  order, the clone's `data/` holds symbol tables not tree data, and the 12 nodes concerned have 0 extenders and 0 mentions: three greps settle that the call stays a call, and a same-word hit (a bullet-move
  class containing the water-explode word) is another class (F19).

## 1.0 — 2026-10-10 — pof (W18 part 1)
- **A row registered below its registration predecessor pins position by registration, and derives both alphabetic neighbours from the specs registered BEFORE it.** The lower neighbour is the greatest single
  initial below the row's first among `ROW_SPECS.slice(0, i)`, the letters between are unread by every spec registered up to and including the row (rows after it excluded by position), and the upper
  neighbour must be `letterAfter(LAST, 1)` and be read by exactly the predecessor's spec and twin. Neither "first > earlier last" nor "first = letter after earlier last" is copied; the predecessor's own end-of-block
  assertions become "directly followed by the next row" (M–O's form).
- **A negative control into an unowned letter is not always green.** Widening both specs into T (owned) turned 11 tests in 4 files red; widening into R (owned by no spec) turned exactly one red — the new
  test's own `INITIALS.toHaveLength(1)` shape assertion, never the disjointness or gap tests. Report which assertion caught it; a one-initial row has that extra guard, a multi-initial row (W16) had none.
- **Derive the home groups' counts from the same script that prints the groups.** A first rule pulled the two knock-back-shock reactions into `spellbook` by a `Shock` substring; reading the printed groups
  caught it before the note was final (spellbook 39 → 37, state-graph 118 → 120) and every dependent number (handles per home, family-unit units, the margin) was re-run, not edited by hand.
- **`retire-stale.ts` refuses without `--root`** (it read nothing); give it the clone like the other tools, and say so once in the note rather than counting the refused call as a round.

## 1.0 — 2026-10-10 — pof (W18 part 2)
- **A learning pass needs no repo module and no file in the worktree.** The store opens read-only with better-sqlite3 required by absolute path from the main checkout, the clone is read with `fs`, and a class index of every header plus a chain walk is a scratch script
  outside both trees. Part 1 copied two scripts into the worktree root to resolve the `@/` alias; that is never needed for a read-only pass. Write the scripts with the Write tool: a bash heredoc carrying regex escapes or quotes failed twice (nothing written) and `sed -i` on an
  escaped regex stripped the backslashes.
- **Calibrate the instrument by reproducing the PREVIOUS wave's whole-tree figure before measuring the new one.** The same index and chain walk gave W17's 594 links / 69 unstored / 144 chains exactly, and only then the new 695 / 34 / 47; validate the index against the store first (1966 of 1973
  classes, 0 disagreements). A reproduced old number is the cheapest proof that a new one is not an artefact.
- **When two notes disagree by one on a count, they usually count different things: run the reader under BOTH definitions and report both.** M–O's 171 versus 172 was one node (arithmetic and a message send, no branch): 172 branch-free sources, 171 sources holding nothing but base calls and
  registrations. One definition per wave, stated, and an erratum line rather than a rewrite. A first reader flagged a fourth M–O source that was only a registration call with a numeric suffix in its name; read the leftover bucket before reporting the split.
- **Never write a sub-count or a "none of them is X" from memory — run the grouping or the relation first.** My first draft of claim 2 carried invented gap sub-counts ("about 36", "6") and the sentence "no outside extender is a stem-row side action"; the grouping gave 38 / 6 / 4 / 9 and the extender query found 2 stem
  side actions. A loose word list also matched the ordinal "Second…" in five names ("Sec"); anchor word lists at the end of the name or on a boundary and read the hits before counting them.
- **A per-place yield changes the recommendation, not just the table.** By row, the two small folders stayed invisible; by place the area folder is 87.5 % per file against P–R's 9.2 %, and after S the three together close the whole stopgap (34 → 0 links, 47 → 0 chains) in one wave. Report the
  "alone" and the "together" figures for every candidate, with the label rulings each one needs.
- **The records carried claims 1 (counts), 2 (handle side), 4's 33 declared, 5 and 6 (split, bases, handles) alone; the clone was needed for named parts only:** the 216-of-219 body count and the 3 real sources, the cook one-shot's behaviour, the parents in the area, P–R and NPC places, the extenders, the
  factory and the whole-word mention search. A claim whose prediction held on every count can still hold a wrong detail (the sender finishes at once; its timing is the send's): check each predicted kind against the record.

## 1.0 — 2026-10-11 — pof (W19 part 1)
- **A shared map is not a row: a place outside the row folder that joins the map joins every filter by map identity.** Nine row tests selected `ROW_SPECS` by `map === BEHAVIOUR_NODE_ROW_MAP`; two folder specs on that map would have broken four row-shape assertions. Select a row test's specs by PLACE (the shared-map decls specs directly in the first one's folder, derived at run time), and let the folder test assert that ROW_SPECS and FOLDER_SPECS partition the shared-map specs, so no spec leaves both lists unseen.
- **Calibrate EVERY column of a delegated survey on the settled rows, the secondary definitions too.** The agent calibrated stub definition 1 and shipped definition 2 uncalibrated: it printed 39 / 6 / 0, and on the settled rows it returned 101 / 66 / 66 / 80, exactly the bare-parent counts. A new figure that equals a different count from the same census is a rule bug, not a finding; re-run all four settled rows for the column before it enters a note (fixed: 216 / 138 / 144 exact, 170 for M–O against the settled 171, the known numeric-suffix artefact).
- **A fixture one letter past a row ("the next row stays open") expires the day that letter is registered.** M–O's `NEXT_ROW_OPEN` was P; P–R now reads it. Keep it as a file read by exactly the later-registered spec and its twin (derived by the matcher, not named), move it to the "other rows" list and move the covered / open / created counts with it, rather than deleting the probe.
- **Never put two store-touching tool calls in one message.** `retire-stale.ts --dry-run` and the first idempotence ingest went out as parallel calls; nothing moved (the dry run is read-only), but it breaks "each alone, in the skill's order". One command per call.
- **Only `status.ts` run twice is not a round, but say so.** It records no run; the count of recorded rounds is the ingest runs (#119 BOOT, #120 row round, #121 and #122 idempotence).

## 1.0 — 2026-10-11 — pof (W19 part 2)
- **Calibrate a stopgap walk by running it on the PREVIOUS state of the store, not only on the previous figures.** One script, two modes: `before` takes the new places out of the stored set and the node list (it reproduced W18's 695 links / 34 unstored / 47 chains / the depth histogram exactly), `after` is the measurement (740 / 0 / 0). The same code path proves the old number and produces the new one; a closed stopgap (0) is only believable next to a reproduced non-zero.
- **Anchor the place classifier and compare it to the brief before using it.** A loose pattern for "the P–R row" counted 267 classes against the brief's 98 (it matched every file stem starting with those initials in any folder, other action folders included); the anchored version (folder prefix, then the first letter after the file stem's prefix) gave 98 / 8 / 6. A place total that differs from the survey is a classifier bug, never a finding.
- **A case-insensitive substring rule hits inside longer words — tokenise at capitals and read the hits.** "Quest" matched every "Request" command and "revive" a projectile's revive: 16 hits became 13 real. Report the rule's hits and its false hits separately, and never edit the rule to the count.
- **Print the holder of a count before describing it.** I wrote "a boss's main move" for the 46-handle header from memory of the survey; a one-line query named the owner: the player's wall-climb, which turned a note about boss kits into one about traversal and stamina. The same goes for every "largest", "only" and "first".
- **A header search that skips qualified bases undercounts extenders.** Three area-tag extenders in the sound system spell their base with the namespace, so the bare-name search found 14 where part 1's search found 17. Reconcile the two figures by spelling before reporting; the difference was a counting rule, not a missing node.
- **Some predicted kinds live in a node's identity, not its parameters.** The NPC wait and talk commands, the dead-check pair and the recreate commands carry no completion handle and have stub bodies: the records cannot confirm a completion kind for them. Say "name only" and give the schema consequence (the node kind ships a default policy) instead of counting a handle that does not exist.
- **The records carried claims 1, 2 (handles and hooks), 4 (the 21 declared) and 5 alone; the clone was needed for named parts only:** the index (parents' places, chains, the five F22 holders), the extender, mention and factory searches (claims 2 and 6), two stub sources read by hand, and nothing else. Sequencing follows the measurement: with the Action stopgap at 0, the bases resolution waits for the first AI row so one reader change covers both node families.

## 1.0 — 2026-10-11 — pof (W20 part 1)
- **A reason's wording is not in the projection: read `upsertWrappers` before pricing a wording fix.** `reprojected` counts only a changed `projection_hash`, and a stored projection carries no gap-reason text, so rewording a shared map reprojects 0 rows and merely splits the `mapping_version` stamps (old rows keep the old one). Price an INEXACT remark by reading the store code and one stored projection, not by counting the rows under the map.
- **A row test that derives its initials from its own glob stays green when the glob is widened into an unowned letter, unless it pins the shape and the neighbours.** Assert the initial COUNT (a two-initial row has exactly two) and that the initials directly below and above are read by no spec registered through the row (by registration position, so later rows do not expire it): the widening into F then went red on three assertions. A widening into a glob another spec owns is caught by the literal-prefix argument, not only by probes.
- **Pin a row to its place by position among the shared-map specs, not by its folder, when a control widens the folder part.** `SHARED_DECLS[ROW_SPECS.length + 2]` keeps the test running (and red on its folder assertion) when a control rewrites the glob's directory; selecting by folder would leave it with no spec and crash at load with a reason that names nothing.
- **Match probes against Action-style multi-letter alternatives too.** Probing the AI folder with the Action rows' alternatives (`Fa`, `Fi`, …) made the F widening show as 24 probes read where 6 were expected: a one-letter widening also reads every longer alternative that begins with it.
