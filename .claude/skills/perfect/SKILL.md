---
name: perfect
contexts: tracked
memory: vault
category: Development
description: Session-after-session product perfection loop for PoF. The strongest available model at xhigh reasoning (currently Fable 5) directs — it walks context-map.json context-by-context, proposes 5 challenged, high-value directions per context (features, design elevations, significant optimizations), gates them with the user until 10 are accepted, then orchestrates Opus-class builder subagents on ONE shared branch — grouped so their write sets cannot collide — while making every review/merge decision itself. All state lives in the Obsidian pof vault so any future session resumes the loop exactly where the last one stopped. Invoke with `/perfect [init|propose|build|status|smoke|reflect] [context-name]`.
argument-hint: "[init|propose|build|status|smoke|reflect] [context]"
version: 2.2
---

# Perfect — the direction-and-delivery loop

> One model configuration is best at *judgment* — seeing what would make a product excellent, challenging its own ideas, reviewing diffs ruthlessly. A well-scoped builder is great at *execution* inside a tight brief. `/perfect` wires the two together in a permanent loop: **the strongest model at xhigh directs, Opus-class builders build, the vault remembers.** Each session moves PoF measurably closer to the best UX, architecture, and feature quality it can have; no session ever starts from zero.

## Roles — Director and Builders

- **Director (the main session — the strongest available model at xhigh reasoning; currently Fable 5, Opus 5 acceptable fallback).** Owns everything that is judgment: opportunity-scoring contexts, drafting directions, adversarially challenging them before the user ever sees them, running the acceptance gate, writing builder briefs, answering builders' product questions mid-flight, reviewing every diff, deciding merge/redo/drop, running the repo gates, committing, and writing the vault. The Director **never delegates a decision** to a builder and never rubber-stamps a builder's diff.
- **Builders (Opus-class subagents, `model: "opus"`, one per *lot* — see Phase B step 1).** Each receives a tight brief (direction specs + acceptance criteria + an explicit **write set** + repo-convention digest) and implements **in the wave's single shared tree**, alongside its siblings. Isolation is not what keeps them from colliding — disjoint grouping is. Builders return a structured report; when they hit a genuine product ambiguity they **return the question instead of guessing** — the Director answers via `SendMessage` and the builder continues.
- **Scouts (Explore subagents, cheap).** Produce the per-context current-state brief the Director synthesizes directions from. Never used for judgment.

## The Obsidian vault — durable loop state

Resolve the vault root (first hit wins), then use `$VAULT/Perfect/`:

```bash
for v in "C:/Users/kazda/Documents/Obsidian/pof"; do
  [ -d "$v" ] && VAULT="$v" && break
done
# Portable fallback: if no Obsidian vault exists, use <repo>/.perfect/ (same schema — still an Obsidian-openable folder).
```

```
Perfect/
  Perfect.md               # HOME / Map-of-Content — always reflects current truth:
                           #   mission, the scored context QUEUE with the CURSOR,
                           #   the ACCEPTED POOL (n/10), shipped ledger headline, link to last session
  config.md                # per-repo overlay: gates to run, wave shape, wave size, Class C list,
                           #   direction sizing rules, cooldown, ## User taste, + ## Skill improvement log
  contexts/<name>.md       # one per context-map context (long-lived, updated in place)
  directions/<slug>.md     # one per direction (long-lived; the atom of the whole loop)
  sessions/<YYYY-MM-DD[-n]>.md  # immutable run records, each ends with a `next:` pointer
```

**Context note** (`contexts/<name>.md`):
```markdown
---
name: <context-map name>        type: perfect/context
group: <group>                  category: ui|api|lib|data|test|config
opportunity: <0-10>             # value reach × headroom × strategic fit (Director's judgment)
last_proposed: <YYYY-MM-DD|never>   cooldown_until: <date|—>
directions: ["[[<slug>]]", …]
---
## Current state   (scout brief digest + file:line evidence — refreshed each proposal pass)
## Direction history   (proposed / accepted / REJECTED-and-why — rejections are memory too)
## Shipped   (direction → commit SHA → observed effect)
```

**Direction note** (`directions/<slug>.md`):
```markdown
---
slug: <kebab, stable>           type: perfect/direction
context: "[[<context-name>]]"   lens: feature|ux|optimization|robustness|wildcard
status: proposed | accepted | building | shipped | failed | dropped | rejected
size: S|M|L                     # must fit ONE builder session (≲15 files, no cross-context schema break)
proposed: <date>  accepted: <date|—>  shipped: <date|—>  commit: <sha|—>
---
## What & why   (the user value, one paragraph, no fluff)
## Evidence   (file:line of the gap/opportunity in today's code)
## Acceptance criteria   (3-6 checkable bullets — the builder's contract AND the review checklist)
## Risks / non-goals
## Build record   (builder report digest, review verdict, gate results — filled during build)
```

**Session note**: phases run, contexts covered, accept/reject tallies, build outcomes with SHAs, deltas, and **`next: <the exact resumption instruction for the following session>`**.

Vault hygiene: slugs are stable; **update notes, never duplicate**. Subagents may fail to write files in some harnesses — after any parallel phase the Director MUST `ls` the target dir and **backfill missing notes from the agents' returned content** before trusting "written".

**The vault is NOT version-controlled and Obsidian's file-recovery never sees agent writes** (it only snapshots edits made in the app). A clobbered note is gone. Therefore, every write obeys these three rules:

