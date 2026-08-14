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
