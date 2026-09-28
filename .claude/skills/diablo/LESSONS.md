# Lessons — diablo

## 1.0 — 2026-09-22 — pof
- **The registry consult changed the design and caught a defect, and it came AFTER the build.** The wrapper store was designed and implemented first; reading `import-normalization` then exposed that promotion bypassed the code-seed refusal (one validation door), and `reference-parity-gating` reshaped decision D3 (a reference-seeded step must not self-grade `pass`). Applied as a Law in v1.1: consult before a design decision.
- **Before calling a field a "design gap", grep the UE project for it.** Four of the dry run's gaps (slots, resistances, affixes, difficulty scaling) already existed in UE `Source/`; they were app-payload-vs-UE gaps, a different decision. Already a Law ("Schema flows down from UE").
- **Check whether a pipeline STEP already owns the field before mapping it onto the entity payload.** Bestiary's `Resistances` and `Monster Rarity` steps were the right home for two "gap" columns — which reframed the whole of Phase B as populating step artifacts (D3).

## 1.1 — 2026-09-22 — pof
- **A delegate's report is a claim; the overseer's re-run is the evidence.** cx-001 reported `done` truthfully, but the value came from re-running its acceptance commands in the worktree and re-ingesting real data (`unchanged 316`, refusal `observed 112`). Applied in v1.2 as oversight step 3.
- **A brief's out-of-scope list can leave a seam only the overseer sees.** Scripts were out of scope for cx-001, so the CLI would have printed a refused table as ingested; the overseer fixed it. When scoping a delegate out of a surface, check that surface after landing.

## 1.2 — 2026-09-22 — pof (W01)
- **Vitest has two failure channels.** An unhandled rejection is reported as a run `Errors` line while every test file passes; grepping `FAIL` missed a real defect of the overseer's own for a whole wave. A delegate (cx-003) surfaced it and filed it as "unrelated". Applied in v1.3 (oversight step 3).
- **A keyword probe can be fooled by the canon itself.** "The Diablo prompt still says Sundering" was the Diablo rule's own exclusion list. Look at WHERE a hit comes from (section header) before calling it a leak — then decide whether the rule should mention it at all.
- **Ask the delegate for open questions and verify them.** Astra's open question "pipelines embed PoF text" became the wave's most important finding (62 stub bodies) once measured.

## 1.3 — 2026-09-22 — pof (W02)
- **Fix the prompt before judging the producer.** Every W02 produce failure was a prompt defect (unnamed keys, text fields, lists, wiring structure), found in three rounds, each a new checker kind. When a delegate fails, read its artifact against the prompt it was given before blaming the model.
- **A pass needs the same scrutiny as a fail.** Stat Block passed on a declared gap; Abilities passed on an invention injected by PoF's own stub contract. The grader cannot see parity — the overseer checks parity by hand against the wrapper until an instrument exists.
- **Measure a defect across the fleet, then pin the census at zero.** 102/114 turned a zombie's Stat Block into a PoF-wide fix with a regression guard.

## 1.4 — 2026-09-22 — pof (W03)
- **Ablate before you theorize about a generator.** One style-off candidate turned "the model can't draw a zombie" into "our style fragment makes it a skeleton" — a finding PoF owns. Keep ablations to n=1 per arm and stop when the direction is clear; say the n.
- **An instrument that cannot fail is not an instrument.** The whole-frame value share read 0.99 on every image (the ground dominated). Before trusting a measurement, check it can produce a failing number on a plausible bad input.
- **Do not submit to a selection-only checker what you would not accept.** Concept 2D Art grades only that a candidate is selected; submitting a skeleton "zombie" would have been a false pass the loop created itself.
- **Commit the type (and any guard codex runs) BEFORE dispatching**, so worktrees branched from HEAD typecheck and can self-verify; land the reader after.
- **Before calling a failure pre-existing, run it on a clean HEAD worktree** (junction node_modules, remove the junction with rmdir) — 3 were; 2 others were mine from an earlier commit whose test dir I had not run.

## 1.5 — 2026-09-22 — pof (W04)
- **Never write a Path node on an n=1 ablation arm.** W03 blamed the style on one style-off image; n=3 showed the subject text was the cause. Get n≥3 per arm before the diagnosis becomes a node, and measure with a blind instrument, not by eye.
- **Look at what a render produced before judging it** — the first sprite sheet was black and tiny (lighting + framing), not a failure of the approach.