1. **Never `open(path,'w')` a session note.** `sessions/<date>.md` is NOT unique — two `/perfect` sessions on one day collide. Check existence first and take the next free `-2`, `-3` suffix. Same for any note you did not create this session.
2. **Re-read `Perfect.md` immediately before writing it, never patch the Phase-0 copy from memory.** A sibling session that wraps mid-run rewrites the cursor, `pool`, `shipped_total` and `last_session` — a regex written against the Phase-0 text silently no-ops against the new text while your other replacements land, producing a self-contradicting header.
3. **An operator's "that session is finished" means it finished — including its wrap.** It does NOT mean the vault still matches what you read before it wrapped. Re-read; do not assume.

When you do clobber something: say so immediately, stop, attempt recovery from the surviving derived sources (`Perfect.md`'s cursor, `directions/*` frontmatter, `git log`, MEMORY.md), and leave the reconstruction **labelled as a reconstruction** with what is lost stated explicitly. Never quietly write over the gap.

## The loop — a vault-driven state machine

Every invocation starts the same way; the vault decides which phase runs.

### Phase 0 — Recall & register
1. Read `Perfect.md` (+ last session's `next:` pointer). If missing → run **init** (below).
2. Read `context-map.json`; diff against `contexts/*` — new contexts get notes + a queue slot, removed ones get archived (`status: retired` in frontmatter).
   **First verify the map's PROVENANCE and say which source you chose and why.** `context-map.json` is written by the Personas app's context scan (`"generator": "personas-context-scan"`), NOT by this repo, so it can be arbitrarily stale or come from a peer device:
   ```bash
   node -e 'const m=require("./context-map.json");console.log(m.generator,m.generated_at,JSON.stringify(m.stats))'
   ```
   If `generated_at` is far behind `git log -1 --format=%cd`, say so in the resumption sentence and treat the queue as provisional — a context that has since been split or renamed will score wrong. **Shape is not provenance:** `.personas/contexts.txt`, `.claude/codebase-context.md` and the local app DB can all disagree with the map. Use the map for the QUEUE, and the **local app DB's `dev_contexts` names** for anything the app anchors to (see § App context coverage).
3. Repo rituals: `git status` — this repo hosts **parallel sessions**; note foreign WIP files and never sweep them into your commits. Scan MEMORY.md signals that veto directions (e.g. shipped programs, "honest ceiling" verdicts, retired subsystems — don't re-suggest what a prior campaign settled).
4. **Coverage check**: if `.personas/` exists, note which contexts have gone stale in the ledger (no fresh node in 30d — see *App context coverage*). Stale-and-high-opportunity outranks stale-and-low; a context with fresh coverage is a weaker cursor candidate than one the loop has never anchored. This is a queue *tiebreaker*, never an override of the user's steer.
5. Announce the resumption point in one sentence, then go where the state machine points: pool < 10 → **Propose**; pool ≥ 10 (or user said `build`) → **Build**.

### Init (first run only)
1. Scaffold the vault tree + `config.md` (record: gates = `npm run validate` [typecheck + lint + vitest], plus `npm run test:e2e` only when catalog-pipeline step components/registries are touched; wave size = 3; cooldown = 2 rounds; **Class C list** — see Phase B step 3 — derived from THIS repo, not assumed).
2. Score every context 0-10 for **opportunity** = user-facing reach × headroom (distance from "perfect", judged from context-map metadata, `docs/architecture/*`, `docs/catalog/*`, and memory) × strategic fit (active arcs in memory — e.g. transparency/judge campaigns, UE truth ladder, catalog pipeline program). Write the ranked **queue** into `Perfect.md` with the cursor at the top. Don't deep-read code yet — scoring is refined per-context at proposal time.
3. Write session note; proceed straight into Propose.

### Phase P — Propose (context by context, until the pool holds 10)
Loop while `pool < 10` and the user hasn't said stop:

1. **Cursor** = highest-opportunity context not on cooldown. **Prefetch**: before presenting context *k*, launch the scout for context *k+1* in the background.
2. **Scout** (Explore, "very thorough", read-only): given the context's `file_paths`, `entry_points`, `db_tables` → return a current-state brief: what exists, what's rough, dead ends, UX seams, perf smells, with `file:line` evidence. **A component only "exists" if it RENDERS — trace every surface the brief describes to an actual mount point.** A file with zero consumers is a *finding*, not a feature; PoF has shipped whole panels that no route ever mounted.
3. **Draft 5 directions** — one per lens by default: **feature** (new user value), **ux** (design/flow elevation), **optimization** (perf/cost/significant simplification), **robustness** (failure modes, observability, architecture), **wildcard** (the non-obvious idea a great PM would pitch). Each sized to ONE builder session; a bigger vision ships as its phase-1 slice.
   **Weight the slate by `config.md → ## User taste`** — the lens spread is a starting point, not a quota. The user accepts **outcome-value work** (features/optimizations with a visible payoff) and rejects **cosmetic churn**; pre-filter the 5 through that lens and say in the presentation that you did. Default depth is the *engine*, not the chrome: for any context with backend/algorithmic substance (pipelines, acceptance engines, harness, judges, UE bridge), most directions should be architecture-level (data model, algorithms, lifecycle, prompt/eval paths, cost structure); UI surfacing appears at most once-twice unless the user steers otherwise. Scout prompts must match this depth (trace the full pipeline, not just the components).
   **Highest-yield direction shape: mine the user's own recent corrections for rules, then grep the codebase for places that violate them.** "Your stated rule, broken in code at these line numbers" beats an invented improvement.
4. **Challenge before presenting** (the Director argues against itself; a direction that fails any check is replaced, not presented):
   - Does it already exist in code? (scout evidence, not assumption)
   - Was it already proposed/rejected/shipped? (check `contexts/<name>.md` history + memory — the MEMORY.md campaign ledger is dense; many "obvious" ideas are already DONE)
   - Does it conflict with an active arc or a "removed/settled, don't re-suggest" memory?
   - Is the value claim concrete — can I name the user moment it improves?
   - Can one builder session genuinely ship it behind the acceptance criteria?

   **State a predicted EFFECT as a hypothesis to measure, never as an assertion.** Write "measure
   which cells move and report it" rather than "this will move cells off green — that is the point".
   A confident prediction in a direction note is an instruction to confirm it, and a builder that
   believes it may tune toward it. In round 13 the Director asserted a provenance fix would cost
   greens; measured, it lost none and instead lifted 17 cells off RED — the map had been
   over-condemning, the opposite failure. The prediction was wrong in DIRECTION, not degree, and only
   survived contact because the criteria demanded a measurement.

   **Director self-check before the gate** — a proposal that fails any of these never reaches the user:
   - Names the concrete files it will touch (from scout evidence, not guessed).
   - Names the user-visible outcome in one sentence a non-developer would care about.
   - States why it beats the next-best alternative direction for this context.
   - Survives the taste filter above (outcome-value, not cosmetic churn).
   - Any benefit claim survives a fact-check against the product's **default** configuration, not its most flattering one.
5. **Present** the 5 in chat — numbered, each: title · lens · size · one-paragraph why · evidence · acceptance criteria. Then gate with **AskUserQuestion (multiSelect)** — the tool caps options at 4 per question, so use TWO questions in one call: Q1 = directions 1–3, Q2 = directions 4–5 (labels = `N · short title`, description = one-line value claim + size). The user can annotate via "Other" (e.g. `edit 2: …`, `stop`); selecting nothing in both = none accepted.
6. Record outcomes in the vault (rejected ones too, with the user's implied reason — rejections steer future proposals). Accepted → `directions/<slug>.md` with `status: accepted`, pool counter++, context gets `cooldown_until`. Update `Perfect.md` after every context, not at session end — a killed session must lose nothing.
7. **A `none` gate that carries a steer** (the user says what they wanted instead) is a re-scout order, not a rejection of the context: promote the steer to `config.md → ## User taste` if it generalizes, re-scout at the steered depth/angle, and re-propose the SAME context once before advancing the cursor. Never re-present any rejected direction.

### Phase B — Build (ONE branch, disjoint builders, the Director decides everything)

> **Process efficiency is the first constraint, ahead of defensive isolation.** The per-context-worktree
> shape this loop used through v1 bought protection against **a collision that correct grouping prevents
> for free** — and charged for it in worktree setups, node_modules junctions, N cherry-picks with
> union-merge hazards, a whole extra cross-builder integration phase, and junction-ordered teardown.
>
> **The rule: isolation is not the answer to collision risk — disjoint grouping is. A wave with a high
> collision risk is a wave that is grouped wrong.** Fix the grouping; don't build machinery around the
> mistake.

1. **Partition by write set — the load-bearing step; get this right and the rest is bookkeeping.**
   For each accepted direction derive its **write set**: the files it will actually modify, taken from the
   direction's `## Evidence` (`file:line`) plus a Director read of the call path. *A guessed write set is
   worthless* — if you cannot name the files, the direction is not ready to build, and that is the same
   reachability discipline Phase P step 4 demands.
   Group directions into builder **lots** so write sets are **pairwise disjoint**:
   - Two directions overlap → they go in the **SAME lot** (one builder, sequentially) or one is **deferred**
     to the next wave. Never split an overlap across concurrent builders.
   - No disjoint partition exists → **the wave is one builder.** That is a legitimate, honest outcome, not
     a failure of the plan.
   - ≤ `config.wave_size` lots concurrent; ≤ 3 directions per lot (a 4-direction brief exceeds one
     agent-session budget).
   - Lots need not follow context boundaries. Disjointness is the criterion; one context can be two lots,
     and two small contexts can share one.
   - **A live non-wave agent or sibling session is a write-set constraint, not just a hazard.** Files held
     by an agent that is not part of this wave are **reserved** exactly like a sibling lot's — defer any
     direction that needs them.
   Class C files (step 3) are excluded from write-set analysis — nobody but the Director touches them, so
   they cannot create overlap.
   Present the wave plan in one screen — **lot ↔ directions ↔ write set** — and say explicitly which
   directions were merged or deferred to reach disjointness. On user go (or `/perfect build`), execute.

2. **One branch for the whole wave.** No per-builder worktree, no per-builder branch, no per-direction merge.
   ```bash
   git switch -c perfect/<YYYY-MM-DD>      # from a clean master
   ```
   Every builder works in this one tree and commits onto this one branch. One source tree means warm
   incremental rebuilds and one coherent `tsc`, and it means the wave is **continuously integrated** rather
   than integrated at the end.
   **A branch switch is a whole-tree mutation and obeys the same sibling-safety rule as `git add -A`.**
   Before creating the wave branch, check `git status` AND for in-flight agents in this checkout. If either
   shows a live sibling, **do not switch branches** — either commit onto the current branch with
   `git commit --only <paths>` scoping, or put the wave in **ONE** worktree (never one per builder — same
   branch, same protocol) and apply the junction recipe once:
   ```powershell
   $root = "<abs repo root>"; $link = "$root\.claude\worktrees\perfect-wave\node_modules"
   if (Test-Path $link) { Remove-Item $link -Force -Recurse -Confirm:$false }
   New-Item -ItemType Junction -Path $link -Target "$root\node_modules" | Out-Null
   Test-Path "$link\.bin\tsc"    # MUST print True before you brief anyone
   ```
   **Do NOT use `cmd //c mklink //J … "..\..\..\node_modules"`.** `mklink` resolves a RELATIVE target
   against the **current** directory, not the link's — from the repo root it silently creates
   `C:\Users\node_modules` and still prints "Junction created", and the failure only surfaces as a builder
   that cannot find `tsc`. **"Junction created" is not evidence — the `Test-Path …\.bin\tsc` assertion is.**
   Teardown at wrap: `cmd //c rmdir` the junction **FIRST**, then `git worktree remove`.

3. **The shared-resource protocol.** One tree means shared mutable state; each piece gets exactly one owner,
   and this whole block goes verbatim into every brief.
   - **Class A — your own write set.** Yours alone; edit freely.
   - **Class B — append-only registries.** In PoF: `src/components/layout-lab/steps/index.ts`,
     `src/lib/module-registry.ts`, `src/lib/feature-definitions.ts`, barrel `index.ts` exports, and
     `docs/README.md`'s doc map. Editing allowed, but **re-read the file immediately before each edit and
     anchor on a string unique to your change** — never rewrite one whole.
   - **Class C — Director-only.** Derive this list from THIS repo's `config.md` overlay; do not assume
     another project's set. In PoF it is thin: **the git index**, `context-map.json`, `step-facts.json`,
     and any generated artifact under `generated/`. PoF has no locale codegen and no ts-rs bindings, so the
     locale-conflict machinery other projects need does not apply here — say so rather than importing it.
     Builders *report* what they need and the Director applies it once at quiescence.
   - **Commits — builders still commit their own work** (never-lose-work beats commit hygiene, and builder
     death is the norm), but through an index-safe form: `git add <only your NEW files>`, then
     **`git commit --only <every path in this commit>`**. `--only` builds the commit from those paths alone
     and *disregards whatever else is staged*, so a sibling's in-flight staging can never ride along.
     **Never** `git add -A` / `git add .` / `git add -u` / bare `git commit` / `git commit -a` /
     `git stash` / `git checkout <path>` / `git restore` / **`git commit --amend`** (a sibling can commit
     between your commit and the amend, and the amend then re-messages *their* commit). An `index.lock`
     race fails loudly and harmlessly — retry it, never work around it.
     Note `--only` takes **whole files**: a shared Class-B registry carries a sibling's in-flight line into
     your commit, so that commit range may not be bisectable. Say so in the message rather than hiding it.
   - **Builds:** what a shared tree cannot protect against is a sibling's half-written source. **A compile
     or type error in a file outside your write set is a sibling's transient state: re-run once, then
     report it — never fix it.** Same for a test that fails in a suite you do not own. Report the *file*
     the error names, not just the count — that is what separates "my work is broken" from "a sibling is
     mid-edit".

4. **Brief** each lot (template below); launch with `model: "opus"`, `subagent_type: "general-purpose"`, all
   briefs in one message so they run concurrently. **Brief quality bar:** the write set, the step-3 protocol
   verbatim, and the exact gates — `npx tsc --noEmit`, `npm run lint` (no new warnings in touched files),
   targeted `npx vitest run <files>`. Director review time is for judgment, not gate failures.

5. **Mid-flight decisions**: a builder returning `DECISION NEEDED: …` gets an answer from the Director via
   `SendMessage` — product calls, trade-offs and scope cuts are the Director's alone. A builder that stops
   without its final report gets one `SendMessage` nudge.
   **Builder-death recovery (session limits WILL kill builders): inspect and salvage BEFORE assuming loss.**
   A builder that dies has usually already done the work and died at its gate/report/commit step. Lint the
   orphaned files scoped, confirm the entry point exists, confirm the only type errors belong to
   *still-running* siblings, then snapshot with **`git commit --only <its write set> --no-verify`** and a
   message that says plainly what was and was NOT verified — *not* `git add -A`, which was safe only while
   the tree was private. Re-dispatching pays full price to regenerate work that already exists.
   **Dead builders cannot clean up after themselves:** sweep their temp routes/scripts, and distinguish
   them from a still-running sibling's (deleting the live one's scratch route mid-run breaks it). Name temp
   artifacts per-builder so ownership is legible — builders share one harness scratchpad, so a generically
   named temp file gets overwritten mid-wave.

6. **Review — the Director earns its title here.** Per direction: `git show <sha>` (the commits are already
   atomic and already on the wave branch — there is no branch-vs-master diff to get wrong). Review against
   the acceptance criteria, repo conventions (`@/` imports, `logger` not console, no hex colors —
   `@/lib/chart-colors`, `UI_TIMEOUTS`, `Result<T,E>`, API envelope via `apiSuccess`/`apiFetch`, the shared-
   component manifest in `.claude/CLAUDE.md`, ≤200 LOC per generated pipeline file), and taste. Verdict per
   direction: **keep** / **redo with notes** (SendMessage; the builder fixes in place with a follow-up
   commit) / **drop** (`git revert` that commit, `status: failed`, reason recorded). Never accept on "tests
   pass" alone — read the diff. Hold commit messages to the Director's own bar; reword at review if needed.
   **Docs-vs-code check:** when a diff documents a behavior (contract text, formula, doc comment,
   `docs/architecture/*` edit), grep for the code that implements it before keeping it — a contract
   describing behavior the code doesn't have is worse than nothing.
   **Builder refusals are signal, not disobedience.** A builder that argues an instruction down with
   evidence and satisfies the acceptance criterion another way has done its job; weigh the evidence.
   **A criterion written to BOUND one change will sometimes block fixing a larger defect that change
   uncovers.** That is the criterion working, not failing — but the Director must then decide, not
   leave it. Round 13: "no audited step may change class" correctly bounded an engine-fallback fix,
   and correctly stopped the builder fixing the *real* defect one seam down (an unrecognised engine
   name defaulting into the TRUSTED bucket, mis-classing 95 audited steps). The builder reported and
   refused; the Director landed it as a separate commit in the same wave — because that wave's own
   change had just routed 10 newly-un-condemned cells through the mismatch. **If your wave creates an
   overstatement, your wave corrects it.**
   **Re-measure a builder's headline number before repeating it.** The same round reported 82
   affected steps; the independent re-count found 95 (a whole engine string had been missed). Builder
   numbers are evidence, not verdicts.
   **Any branch-vs-master comparison, for any purpose, is three-dot or it is wrong** — and after a squash
   merge neither form answers "did this land": grep for a signature symbol instead.

7. **Integration gate, once, at quiescence.** After every builder has reported and been reviewed, run the
   `config.md` gates on the wave branch: `npm run validate` (typecheck + lint + vitest), plus
   `npm run test:e2e` if catalog-pipeline step components/registries were touched. This is confirmation
   rather than discovery — one branch means the builders' work was already compiling against each other all
   along. Reds are fixed inline as Director commits **and the output is read BEFORE the next state-changing
   action**. A departing builder that flags a regression in its final report is gate input, not noise.

8. **Land the wave: ONE merge.** Apply any Class C work and commit it. Then:
   ```bash
   git switch master && git merge --ff-only perfect/<date>    # or --no-ff if master has moved
   ```
   The per-direction commits *are* the atomic history — no cherry-pick, no squash-per-direction, no N-way
   conflict resolution. If master moved under you, this is one ordinary content merge instead of N. Re-run
   the gates on master after the merge.

9. **Doc-sync in the same turn**: structural changes update the matching `docs/architecture/*` or
   `docs/catalog/*` file in the SAME change (CLAUDE.md law) — plus `docs/README.md`'s doc map if a doc is
   added or removed.

10. **Cleanup**: delete the wave branch once merged; if a wave worktree was used, `cmd //c rmdir` the
    node_modules **junction FIRST**, then `git worktree remove`, then verify the main checkout's real
    `node_modules` is still intact before moving on.

<details><summary><b>Exception path — surgery for a master that moves under you.</b> Not the default any more;
the one-branch shape removes the cherry-pick class entirely. Reach for these only when a concurrent session
dirties or advances a file you must land into.</summary>

- **Union-merge discipline:** both-append conflicts are usually safe to keep-both — but only when each side
  is a complete declaration. NEVER blind-union hunks whose sides end mid-function (a glued function and a
  swallowed closing brace turn master red). Read every seam.
- **Concurrent-session DIRTY files:** never stash, never wait — commit *around* them. Stage `HEAD + your
  hunks` straight into the index (`git hash-object -w` + `git update-index --cacheinfo`), content built by
  `git merge-file` (base=branch-fork, ours=HEAD, theirs=branch), plus a second merge-file for the working
  copy — the other session's uncommitted work stays theirs, and their later commit can't revert your change.
  After re-applying another session's delta, **diff the result against the captured patch and require an
  exact match** — a reverted value edit leaves both a clean `git status` and a grep-for-the-key satisfied.
- **Shared append-files** (`layout-lab/steps/index.ts`, `module-registry.ts`, barrel exports): never
  wholesale-`checkout` a branch's version across sequential operations — it clobbers earlier ones'
  registrations and tsc catches it too late. Patch-union
  (`git diff branch~..branch -- file | git apply --3way`) or regenerate from source, always.
- **Non-interactive history repair** at quiescence works:
  `GIT_SEQUENCE_EDITOR="sed -i '1s/^pick/reword/'"` + `GIT_EDITOR=<script that writes the fixed message>`.
  Do it before any final SHAs are recorded — every descendant SHA changes.
</details>

### Phase W — Wrap (every session, even interrupted ones)
1. Update every touched vault note; write the session note with the **`next:` pointer** (e.g. `next: propose — cursor at catalog-browser-ui, pool 7/10` or `next: build wave 2 — harness-autonomy + simulation-tools remain`).
2. `Perfect.md` headline refreshed: pool count, queue cursor, shipped-total, last-session link.
3. **Flush the memory outbox** — see *App context coverage* below. Do this for every context this session touched, including in a session that only proposed.
4. **Reflect on the skill itself**: 2-4 bullets in `config.md → ## Skill improvement log` — what dragged, what the user overrode, what the next round should change. This log is the input for the between-rounds skill revision.

## Direction quality bar (what earns a slot in the 5)

- **Value-first**: names the user moment it improves; "nice refactor" is not a direction unless it unlocks something.
- **Evidence-backed**: cites today's code (`file:line`), not vibes — **and cites the SYMBOL beside the
  line number**, because coordinates rot. In a multi-wave session they rot within hours: round 13's
  brief cited `labArtifactClient.ts:43-46` and wave 2 had already pushed that code to ~55-62 by
  inserting a function above it. A symbol survives; a line number is a convenience.
- **Claims about what a consumer USES must be traced, never inferred from what it is FOR.** "This
  input is unused, so dropping it is free" is the single most expensive wrong premise this loop has
  produced — the coach was described as ranking on status alone and in fact re-grades data, compares
  drift, and binds judge verdicts to a content hash.
- **One-session-shippable**: ≲15 files, no cross-context schema breaks; else slice it.
- **Novel to the vault**: not shipped, not pending, not previously rejected (unless the world changed — say so).
- **Lens-diverse**: default one per lens; substituting a second entry in one lens requires the Director to say why.
- **Fact-checked**: a benefit claim must survive a check against the product's *default* configuration.

## Builder brief template

```
You are an Opus-class builder for the `<context>` context of PoF (Pillars of Fortune) —
a Next.js 16 + React 19 + TypeScript + Tailwind 4 + Zustand 5 app (SQLite at ~/.pof/pof.db
via better-sqlite3) that is an AI-powered UE5 C++ game-development assistant.

YOU ARE NOT ALONE IN THIS TREE. <n> builders are working in this same checkout
on this same branch (`perfect/<date>`) right now. You have been grouped so that
your files and theirs do not overlap — that grouping IS the collision
avoidance, so respecting it is the whole contract.

YOUR WRITE SET — the only files you may modify:
<explicit file list>
Anything outside it requires DECISION NEEDED. A compile error, type error or
failing test in a file OUTSIDE your write set is a sibling's half-written
state, not your bug: re-run once, then REPORT THE FILE IT NAMES. Never fix it,
never revert it.

SHARED-RESOURCE PROTOCOL (non-negotiable):
- Append-only registries (layout-lab/steps/index.ts, module-registry.ts,
  feature-definitions.ts, barrel index.ts exports, docs/README.md doc map):
  you MAY edit, but re-read the file immediately before each edit and anchor on
  a string unique to YOUR change. Never rewrite one whole.
- DIRECTOR-ONLY, do not touch: the git index, context-map.json, step-facts.json,
  anything under generated/. REPORT what you need instead and the Director
  applies it once.
- COMMITS: `git add <only your NEW files>` then
  `git commit --only <every path in this commit> -m "..."`.
  `--only` builds the commit from those paths alone and ignores whatever else is
  staged, so a sibling's in-flight staging can never ride along in your commit.
  FORBIDDEN: git add -A · git add . · git add -u · bare git commit · git commit -a
  · git stash · git checkout <path> · git restore · git commit --amend.
  An index.lock collision is harmless — retry it, never work around it.
  COMMIT MESSAGES: bash **single**-quoted `-m '...'`, or a UNIQUELY-NAMED -F file.
  NEVER the PowerShell here-string form `-m @'...'@` — and note this is not a
  "PowerShell-only" caveat: passing that syntax through the BASH tool is
  exactly how it bites, because bash has no here-string operator there and
  silently keeps the leading `@` as the first line, i.e. as your subject.
  DOUBLE quotes are not safe either: `-m "...`code`..."` runs command
  substitution and SILENTLY EATS the backticked word — a commit body naming
  a symbol in backticks loses it. Use single quotes for any message
  containing code, `$`, or backticks.
  You cannot fix either afterwards: `--amend` is forbidden in a shared tree, and
  a sibling can land a commit on top of yours within minutes. Verify the
  subject with `git log --format=%s -1` right after committing.
- **Temp files: scratchpad only, and never inside a test tree.** Name them with
  your lot id AND put them in the harness scratchpad directory — never at the
  repo root, and *never* under `src/__tests__/` where the integration gate will
  execute them as part of the suite. A measurement harness that lands in the test
  tree becomes a test the whole wave has to explain.

Implement these accepted directions, one atomic commit each, message `feat(<context>): <title>`:
<per direction: What & why · Acceptance criteria · Evidence file:line · Risks/non-goals>

COMMIT EACH DIRECTION THE MOMENT IT IS DONE AND VERIFIED — never batch commits
for the end of the session. An interrupted session must lose at most the
direction in progress, not everything.

RUN COMPILES IN THE FOREGROUND — and if one genuinely exceeds the harness's
600s cap, background it and then IMMEDIATELY BLOCK on reading its result before
doing anything else. NEVER end a turn on a pending gate: no notification will
arrive, you will simply idle until the Director nudges you.

SEARCH BEFORE BUILDING: before implementing any new mechanism, grep for an
existing implementation of the same concept and LAYER ON it rather than forking
a parallel system. The Shared Component Manifest in .claude/CLAUDE.md is the
first place to look — unifying beats replacing.

A TEST THAT FAILS ON ITS FIRST RUN HAS DONE ITS JOB. Fix the code, not the
assertion, and pin what you learned.

IF AN INSTRUCTION IN THIS BRIEF CONFLICTS WITH AN ACCEPTANCE CRITERION, follow
the criterion and say so in your report — an argued-down instruction backed by
evidence is a good outcome, not disobedience.

NO INTERACTIVE GIT: `git add -p`, `git add -i`, `git rebase -i` HANG this
harness. When directions interleave in your own files, commit by FILE
boundaries and document the shared commit — never hunk-split interactively.

NAME ANY TEMP FILE WITH YOUR OWN LOT ID — builders share one harness scratchpad
and a generically named temp file gets overwritten mid-wave.

Repo law (non-negotiable — read the repo's .claude/CLAUDE.md first, it is the authority):
- Imports via `@/` alias, never relative `../../`. No raw `console.*` — use `logger` from
  `@/lib/logger` (console.error allowed). No hardcoded hex colors — `@/lib/chart-colors`
  or CSS variables. Timing constants from `UI_TIMEOUTS` in `@/lib/constants.ts`.
- API routes return the `{ success, data|error }` envelope via `apiSuccess`/`apiError`
  (`@/lib/api-utils`); client calls use `apiFetch`/`tryApiFetch` with RELATIVE urls.
  Fallible ops use `Result<T,E>` from `@/types/result.ts`.
- REUSE before building: the Shared Component Manifest in .claude/CLAUDE.md (CliProduce,
  StepFrame, ChartPanel, CandidateGallery, GlbViewer, DataTable, controls) and the ui/
  primitives (Modal, TabBar, MeterBar, StatusToken, RangeSlider, ChartLegend, Tooltip…).
  Never hand-roll a spinner/modal/tooltip/status chip.
- Catalog pipeline steps follow View/Produce/Acceptance (CLAUDE.md Rules 1-5): CliProduce
  for the Produce face, derived Acceptance from truth (never a manual toggle), ≤200 LOC
  per generated file, camelCase hierarchy-encoding filenames.
- Zustand v5: never persist transient state; modules are LRU-suspended — use
  `useSuspendableEffect` for timers/polling.
- Tests in src/__tests__/ (vitest, jsdom): NO jest-dom matchers (assert plain DOM),
  add your own `afterEach(cleanup)`, mock react-window if virtualized, assert inline
  colors via rgb not hex.
- Structural changes update the matching docs/architecture/* or docs/catalog/* file in
  the SAME commit.
- GATES you must pass before reporting done: `npx tsc --noEmit` · `npm run lint` (no new
  warnings in files you touched) · targeted `npx vitest run <files>`. Then drive the
  actual flow when a dev server is available (PoF dev = port 3001, NOT 3000); report what
  you COULD NOT verify honestly.

If a product decision is ambiguous, STOP that direction and return `DECISION NEEDED: <question>`
with your recommendation — never guess. Final report format:
per direction → status (done|blocked|decision-needed), commits, files, verification evidence, open risks.
```

## Modes

- **`/perfect`** — resume the loop wherever the vault says it stopped (the default; covers init on first run).
- **`/perfect propose [context]`** — force a proposal pass (optionally jump the cursor to a named context).
- **`/perfect build`** — build now with the current pool even if < 10.
- **`/perfect status`** — read-only: queue, cursor, pool, in-flight builds, shipped ledger, last session. No agents.
- **`/perfect smoke`** — live L2 verification pass over recent waves' shipped surfaces: drive the running PoF dev server on **port 3001** (verify a new-code marker first — never trust a stale port; :3000 is Vibeman, not PoF), read-mostly navigation, and use **read-only sqlite3 queries against the live DB** (`sqlite3 "file:$HOME/.pof/pof.db?mode=ro"`) as the primary diagnostic — one `GROUP BY` over `pipeline_artifacts`/`judge_verdicts` beats an hour of DOM archaeology. Record verified / not-driven / fixes in a `sessions/<date>-smoke` note; small fixes commit inline (gates BEFORE commit). Run after every ~2 waves.
- **`/perfect reflect`** — read `config.md → Skill improvement log` + last sessions and propose concrete edits to THIS skill file.

## Guardrails

- **Never stash, never `git add -A` on the shared tree** — per-file staging (`git add <file>` sweeps foreign WIP — author NEW files or `git add -p` from an interactive shell, never from an agent), staged-count check before every commit; other sessions' work is sacred. Inside a wave, `git commit --only <paths>` is the form that makes this safe by construction.
- **Efficiency outranks defensive isolation.** Before adding any protective step to this loop, ask whether the risk it defends against is instead a signal that the *grouping* is wrong. Machinery that exists to survive a bad wave plan should be deleted and the wave plan fixed.
- **Cost discipline**: scouts are Explore-tier; Opus is spent only on accepted work; the Director never re-runs a scout whose brief is < 1 round old (it's in the context note).
- **Honest ledger**: a direction only reaches `shipped` with gates green AND the Director having read the diff; anything else is `failed` with a reason. No silent drops — every accepted direction's fate is recorded.
- **Interruptibility is a feature**: write the vault incrementally (after every context in P, after every merge in B) so a killed session resumes losslessly.
- **The user is the product owner**: the gate is theirs; the Director challenges but never overrides a rejection, and repeated rejections of a lens/context recalibrate the queue scores.
- **Push only when the user says so** (repo memory law); commits to master are fine, `git push` is not automatic.

## App context coverage (the Personas ledger — the second memory)

The Obsidian vault is this loop's *working* memory; the **Personas Memory Ledger** is its *measured* memory. This skill declares `contexts: tracked`, so the Personas app renders a per-context coverage bar for `/perfect` in Skills Management — but that bar reads ONLY from skill-attributed ledger nodes. A vault note the app never sees counts for nothing. **Writing the vault and not the outbox is the one failure mode that makes a productive session look like a dead one.**

Fleet/CLI sessions have no DB access, so the ledger is fed by an append-only JSONL outbox at the repo root. Before finishing, append one line per context you meaningfully worked on (create `.personas/` if absent; **append, never rewrite** — parallel sessions share this file):

```
<repo>/.personas/memory-outbox.jsonl
```

```json
{"type":"node","kind":"progress","title":"<=200 chars: what you did in this context","body":"optional detail","context":"<exact context name the app knows>","skill":"perfect"}
```

- **Always set both `"skill":"perfect"` and `"context":"<name>"`** — together they drive the coverage %. A node missing `context` is *unanchored*: it lands in the ledger but counts toward no context, so the bar does not move. A node missing `skill` is attributed to anonymous `skill:outbox` and is excluded from per-skill coverage entirely.
- **Which name — this is the part that silently fails.** The ingest matches `context` against the names the app actually knows (`dev_contexts`), case-insensitively. An unrecognized name is NOT an error: the node is stored with a null context and never counts toward coverage. `context-map.json` mirrors those names when the map is fresh — but it is an *export* of a past scan, so a map older than the last rescan can name contexts the app no longer has. When the two could disagree, prefer a name the app confirms; never trust `.claude/codebase-context.md` (a stale render) or `.personas/contexts.txt` unless this machine's app dumped it.
- `kind`: `progress` for work done, `decision` for a direction accepted/rejected and why, `gotcha` for a trap the next session must not re-hit, `map` for observed structure drift (the app reacts to `map` nodes with a delta context scan). Unknown kinds degrade to `fact`.
- Coverage is a **30-day rolling window** — a context goes stale and the bar drops if the loop never returns. That decay is the instrument working, not a bug: it is the loop's own "which contexts am I neglecting" signal, and it should feed the Phase-P queue score.
- Re-emitting an identical node refreshes its freshness instead of duplicating (content-hash dedupe), so a re-touched context is safe to re-emit.
- The app ingests and deletes the file; a session that is never app-dispatched simply leaves it for the next ingest. **Skip silently when not Personas-managed** (no `.personas/` and no app dispatch).

**When to emit** (not just at wrap — write incrementally, same reason the vault is written incrementally):
- **Phase P**, after each context's gate resolves → one `progress` node (what the scout found + what was proposed), plus a `decision` node per accepted or rejected direction carrying the user's reason.
- **Phase B**, after each merge → one `progress` node naming the direction and commit SHA; a `gotcha` node for any trap the build hit (a builder death, a registry clobber, a convention the diff violated).
- **Phase W** → backfill anything the phases missed, then verify the file parses (one JSON object per line, no trailing commas, no pretty-printing — a malformed line is counted as `skipped` and silently lost).

---

## Skill Reflection

After the run’s real work is done, reflect twice — autonomously, without asking the user. Be honest about volume: most runs produce NOTHING for lane 2. An empty reflection is a valid result; a forced lesson is pollution. Calibration: nothing (common) / one line (sometimes) / a lesson entry (occasionally) / a redesign proposal (rare).

Lane 1 — PROJECT learnings (what the next session in THIS repo needs): write via the MEMORY BLOCK contract if this prompt carries one, else append node lines to `.personas/memory-outbox.jsonl` per that contract. Project-specific insight only.

Lane 2 — METHOD learnings (what would improve THIS SKILL for every project):
1. If nothing generalizes beyond this repo, stop here.
2. Append an entry to `LESSONS.md` in this skill’s directory: `## <version-used> — <YYYY-MM-DD> — <project-name>` followed by `- ` bullets (create the file with a `# Lessons — <skill>` heading if absent). Record the version the run USED, not a bump target. Wrap a bullet in a `### Redesign proposal` sub-block when it argues for a methodic redesign you are NOT applying now.
3. Version bump — ONLY when you also edit SKILL.md to apply the improvement in the same change: minor (1.2 → 1.3) for a prompt/step refinement, major (1.x → 2.0) for a methodic redesign. Update the `version:` frontmatter field (add `version: 1.1` if the file had none — absent means 1.0). Never bump without an applied edit; never edit the method without a bump.
4. Sync ritual (only when you bumped): (a) commit the skill directory as a STANDALONE commit on the current branch — message `skill(<name>): v<new> — <one-line reason>` — containing nothing but this skill’s files; (b) copy the updated skill directory to `~/.claude/skills/<name>/` (overwrite) so sibling projects can adopt it. EXCEPTION: read `.personas/skill-registry.json` first — if the library already carries a HIGHER version than yours, do not overwrite it; keep your lesson in LESSONS.md and note the version conflict in the entry.
   **Second exception, specific to this file:** this copy carries a PoF-specific overlay (repo law, gates, Class B/C lists, the catalog-pipeline rules). Publishing it to `~/.claude/skills/perfect/` would impose PoF's conventions on every sibling project. Do NOT run step (b) until the method and the overlay are separated into distinct files.

Sibling awareness: `.personas/skill-registry.json` (repo root, when present) lists this skill’s installed version, the workspace library version, and which sibling projects run it at which version with recent usage. Use it to judge whether a lesson is worth a bump (heavily-used siblings raise the bar for majors) and to notice you are BEHIND (library newer than yours → prefer recording the lesson over editing a stale method).
