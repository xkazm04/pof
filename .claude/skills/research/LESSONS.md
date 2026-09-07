# Lessons — research

## 1.0 — 2026-08-12 — pof
- New source class calibrated: **veteran-designer pure-design talk** (no tooling, no engine specifics — e.g. Timothy Cain's RT-vs-TB). Behaves like the knowledge/best-practice class but with a lower ceiling: findings are design-quality *criteria* (eval rubric lines), never presets or pipelines. Yield 3 S-criteria from a 13-min talk; that is a successful run, not a thin one.
- Phase-4 candidate tables should state each candidate's HOME, not just its bucket — the one declined pick (#4) died because its assumed home turned out to be a mechanical engine, and naming homes up front made that a cheap Phase-5 discovery instead of a post-build one.

## 1.0 — 2026-08-12 — pof (run 2: Cain batch ×5 — the hardening run; bumped to 1.1 in the same change)
- Batch mode over N same-class videos works: one pick gate, one TDD round, one commit. Cross-video repeats of a rule merge into one criterion and signal load-bearing rules. Codified in SKILL.md v1.1 (designer-talk source class: 5 routing shapes + module-gap rule + batch mode).
- Dual-home routing (eval criterion + generation-prompt enrichment) resolved run 1's watch item on its first trigger — "born compliant AND judged compliant" is the right default for pattern-shaped findings, criterion-only for prose principles.
- New gap class: a registered sub-module with no MODULE_CONTEXTS entry is effectively unjudged (dialogue-quests). The fix is adding the whole context, seeded from the finding.
- **Version conflict note:** `~/.claude/skills/research/` holds a DIFFERENT skill lineage (the personas-specific /research, no version field). Sync ritual step (b) skipped — overwriting would destroy the personas skill. This PoF-adapted skill lives only in-repo; if a shared library home is ever wanted, it needs a distinct name (e.g. `research-pof`).

## 1.1 — 2026-08-14 — pof (Mixar AI-Blender-fork run; bumped to 1.2 in the same change)
- **Read the gap's NEIGHBOURS, not just the gap** — APPLIED to Phase 5 step 2 (hence the bump). A candidate phrased as "feature X is missing" aims you at the unbuilt half and away from the built half, which is where the real defect can be. The candidate was "add metallic/roughness bakes"; the surrounding code revealed each bake *cleared the target's material slots*, so the shipped path had been exporting untextured meshes since it landed. That defect was worth more than the requested feature and no candidate table would ever have contained it.
- **"Declined tool, adopted test" — a GUI-decline sub-class, NOT yet codified (1st observation).** The standing GUI-only/off-domain rule correctly killed the tool in one line, but the demo drove the exact pipeline stage our own script automates, so its test escalation read as a checklist to fail against our code — and supplied both findings. Watch for a 2nd instance: a GUI tool operating on a stage the project already automates may be a higher-yield source than its bucket implies. Deliberately not written into SKILL.md at n=1.
- **Refusal-with-a-reason is now the house style in this project's Blender layer** (`unwrapPlan`, `cullLimitReason`, now `bakePlan`). Having the pattern established made an otherwise awkward call trivial: metallic has no Cycles bake pass, so it is returned as skipped-with-a-sentence instead of forcing a choice between fragile graph surgery and silently dropping what the user asked for. Generalisable prompt for any run: when a picked finding is only *partly* deliverable, look for the project's existing shape for saying so before deciding to descope it.
- **Version conflict note still stands:** `~/.claude/skills/research/` is a DIFFERENT skill lineage (the personas-specific /research, no version field, and it auto-loads over this one when `/research` is invoked). Sync ritual step (b) skipped again — overwriting would destroy the personas skill. This run had to read the repo-local SKILL.md explicitly after the wrong lineage loaded; that is now a recurring tax worth a rename (`research-pof`) if it bites a third time.

## 1.2 — 2026-08-14 — pof (run 2 of the day: AI-low-poly; bumped to 1.3 in the same change)
- **A narrow `git add` does NOT bound a commit — the pathspec on `git commit` does.** Two
  research sessions ran concurrently in one checkout; the other session's commit swallowed
  this run's finding because `git commit` with no pathspec commits the whole shared INDEX,
  including what a parallel session staged after your `add`. Recovered with `reset --soft`
  (local, nothing lost). Applied to SKILL.md Phase 10/11 as `git commit … -- <paths>` plus
  a "treat untouched modified files as live WIP, don't rewrite shared history" rule.
  Generalises to any repo where multiple agent sessions share a working tree.
- **The impact-map is trustworthy as an index and untrustworthy as a measurement.** A pick
  was built on its "214 components → fail 5/100" line, which recorded a state a later commit
  had already fixed — with the fix documented elsewhere in the same file. Rule of thumb worth
  carrying: when a candidate's premise is a *measured number* quoted from research memory,
  confirm it against code before the pick gate, not after. Cost here was one of four picks,
  and it converted cleanly into an already-have entry.
- **Second independent instance of "declined tool, adopted test"** (the 1.2 entry asked for
  one before codifying). Different source type — a provider comparison whose headline was
  already user-declined, while its incidental asides produced 3 findings for 3. The pattern
  is broader than GUI tools: when a source drives the same pipeline stage the project
  automates, the yield is in its throwaway steps, not its thesis.

## 1.1 — 2026-08-14 — pof (run `ai-vs-human-retopology`; ran v1.1, file was bumped to v1.3 mid-run by a parallel session)
- **When a candidate dies against an API's SHAPE, record the shape — not the candidate.** A
  pick died because the vendor's API keys every mesh-consuming task to a prior task id, so the
  demo was showing the GUI. The same constraint had already killed a different endpoint in an
  earlier run, and that run recorded only *that endpoint*, so this run re-derived it from
  scratch with the web budget. The durable artifact is a note naming the whole family ("no
  task type accepts an uploaded mesh; upload is images-only"), which inoculates against every
  future sibling endpoint. Generalises to any vendor-API research: a catch scoped to one call
  is a catch you will pay for again.
- **"Nothing checks X" is usually "the check exists and is never called."** A finding about a
  missing budget check turned out to be a *wired-nowhere* check: the class-aware thresholds
  had zero production call sites and every asset had been graded against a blind default since
  the day they shipped. Unit tests cannot see this — they import the function directly.
  Method rule worth adding to the deep-verify phase: **before writing a "missing check"
  finding, grep the checker's CALL SITES, not just its definition.** This is the third
  same-shaped defect this project has surfaced (an unmapped switch case, a route with no
  client callers, now a threshold resolver with no callers), which suggests it is a general
  property of maturing codebases rather than a local quirk.
- **No version bump with this entry, deliberately.** Both improvements above are real method
  changes, but a parallel session bumped this skill 1.1 → 1.2 → 1.3 during this run and was
  still editing SKILL.md. Bumping to 1.4 on top of a live editor would create a version race
  and risk clobbering their method edits. Per the contract — never bump without an applied
  edit — the lessons are recorded here for whichever session next edits the method safely.

## 1.3 — 2026-08-14 — pof (same run, second bump: the verification half of the concurrency fix)
- **Green tests prove the working tree, not the commit.** After the v1.3 pathspec fix, the
  parallel session *rewrote history*, which dropped a shipped finding's content back into the
  index — 306 tests still passed, `git log` still showed a plausible run, and nothing looked
  wrong. Only a per-symbol `git grep <symbol> HEAD` sweep caught it. Applied to SKILL.md
  Phase 10/11 as a mandatory closing check. Generalises to any shared checkout: verify the
  artifact is in HEAD, never infer it from a successful commit command or a passing suite.

## 1.4 — 2026-08-14 — pof (same run, third bump: prove the artifact, not the operator)
- **A green suite and a success marker are not evidence that an output changed.** A shipped
  finding (auto-smooth in a headless Blender stage) passed its unit tests, ran live, and
  printed `SHADING=auto_smooth@30` — while changing **0 of 30,967 exported normals**. The
  tests could only assert argv construction and marker parsing; neither can see the artifact.
  Applied to SKILL.md Phase 7: any finding whose value is "the output is better" needs an
  **A/B against a control plus a diff of the real output** before it counts as shipped.
- **Measure the magnitude, not the presence, of the change.** Forcing the same feature to
  take effect (clearing the source's custom normals) "worked" — and rewrote 99.9% of normals
  by a mean of 73°. It would have been easy to bank that as success and ship a degradation.
  The guard is comparing how much and in which direction, not whether something moved.
- **Check a practice's REASON against our inputs, not just its plausibility.** The source's
  "you must fix the shading" is true for a hand-driven Blender workflow and false for a path
  whose inputs are generator glTF carrying their own custom normals. The finding was
  well-evidenced against the code (the shading op really was absent) and still wrong about
  the world. Codebase-grounding proves the gap exists; it does not prove the gap matters.

## 1.5 — 2026-08-14 — pof (live-credit run: fixtures must be captured, not imagined)
- **A guard tested against invented data passes and never fires.** A "stop re-rolling when
  the failure repeats" guard was unit-tested with two identical failure strings. Real output
  never repeats identically — the counts move every roll, and the tail of the reason list
  fluctuates — so the shipped guard did nothing. It took TWO live runs at real cost to find,
  first the number drift, then the tail noise. Applied to SKILL.md Phase 7: paste the actual
  observed payload into the fixture; an unseen payload means the test is a guess.
- **Spending on a live run is how you learn the instrument is pointed at the wrong thing.**
  The credits did not just validate the loop — they revealed that the quality gate the loop
  depends on is calibrated for finished assets and runs on raw pre-retopo output, failing
  ~100% of jobs. That is worth far more than the feature being tested, and no amount of unit
  testing could have surfaced it. When a run's value hinges on an external service's real
  behaviour, budget for the live call rather than inferring.
- **Watch for a heuristic being tuned twice.** Two consecutive refinements of the same
  matcher (whole-list → primary-reason) is the signal to ask whether the heuristic is the
  right shape at all. Here it was worth keeping only because the default is off; had it been
  on by default, the honest move would have been to remove the feature, not tune it again.

## 1.6 — 2026-08-17 — pof (run `souls-like-3-days`; bumped to 1.7 in the same change)
- **Measure a numeric premise on local artifacts BEFORE the pick gate.** Phase 3's "no grep/read yet"
  rule is right for code, wrong for produced artifacts that already sit on disk: one `trimesh`
  extents loop over `generated/*.glb` cost seconds and converted a hunch into a proven, fixture-
  bearing finding (every mesh = 1.0 m). Applied to SKILL.md Phase 3 as a scoped exception.
- **"Affected tests" must include the golden/snapshot suites that pin the edited data.** Two prior
  research runs each added a `ue-gotchas.ts` entry, ran the gotcha unit test, and shipped — while
  the prompt golden rail that renders those entries into every task prompt went red and stayed red
  for 8 days. Applied to SKILL.md Phase 7 validate line.
- **Version conflict note — THIRD strike.** `~/.claude/skills/research/` (personas lineage, v1.3
  now) auto-loaded over this skill again on invocation and had to be overridden by reading the
  repo-local SKILL.md. Sync step (b) skipped again (overwriting would destroy the personas skill).
  Three strikes = the rename to `research-pof` is now warranted; not done here because renaming the
  slash command is the user's call. Recommend it explicitly.


## 2.1 — 2026-08-23 — pof
- **An OPERATOR's return value is a claim; only the artifact is evidence.** Phase 7 already demands an A/B artifact diff, and it caught a shipped no-op this run: `bpy.ops.object.quadriflow_remesh` returns `{'FINISHED'}` while changing nothing, so a green 10-test suite + clean tsc/eslint accompanied a 43 MB unreduced mesh labelled as retopologised. Worth stating explicitly in the method: when a finding WRAPS a third-party operator/CLI (Blender ops, UE Python, ffmpeg, any exit-0 tool) rather than authoring a pure function, the success check must read the object the operator was supposed to change. This is narrower and more actionable than the existing "prove it with an artifact diff" line, which a reader can satisfy with "the command ran".
- **Cheap sequential probes beat one clever hypothesis.** Four ~30s probes (params -> in-memory vs imported -> custom normals -> weld+normals) each killed exactly one hypothesis and surfaced a fact I could not have guessed (glTF splits seam vertices, so a watertight mesh re-imports with 61k non-manifold edges). Generalizes the 08-19 "clone before proposing" lesson from source-reading to runtime behaviour.
- **Dispatch verification agents in IMPLEMENTATION order, not candidate order.** Parallel agents roughly halved wall-clock, but the report for the candidate I implemented first arrived last, and I nearly duplicated its file reads.

## 1.7 — 2026-08-31 — pof

- **Prove a knowledge destination is wired before depositing into it (APPLIED in 1.8).** The
  run's finding-5 home looked obvious: `reference-roles.ts`'s `GEN_PROMPTING_PRACTICES`, a
  curated list of generation-prompting best practices, several of them deposited by earlier
  `/research` runs of this same skill. One grep showed it is imported by **no production
  file** — only its own test and a comment. Those earlier runs each shipped a practice no
  generator ever saw, and this run would have added a fourteenth. A dead knowledge store is
  indistinguishable from a live one from the inside: same shape, same green test, same
  satisfying commit. The method now requires one grep for a non-test consumer before routing
  a knowledge finding, and Phase 7 says to record a dead store as a backlog delta.
- **The artifact check catches defects that are invisible to a correct-looking suite — and it
  is worth running even when the artifact is something you just computed.** The skill already
  demands an artifact diff when the claim is "the output is better". This run applied it to a
  freshly written pure generator, where it felt redundant: 20 green tests, no external
  dependency, deterministic output. Running the emitted mesh through the project's own gate
  found two real defects anyway — an open-ended tube (manifold with boundary), and then a
  version that was watertight, consistently wound, and inside out (signed volume −0.037). No
  assertion in the suite could see either, because both are properties of the *whole* mesh
  that only a mesh-aware tool computes. Generalisation: when a finding emits a structured
  artifact, run it through whatever validator the project already owns for that artifact type
  — the validator knows invariants your unit tests will not think to assert.
- **A title/content mismatch on the source is worth stating loudly in the note.** The video's
  title (and its oEmbed title) advertised a completely different subject from its transcript,
  and a `descoped-reopenable` entry existed for the advertised subject. Ingesting on the title
  would have "re-checked" a descope trigger that never fired. Trust the transcript; record the
  mismatch in the research note's frontmatter so a future run does not treat the run as a
  re-check of the titled topic.

## 1.8 — 2026-08-31 — pof

- **A source can arrive twice under two different URLs.** The same 31-min transcript came
  back as a second video id hours after being fully mined. The cheapest tell was the prior
  Research note's one-line summary matching the transcript — so Phase 1 should skim the
  recent Research notes' SUMMARIES, not only `Patterns/`. Cost of missing it: a full
  re-mine of an exhausted source.
- **When a source turns out to be exhausted, audit the previous run's deliveries instead
  of padding a candidate table.** That produced the only real finding of the run.
- **APPLIED (v1.9): the consumer census.** The previous run diagnosed a dead knowledge
  store and then shipped three dead modules — tested, green, imported by nothing,
  including the render gate it called its headline. One grep per shipped export closes
  the whole class. Added to Phase 7.

## 1.9 — 2026-09-02 — pof (source: a curated link directory; output: an external knowledge bundle)

- **A link-directory source has an inverted payload.** The run was pointed at an
  "awesome-list" of ~500 game-dev links, mostly to dead or obsolete tools. Extracting
  candidates from the LINKS would have produced nothing. The payload was (a) the **book
  canon** the list points at, and (b) the **section taxonomy itself, read as a coverage
  checklist** against the destination corpus. That diff — their sections against our
  subjects — produced twelve units of real work in one pass, four of them whole
  territories with zero prior coverage. Generalizes: for an index-shaped source, do not
  extract from the entries; diff the source's implied taxonomy against your own.
- **The destination is not always this repo.** Phases 5-8 assume findings land as code
  here. This run's destination was a separate knowledge registry with its own authoring
  contract, and the correct move was to route the whole run through THAT repo's brief
  (director + one worker per subject folder) while keeping this skill's discipline —
  draft-before-reconcile, re-open every line before citing it, deviations recorded
  without lowering the standard. Not proposing a method change on one occurrence, but a
  future run with an external destination should look for the destination's own contract
  before assuming the in-repo TDD-and-commit shape.
- **The consumer census (v1.9) generalized past code, and it earned a law.** Five of the
  twelve units independently found the same defect class in the consuming repo —
  a declared input that nothing reads (a gate condition as free text no linter parses, a
  locked flag ignored by the only traversal consuming it, an economy pool written and
  never read, no code reading a delivered image's dimensions, a numerator with no
  denominator). It is the same shape as this skill's own dead-knowledge-store lesson, and
  the destination corpus promoted it to a cross-cutting law. The census is not a
  code-review trick; it is a general question to ask of any declared field.

## 1.9 — 2026-09-07 — pof
- **A golden/snapshot rail's DRIFT LIST is the consumer census for knowledge entries — applied, v1.10.** The method already said to run the golden suite before committing a gotcha, but framed it purely as a guard to satisfy. This run showed it is also the cheapest available *evidence*: adding `creature-rig-not-biped` drifted exactly `task-mixamo-import` and `task-character-setup`, which named the entry's production reach for free. The corollary is the valuable half — a knowledge entry that drifts NO goldens is the dead-knowledge-store defect (v1.9's own lesson) arriving by a different door, undetectable by the grep-based census because a data entry has no importer to find. SKILL.md now says to read the drift list, not just clear it.
- **When one file holds two mirrored interfaces, anchor-based patching silently hits the wrong one.** `ParsedMeshFinish` and `MeshFinishResult` share several field names; three consecutive edits landed fields in the wrong interface, and every TEST still passed because vitest does not typecheck — only `tsc` caught it. Not a method change (the existing "validate includes tsc" rule already covers it), but a reminder that the validate step is load-bearing for edits made by script rather than by hand, and that uniqueness of an anchor should be asserted against the SLICE, not the file.
- **On a re-mined source, the yield shifts from knowledge to instrumentation.** Fourth mining of one channel: its part-decomposition/kit knowledge is now saturated in the destination corpus (three entries cover it, and a parallel session was independently building the code half). What remained were the source's *checks* rather than its practices — "is there red in the UV stretch view", "did the rigger actually handle this anatomy" — which mapped onto a missing measurement and a missing gate. Worth expecting generally when a source's prose has already been absorbed; not proposing a method change on one observation, but a fourth-visit run should look for missing NUMBERS before missing knowledge.

## 1.10 — 2026-09-07 — pof
- **The ≤3 web-call budget is wrong-shaped for a multi-topic source.** A news roundup names a dozen unrelated products; each picked candidate is an independent question needing its own authoritative check. Three picks against a flat per-run budget meant either going over (what happened — 5 calls) or shipping a pick unverified. APPLIED in 1.11: the budget now scales per picked candidate for multi-topic sources, and the run states at the gate which budget it is on.
- **Verifying the source's own factual claims is the highest-yield use of the web budget, and the first thing squeezed out of it.** The video said SQuadGen's code was "already released"; the project page says *Code (coming soon)* — no repo, no licence, no weights. That one fetch inverted the finding (build → the standing descope holds). Roundup/demo sources make confident claims about releases, licences and availability precisely where the speaker has the least stake in being right. APPLIED in 1.11.
- **The consumer census earned its place a second consecutive run, and it fired on a NEW shape.** Prior instances were knowledge stores with no importer. This time it was a *mode on an already-consumed seam*: `runTripo` gained `multiview-to-3d` with green tests while the only production caller hardcoded `mode:'image-to-3d'`. The census generalizes past "does anything import this module?" to "can any caller actually REQUEST this branch?" — worth keeping in mind when a finding extends an enum or union rather than adding a file. Not a method edit yet; noting the second data point.
- **A candidate's stated subject can be a decoy for a gap the repo already owns.** The pick was "add multi-view input (Pixel3D)"; Pixel3D turned out to have zero repo anchors and freshly-dropped code. The real, shippable finding was that PoF had *described* multi-view reference sets since August (`reference-roles.ts`) while every generator consumed one image. This is the "read the gap's NEIGHBOURS" rule paying off on the INPUT side rather than the output side — the skill's existing wording is about sibling behaviour of a half-built feature; the same instinct applies to knowledge the repo already holds but cannot spend.

## 1.11 — 2026-09-07 — pof
- **The consumer census has a blind spot: defaulted parameters.** The run shipped a
  material-density table, ran the census, and every symbol passed — the wired route imported
  all of them. The live output still came back `phys_default` for every single prop, because
  the route called `physicalForSize(size)` and never passed a material. Imported, exercised,
  and inert. The census asks "does a production file import this symbol"; it cannot ask
  "does the wired path reach this data". Applied in 1.12: after the import check, name the
  argument that selects into each shipped data structure and grep the CALL SITE for it.
- **Live runs kept paying long after the tests went green.** Three Qwen calls surfaced four
  distinct issues, none reachable by fixture: the inert table above; a depluralizing helper
  that turned `glass` into `glas` (a material whose own name ends in s); a prompt that
  classified stairs and a bush as extractable props, after which the solver stacked the bush
  on the stairs; and a *design* flaw where "no props found" returned 502, conflating an
  honest empty scene with a vision outage. Reinforces the existing artifact-diff rule from
  a new angle — it is not only "did the output change", it is "print the output and read
  every field", because a defaulted field looks identical to a computed one.
- **The codebase had already written the principle I needed.** The 502 flaw was solved
  elsewhere in the same package (`input-gate.ts`: "an unavailable gate has measured nothing
  and cannot condemn"). I had read that file during deep-verify and still had to see the bad
  status code to apply it. Worth a future consideration: when a run adds a new failure path,
  check whether a SIBLING in the same subsystem already names the states, and copy its
  vocabulary rather than inventing one. Not proposing a method change on one instance.
- **Reading the gap's neighbour reshaped the whole run.** The candidate was "add a decomposer
  feeding `generateComposition`". One grep showed `generateComposition` had zero importers
  anywhere — so the honest finding was the wiring, not the decomposer, and shipping the
  decomposer alone would have produced a well-tested second orphan. The existing
  read-the-neighbours rule earned its place again; no change needed.

## 1.12 — 2026-09-07 — pof (web-discovery: LLMs + Blender in game pipelines)

- **An empty row in a scope table silently excludes a tagged item — check the row before
  tagging.** Applied to SKILL.md this run. The corpus convention said to tag new gotchas with
  `modules`, and `MODULE_GOTCHA_DOMAINS` maps `multiplayer`/`physics`/`save-load`/
  `dialogue-quests` to `[]`. A filter of the shape "universal + tag-intersecting" then admits a
  tagged item to those modules never, and it is invisible from the inside: the entry renders
  correctly everywhere else, its test passes, the diff looks right. This is the defaulted-parameter
  lesson one step earlier in the pipeline — the earlier lesson asks whether the wired caller passes
  the selector, this one asks whether the routing table has a row to select INTO.
- **Per-file golden drift counts are a free routing check.** The skill already treats the drifted
  golden list as the consumer census. The COUNTS carry more: 3 lines into each `ue-cpp` prompt and
  exactly 1 into each of the four `ue-python` prompts confirmed each entry reached the right
  prompts. "35 files changed" alone would have been compatible with every entry landing in every
  prompt, which is a different (and wrong) outcome.
- **Verifying the source's release claims paid again, in the opposite direction from last time.**
  LL3M's paper cites a project page; the page's "Code" link is a placeholder with no repo and no
  license. One fetch turned a plausible "adopt this multi-agent bpy system" candidate into a
  standing descope. The 2026-09-07 rodin run learned the same thing from a "code already released"
  claim. Two runs, two sources, same defect class — the citation is not the artifact.
- **A user asking for "deep research, 20 URLs" overrides the phase-5 budget, and should.** The
  budget exists to stop a feature-rich single source triggering a wholesale scan. It is not a cap
  on an explicitly-requested discovery round. Say which budget you are on at the gate (this run:
  5 searches, 11 fetches) so the spend is legible rather than silently exceeded.
- **The most useful finding was a NEGATIVE answer to the user's framing question.** The requested
  comparison (two frontier models in Blender) had no independent evidence behind it — one
  vendor-reported CAD number and social-media demos. Saying so plainly, and then redirecting to the
  runtime-verified benchmark that DOES exist, was worth more than any finding in the table. A
  web-discovery run should be willing to answer "the thing you asked about is not measured" before
  it starts mining.

### Follow-up half of the same run (both open findings addressed)

- **A test that pins a threshold's current behaviour is not evidence the threshold is
  well-formed.** Two calibration tests asserted `enforced-pass` off two confirmed labels; they
  read as coverage and were actually encoding the defect (a threshold declarable from a sample
  too small to resolve it). When a fix forces an existing FIXTURE to widen, ask whether the
  fixture was the bug rather than treating the widening as collateral. Generalizes: any test
  whose fixture size is below the size the assertion's claim requires is pinning noise.
- **The neighbours rule made both findings BIGGER, not just verified.** "Add collision to the
  import path" became "the import path has no production caller, so nothing imports a generated
  mesh into UE at all"; "the threshold may sit above the human ceiling" became "the threshold
  can be met by one coin flip". Both times the candidate pointed at the half that was missing
  and the defect was in the half that existed. This is now three runs in a row.
- **Syntax-check emitted code — it is a real gate that string-matching tests cannot be.** The
  collision work generates Python; `ast.parse` on every emitted variant costs one command and
  checks something no `expect(py).toContain(...)` can. It found nothing this time, which is the
  point: it is a standing check rather than a hope, and it is the closest thing to an artifact
  diff available when the artifact only executes inside an editor you cannot launch.
- **Say when red is not yours, and prove it.** Two failures in an unrelated component test were
  pre-existing; stashing the run's changes and re-running the file took seconds and turned "I
  think that's flaky" into a fact worth putting in the commit message.

### Live-run half (user asked for proof against the real engine)

- **A green suite plus a success marker plus a real artifact can STILL be wrong — diff the
  artifact SET, not just the one you were looking at.** The import returned
  `collisionElements: 2`, wrote a real `.uasset`, and passed every test — and had silently
  dropped the material and three textures, because suppressing `task.save` (needed so the
  mesh is not persisted before the edit) means nothing saves automatically. `1 -> 5 uassets`
  was the only signal. The existing lesson says "prove it with an artifact diff"; the
  refinement is that the diff must cover everything the operation was supposed to produce,
  not the single output the finding names.
- **Failures teach faster than passes, so run the thing that can fail early.** Two live runs
  produced two defects. The first died with the engine's own TypeError (`paths[0]` was a
  Texture2D — a glTF import yields textures and materials and the array is not mesh-first),
  which no fixture would ever have modelled because a fixture author picks index 0 for the
  same reason the code did.
- **Execute emitted code against a stub before spending a slow real run.** Between the two
  live imports I ran the generated python against a fake `unreal` whose import returns the
  texture FIRST, and asserted which object got collided and which got saved. Seconds, and it
  tested BEHAVIOUR where the unit tests could only test the string. For any skill that
  generates code for a slow or unavailable runtime, this belongs between "tests pass" and
  "run it for real".
- **Watch for the test that passes because of a NEIGHBOURING construct.** My first save-loop
  assertion was `/for .* in paths:[\s\S]*save_loaded_asset/`, which the broken script already
  satisfied — the mesh-SELECTION loop also iterates `paths`. A regex spanning `[\s\S]*` over
  a whole generated file will find its two halves in unrelated places. Assert on the
  distinctive token (the loop variable) and on counts.
- **Do not set an env var to make a gate report a better basis.** The Tier-1 critic could not
  run (no `POF_TRIPOSR_ROOT`), so every run planned on basis `assumed` and said so. Pointing
  the var at any python with trimesh would have produced a `measured` reading that no
  measurement backed. Instead I measured out-of-band and reported the DIFFERENCE it would
  have made (451 components / 59 real parts -> convex hulls, where assumed chose a BOX),
  which is more useful than a manufactured green and keeps the gap visible.

## 1.13 — 2026-09-07 — pof
- **A knowledge entry and the code it governs drift apart, and an "already-have" catch is where that hides.** The run's source taught a rule PoF already ships as a gotcha; the reflex is to log a catch and move on. One extra grep at the governed code path found the wired route doing the opposite of the rule it renders into every prompt. Applied to SKILL.md Phase 5.2 as an explicit step (v1.14): on an already-have catch against a KNOWLEDGE store, go check compliance.
- **The load-bearing guard in a new pipeline stage came from the first LIVE run, not from design.** A multi-object mesh split looked complete with a speck filter; running it on a real asset showed that one shattered object is indistinguishable from a group of props by component count, and the guard that separates them (face coverage) was invented only after seeing 24 junk assets. The existing "artifact diff, not a passing test" rule already covers this — this run is a second, independent confirmation that it applies to NEW stages, not only to "the output is better" claims.
- **Shadowing note (project-specific but recurring):** the ACTIVE skill was the user-level `~/.claude/skills/research` at v1.13, while the in-repo `.claude/skills/research` sat at v1.11. Editing the repo copy would have been inert. Check which copy the invocation names as its base directory before editing.

## 1.14 — 2026-09-07 — pof
- **A pure module has no artifact to diff, so it needs a GROUND TRUTH that predates it — and the repo often already contains one.** This run shipped a bone-name conform planner: nothing on disk changes, so the artifact-diff rule does not apply and the honest fallback looked like a pile of self-written cases. `rig-presets.ts` turned out to hold a hand-authored 20-bone Mixamo→UE5 mapping, i.e. the correct answer written down by a human years before the module existed. Deriving that mapping from names alone (20/20) is evidence self-written cases cannot produce, and it immediately caught a matching pass that *looked* like the confident one — equal chain indices — but shifts a whole bone chain by one, because the two conventions disagree on where a chain starts. Applied to SKILL.md Phase 7 (v1.15).
- **Two runs against the same file on the same day: the second one's job is to read SIDEWAYS.** An earlier run today shipped an anatomy-mismatch refusal to the exact script this run touched. The refusal was correct and inert: the same script never pinned `model_version`, and the API default is biped-only, so the check it gates could only ever return one answer. Neither run's own candidate list contained this — it came from the existing "read the gap's NEIGHBOURS" rule, and it is the strongest confirmation of that rule so far, because the neighbour was *another agent's fresh, correct work*. A gate can be real, tested, and unreachable; when a run finds a gate already shipped, verify it can FIRE before logging an already-have catch.
- **When a test asserts something the source docs do not actually say, fix the TEST.** A generated case assumed every non-biped morphology has a stock animation preset; the docs name one for five morphologies and none for `avian`. Correcting the assertion (rather than padding the data table to make it pass) turned a wrong assumption into a genuinely useful fact — a bird can be rigged but has no clip, so it needs an external library — which then went into the module's own refusal reason.