## 1.6 — 2026-09-22 — pof (W05)
- **Going to UE is where the real defects are.** One monster's first import surfaced six PoF defects no app-side test could (no ChaosResistance in UE, AttackPower dealing 0, every enemy a Sith, unit-normalised meshes, an import that saved only primary objects, a damage test that had never run). Take ONE entity all the way before widening.
- **Verify imports from DISK, not the asset registry** — the registry listed a Skeleton that was never written.
- **When a render is black, run a known-good control first** (the same capture in a map that is known to render): it separated "my map" from "my capture code" in one run.
- UE headless traps (also in the wave note): commandlets are null-RHI; `unreal.Rotator` is (roll, pitch, yaw); Git-Bash rewrites `/Game/...` args (MSYS_NO_PATHCONV=1); UBT needs DOTNET_ROOT = the engine's bundled .NET; the -game exit can hang on DDC maintenance — judge by the files and the log.

## 1.7 — 2026-09-22 — pof (W06)
- **Measure the thing the camera sees.** A monster that fought correctly rendered as nothing: its POSED mesh was 1/100 scale. Observing the mesh bounds per sample found it in one run, after three rounds of guessing at import flags.
- **Prefer the importer that carries everything in one task.** The FBX hop mangled units twice and dropped animations; `.glb` through Interchange brought mesh + skeleton + animation + PBR textures at once. Apply SIZE as a component scale (it scales the mesh and its animation together) instead of baking scale into assets.
- **A shared model is the content multiplier.** One rigged mesh + per-member tint produced three monsters; the pipeline records `sharedWith` so a family cannot drift apart.
- **Going up to gameplay finds what asset checks cannot:** an enemy on a foreign skeleton attacked exactly once (a montage that can never complete), and a monster with no stat row inherits the engine's defaults.

## 1.8 — 2026-09-24 — pof (W07)
- **A second family is the cheapest defect finder.** The zombie chain ran on skeletons with 8 of 13 tools unchanged, but
  the other 5 each hid a defect the first family's SHAPE masked (a stray mesh only a thin subject exposes, names only a
  second family repeats, a gap only a different producer phrasing reveals). Plan a second instance before widening.
- **Measure a conversion at runtime, per hit, from the log.** Health sampled every 2 s showed the right total at the wrong
  cadence; only the per-swing "Hit" lines separated "attacks faster" from "hits twice" — and the W06 "kills in 8 s" had
  been the same double hit, misread.
- **Read reference NUMBERS from the wrapper's raw row, never from a produced artifact.** A produced step's inner shape is
  unconstrained (3 damage shapes in 5 rows); a consumer that guesses the shape falls back silently.
- **When runtime and design disagree because of a known defect, record the gap — do not re-anchor on the bug.**
- **Save every hand-run command (scenario JSON, Tripo task ids, Blender calls) as a driver or a note**: W07 spent real time
  reconstructing W06's chain, and two drivers had never existed.

## 1.9 — 2026-09-24 — pof (W08)
- **When the data holds the parameters but not the mechanism, read the reference's CODE at the pinned commit** (learning only)
  and state what you learned as an engine-derived canon LAW the tool parses. The census gave frame counts; only the AI routine
  explained the cadence, and the prediction then matched the runtime to ±1%.
- **A visual verdict on COLOUR is the eye's prior until two eyes agree.** Always run the negative control on a second eye too:
  both eyes separated zombie from skeleton 12/12 and still split 0/6 vs 15/15 on recolours. And parse every eye's answer shape —
  the second eye had been answering all along and its answers were thrown away.
- **"Asset exists + sprite passes" is not "renders in the game".** Grep the play log for engine warnings about YOUR assets
  (`missing usage flag … Default Material will be used`): two waves of member tints had never drawn once.
- **A wave can change the game and move no pipeline number.** When that happens the missing number is the finding (no step
  grades behaviour) — say so rather than let a flat snapshot read as no progress.

## 2.0 — 2026-09-24 — pof (W09)
- **A new MECHANISM finds engine defects content never will.** The third family reused the whole content chain unchanged;
  every defect came from the ranged path (abilities granted per possession, no line of fire, a retreat that never yields).
  When a wave's content goes smoothly, the next wave should change the mechanism, not add more of the same content.
- **A re-possessing test harness is itself a condition.** The scenario swaps the controller, so possession runs twice —
  that is what doubled the grants. Know what your harness does to the thing it measures.
- **The verifier deferring is usually the verifier being right.** Packaging deferred because a script declared an asset the
  monster could never have; fix the declaration, never the verifier.

## 2.1 — 2026-09-24 — pof (W10)
- **Write the wave note before running, even when the wave starts with decisions.** W10 began with research + questions and
  the note was written after four items had run — the predictions for them are reconstructions. The note is the first
  act after the gate, not after the first result.
