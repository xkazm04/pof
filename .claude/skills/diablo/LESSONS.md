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