- **A research agent can overturn your own finding — re-ask the decision it fed.** The W09 "no AI outside the scenario"
  claim was wrong; the operator had decided on it. Correct the record everywhere it was written and put the decision back.
- **A dead mechanism usually fails silently at its edges.** The schema snapshot was `{}` because the script reported
  success when its input was missing; make every generator REFUSE a missing input.

## 2.2 — 2026-09-24 — pof (W11)
- **Negative-control every new gate on the code it replaces.** Reverting only the roller to HEAD turned a passing test into a
  finding (Legendaries with 5 prefixes) — the test's value was proven and a defect was measured at once.
- **When the reference's unit differs from PoF's design unit, aggregate at promotion, not in the mapping.** Wrappers stay one
  per source row (the raw truth); a family pseudo-wrapper goes through the same promotion door.
- **Commit derived snapshots in the same step you regenerate them** — an uncommitted `ue-schema.generated.json` was silently
  reverted by a later checkout.
- **Codex landing on a file another session has uncommitted:** back the file up, land, diff against the backup — the only
  change must be the task's own.
- **Measure cadence in GAME time, never from log stamps.** Wall-clock stamps on a headless run jittered ±0.1 s and first
  read the archer at 2.60 s against a 2.42 law; logging `GetWorld()->GetTimeSeconds()` on the attack made the residue visible
  and attributable (a 0.25 s re-probe, then a 0.1 s hold), each a real defect.
- **Before attributing a failing UE test, rebuild the baseline.** Set aside only your own changed sources (back up, revert,
  rebuild, rerun, restore) — "it touches a different controller" is an argument; the identical failure on the baseline is proof.
- **Every reader of an aggregate must apply the same aggregation.** Promotion aggregated affix families, status.ts did not —
  so all 50 read STALE forever and the flag stopped meaning anything.
- **Run the FULL functional suite (every map) after an engine-wide behaviour change.** W12 checked 36 PoF tests plus 3 maps
  and called it clean; the map suite held the one test it broke (a placed enemy that now moves). Predicting "outcomes may
  change — measured" is only honest if the measurement covers where they change.
- **A pre-change baseline must COMPILE the pre-change code.** Rolling back modified files while leaving that commit's new
  files in place failed the build, and the tests ran the stale binary. Check `Result: Succeeded` before reading a baseline.
- **Screenshot-heavy scenarios step the clock in big frames**: 50 samples meant up to 0.4 s per frame, and a 0.1 s input
  never fired. Keep samples low when timing matters, and inputs wider than the worst frame.
- **Make the prediction precise enough to fail.** "Every rolled value sits in its tier's range" is what exposed the roller's
  second item-level scaling (295/297 out of range at ilvl 30). "Affixes roll" would have passed.
- **Before blaming the system, check the checker's key.** The first roll check flagged 15 level-gate breaks, and all of
  them came from a name collision in the reference ("Crimson" twice) that my lookup assumed unique.
- **An npm script is only real once it has run.** `snapshot:ue-schema` called a binary that isn't a local dependency and
  had never executed; the loop had always used `npx tsx` by hand.

## 2.3 — 2026-09-26 — pof (W16, machine B, unattended)
- **A new machine is a new environment: probe the harness before the wave.** Three machine-A assumptions (codex.js path, vault path,
  data root) broke silently or loudly; a "model at capacity" refusal ended tasks as NOT COMPLETED until the dispatcher learned to back off.
- **A read-only codex sandbox cannot read outside its working directory on Windows** — two research runs silently fell back to upstream
  master via the network. A git-excluded junction inside the repo (`.reference` → the clone) made the pinned tree readable; brief it by that
  relative path and tell the delegate to STOP if unreadable.
- **Never build a brief with `node -e "..."` in bash** — backticks inside it are command substitutions and silently corrupt the goal.
  Write the generator to a .mjs file.
- **A pass needs scrutiny at FLEET scale too.** 56/64 first-pass passes hid 16 false passes (gap markers in list entries) and a prompt that
  had truncated every conversation — both found only by reading artifacts and grepping all of them for the marker.
- **A delegate's acceptance scope is a claim about coverage.** Two tasks ran `src/__tests__/catalog` only and missed 5 failing tests under
  `src/__tests__/lib/catalog`. Brief both directories.
- **An unattended loop needs the machine awake.** Windows idle-sleep does not see background CLI work: a 5-hour freeze looked like
  two "stalled" codex runs. Hold a SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED) process for the session (no admin, no setting changed).
- **A delegate may answer with its PLAN as the final message** (cx-b24 round 2, "partial" + a plan, then the host slept). Resume with "implement it now".
- **Parallel delegates all editing one CLI file (scripts/diablo/ingest.ts) collided 5 times**: land the rest with git apply --exclude, then GNU `patch -p1 --fuzz=3` for that file and READ where fuzzy hunks landed. Better: split the CLI per catalog so tasks stop sharing one file.
- **A delegate's 'changed assertions' list can hide a law violation** (cx-b50 moved spell to-hit 0.95→0.91 by applying a range penalty the canon says spells never have). Check every changed expectation against the canon laws before landing.
- **A delegate's synthetic fixtures pass where real ids differ.** cx-b53 matched loadout items by the `id` column; the real Sorcerer staff's
  itemdat row has a BLANK id (the engine resolves by enum ordinal). Run the real-data CLI before landing every model change, not only vitest.
- **Write task generators with the Write tool, not a bash heredoc**: apostrophes/backticks in a long goal broke the shell and the dispatch
  then ran against a missing task file.
- **Two canon imports crashed for weeks unseen** (statusSpecs/storeSpecs imported first → TDZ). vitest's loader and the CLI's import order
  both hid it; a one-line `tsx` import of each module found it. A cheap static guard beats a behavioural test for load-order bugs.
- **A snapshot tool that disagrees with promotion lies at scale**: status compared raw wrappers while promotion used handler pools → 82
  false "stale". When a new promotion path is added, the snapshot must read the same path.
- **An opt-in model input needs a test that toggling it moves its target quantity.** W47 added expected resistances; defaults stayed
  byte-identical and the option ran — and it changed nothing, because no monster attack carried an element. "Identical when off" +
  "runs when on" cannot tell a working feature from a disconnected one.
- **A delegate's reading of a call's boolean arguments is a claim**: cx-b72 read `(…, true, true)` as isDamageShifted and concluded
  monster projectiles do 1/64 damage. Trace positional booleans to the callee's signature before accepting a 64× conclusion.
- **Claim-level audits beat shape graders and numeric parity.** W49 (AI), W59 (lore briefs) and W53–W58 (the canon's own laws) graded
  atomic claims against the pin: passing artifacts were 56–86 % true, laws ~81 %. Errors cluster in CONDITIONS (gates, predicates,
  roll granularity, failure branches, runtime order), never in the headline numbers — the part parity-on-numbers cannot see.
- **Audit the laws before producers amplify them.** A wrong law is copied into every entity that cites it (6 AI clusters traced in
  W49/W51). Our own canon injected external lore too (Khanduras in d1-world).
- **"Expected best" is for what a hero FINDS, not what it BUYS.** A buyer conditions on the shelf; unconditional expectation ×
  availability double-discounts (W56 round 1 made every resist item look worthless).
- **Delegates loosen tests to fit their text.** cx-b80 relaxed two plain-English style tests to admit engine identifiers in law
  bodies; brief "never loosen a test to fit a corrected body" and diff every test file a law-edit task touches.
- **A "facts only" direction turns missing references into denials.** W65: invented fell 39→14 % but contradicted rose 0→27 % —
  the producer asserted the absence of quests/services it was never shown. Before tightening a direction, check the producer HAS the
  facts (reference values across linked catalogs); a direction can change error kinds, never add knowledge.
- **A new law is a new amplifier.** W73's three laws were verified by a delegate yet two were overbroad (a missing precondition, an
  over-general "targeting" statement); the next produce round (W74) turned them into new wrong claims across many monsters. Hold new
  laws to the same claim-level audit as old ones BEFORE they ship.
- **The same misread recurs across fresh delegates.** Three separate auditors read MoveMissileAndCheckMissileCol's positional booleans
  as isDamageShifted. When a misreading recurs, encode the verified fact as a law so the next reader does not re-derive it.
- **The xhigh stall watchdog (40 min of event silence) can reap healthy runs.** 2026-09-28 ~01:00–01:47 three xhigh runs (a large audit
  JSON, a big write task, a report) were reaped while composing; codex itself answered normally. Resume the same session with
  `POF_CODEX_STALL_MIN=80` and ask for incremental file writes / short evidence strings — the research is kept in the session.
- **Audit A/B must be blind and paired under ONE auditor.** The same 16 dialog briefs scored 92.7 % under one xhigh auditor and
  82.3 % under another (W89); a cross-auditor comparison showed a false regression. Mix both variants in one audit with hidden X/Y
  labels (key kept in the vault) and tell the auditor what NOT to grade (rebuild/UE proposals).
- **Derived stats are frozen on PROMOTED entities.** descentSim reads a monster's cadence from its promoted entity data, so a model
  change to derive/behaviourScale reaches the descent only after re-promotion. W92's first "after" run measured only the hero half.
  Order for any model wave: land → re-promote everything status.ts lists as stale → THEN run the after-measurement.
