---
product: "PoF (Pillars of Fortune)"
stack: "a Next.js 16 + React 19 + TypeScript + Tailwind 4 + Zustand 5 app (SQLite at ~/.pof/pof.db via better-sqlite3) that is an AI-powered UE5 C++ game-development assistant"
vault: ["C:/Users/kazda/Documents/Obsidian/pof"]
vault_subdir: Spark
context_map: context-map.json
base_branch: master
active_runs_ledger: ".claude/fleet-memory.md"
locale_count: 1
---

# spark overlay - pof

Scaffolded 2026-10-04 on the first `/spark` run in this repo, from this repo's own manifest,
scripts and conventions. It deliberately borrows nothing from another project's overlay.

This repo hosts **parallel sessions**: `git status` routinely shows foreign WIP. Never sweep it into
your commits.

## Gates

Declared capabilities come from `package.json` scripts, not from another repo's set.

- always: `npm run validate` (= `npm run typecheck` + `npm run lint` + `vitest run`)
- when catalog-pipeline step components / registries / pipelines touched: `npm run test:e2e`
  (Playwright; needs a dev server - `PLAYWRIGHT_PORT=3001`, and **:3000 is Vibeman, not PoF**)
- builder: `npx tsc --noEmit` | `npm run lint` (no new warnings in files you touched) | targeted
  `npx vitest run <files>`; then drive the actual flow and **report what you could not verify**.
- **Run the gate in stages when memory is tight.** `npm run validate` has been OOM-killed mid-lint
  on this machine with foreign python/WSL processes resident: run `typecheck` -> `lint` ->
  `vitest run --maxWorkers=3` separately.
- **`npm run typecheck` is `tsgo`** (TypeScript 7 native, ~10x). It is blind to bundle boundaries:
  only the e2e walker catches a `use client` file that pulls `node:child_process` into the browser
  bundle.
- **UI verification runs from the MAIN checkout after merge, never in a spark worktree.** A worktree's
  junctioned `node_modules` makes Turbopack panic ("Symlink ... points out of the filesystem root").
  Boot `NODE_ENV=development npx next dev -p 3001` in the main checkout, curl `/layout`, `/status` and
  every new API route, screenshot headless, then kill your own PID. **A page can typecheck and still
  500 in dev** when a client component reaches `better-sqlite3`; this boot is the seam gate that catches it.
- **Check `df -h /c` in Phase 0 and before fanning out builders.** The drive sits about 99.5% full, and
  other sessions' writes took it to 0 bytes mid-build on 2026-11-01.
- **Capture the summary line and test for `failed` explicitly.** A chain like
  `cmd | grep ... | head` joined with `&&` returns 0 even when tests are red; that has caused a
  broken commit in this repo before.

## Rituals

- **Phase 0:** read `.claude/fleet-memory.md` (the cross-session coordination surface). Follow its
  CONVENTION lines; never silently contradict a DECISION line. Always run `git status` as well.
- **Phase 6:** append **at most 2** one-line entries to `.claude/fleet-memory.md`
  (`- [YYYY-MM-DD] [area] KIND: one sentence`) - a DECISION and/or DELIVERED, plus a CONVENTION only
  if a genuinely reusable pattern was established. Commit it **scoped**:
  `git commit --only .claude/fleet-memory.md -m '...'`. **Never a bare `git commit` or `git commit -a`**
  - parallel sessions stage their own new files in this shared index and a bare commit sweeps them
  into yours (it happened 2026-08-18, commit `906783b6`).
- **Phase 6, fleet markers:** when the run was orchestrated by Personas Fleet, the final line of the
  recap is `FLEET:DONE — <summary>` or `FLEET:NEXT — <next step>`, at line start, undecorated.
  Never fake one.
- **fleet-memory is Director-only during a wave.** Builders report their one-line DELIVERED in their
  final report; if every builder spends the quota the Director has none left, and pruning at the
  ~300-line cap can delete a sibling's fresh line.

## Repo law

Authority: **`.claude/CLAUDE.md`** (read it first), plus `docs/` as the maintained architecture
source of truth.

- Imports via `@/` alias, never relative `../../`. No raw `console.*` - use `logger` from
  `@/lib/logger` (`console.error` allowed). **No hardcoded hex colours** - `@/lib/chart-colors` or
  CSS variables. Timing constants from `UI_TIMEOUTS` in `@/lib/constants.ts`.
- API routes return the `{ success, data|error }` envelope via `apiSuccess`/`apiError`
  (`@/lib/api-utils`); client calls use `apiFetch`/`tryApiFetch` with **relative** URLs. Fallible
  operations use `Result<T,E>` from `@/types/result.ts`. Absolute URLs for CLI callbacks come from
  `getAppOrigin()` / `getOriginFromRequest()`.
- **REUSE before building.** The Shared Component Manifest in `.claude/CLAUDE.md` (StepFrame,
  CliProduce, ProvenanceStrip, ChartPanel, DataTable, CandidateGallery, GlbViewer, Modal,
  useStepAcceptance...) and the `ui/` primitives (Modal, TabBar, MeterBar, StatusToken, RangeSlider,
  ChartLegend, Tooltip, MicroLabel, SchematicPanel, CodeViewer, InlineErrorRetry, ConfirmDialog,
  LoadingRow...). Never hand-roll a spinner, modal, tooltip or status chip.
- **`src/lib/db.ts` is the only non-test `new Database(` site** (ratcheted by
  `db-containment.test.ts`). A domain needing its own tables adds a `getDb()` + one-time-schema
  accessor (`library-db-conn.ts`, `audio-db-conn.ts`), and file stores derive their root from
  `resolveDbPath(env)`. There is no migration framework: per-domain `ensureTable()` with
  `IF NOT EXISTS` + `PRAGMA table_info` + `ALTER`.
- Catalog pipeline steps follow View/Produce/Acceptance (CLAUDE.md Rules 1-5): `CliProduce` for the
  Produce face, Acceptance **derived from truth, never a manual toggle**, <=200 LOC per generated
  file, camelCase hierarchy-encoding filenames. A pipeline file's name must equal its `catalogId`.
- Zustand v5: never persist transient state (`isRunning`); modules are LRU-suspended - use
  `useSuspendableEffect` for timers/polling and `useSuspendableSelector` for store subscriptions.
- Tests in `src/__tests__/` (vitest, jsdom): **no jest-dom matchers** (assert plain DOM), add your
  own `afterEach(cleanup)`, mock `react-window` if virtualized, assert inline colours as `rgb()` not
  hex, stub `scrollIntoView`. **Never** put a measurement harness or temp script under
  `src/__tests__/` - the gate executes it.
- **Structural changes update the matching `docs/architecture/*` or `docs/catalog/*` file in the
  SAME change**, plus `docs/README.md`'s doc map if a doc is added or removed.
- **Git: commit on the current branch; never push.** The owner pushes after reading the log. The
  `--no-verify` and force-push bypasses are denied to agents in `.claude/settings.json`; if a gate is
  red, fix the tree. Stage per file; `git add <file>` can still sweep foreign WIP, so prefer
  authoring new files or `git add -p`.
- Out-of-scope walls: none beyond CLAUDE.md.
- **Edit source with the Edit tool, never with inline shell scripts.** A `node -e`, a heredoc-fed `node -`,
  or `sed` carrying multi-line anchors or `\n`/`\${}` escapes is mangled by this harness's shell wrapper: the
  replacement silently does not match, or newlines land inside string literals. It happened in 2026-10-04
  (heredoc) and twice in 2026-11-02 `gta-quest-loop` (a guard patch that applied 1 of 4 replacements;
  `\n` written as real newlines in council.mjs). Plain-text appends via heredoc are fine.
- **Numbers in a brief are labelled.** A figure copied into a builder brief from an earlier report is written as 
  `measured <date> at <seed/commit>` or `illustrative`, and re-measured when the brief depends on it (2026-11-02: a brief quoted ashfall's
  10,232 reach rows; it measures 10,712 at seed 1). Second occurrence after the 2026-11-01 builder-count slip, so it lives here, not in the log.


## Wave defaults

One `AskUserQuestion` call of up to 4 questions per wave; the Phase-3 perspective checklist decides
when the dialog is done. Waves are uncapped.

## Question taste

- The operator accepts **outcome-value work** (a visible payoff) and rejects **cosmetic churn**.
  Pre-filter the slate and say you did.
- Default depth is **the engine, not the chrome**. Surface UI at most once or twice per slate unless
  steered there.
- **The MEMORY.md campaign ledger is dense** - shipped programs, "honest ceiling" verdicts, retired
  subsystems. Many obvious ideas are already DONE. Check before proposing.
- Never ask what the repo's own conventions already answer (strings, tokens, shared components,
  error handling, loading UX, the API envelope).
- **An answer may arrive as a doctrine rather than an option pick**, and when it does it is a course
  correction worth more than the question: on 2026-10-04 the reply "comprehend story without
  overflowing of text in the map view - decision impact is right there as second priority" reframed
  a four-option single-select into a hard constraint plus a priority order, and both went into the
  design and the contest brief as constraints.
- When a sibling tool (Grok, Codex) has already produced a design for the same idea, the operator
  wants it **assessed, not adopted** - name what it gets right, keep that, and say plainly where
  your judgement differs and why.

- **Content and character choices for GTAI belong to `/gta --quest`, not to `/spark`** (2026-11-02, gtai-phase-2): asked which soul and contract the slice holds, the owner answered "handshaked via /gta --quest", and moved King out of the slice. Offer "decided through `/gta --quest`" as an option for any game-content question.
- **When a question hides a legal or brand risk, include a "change the thing" option** (2026-11-02): asked when to create the Steam app given the "GTAI" trademark proximity, the owner rebranded the title to RTAI instead. None of the options offered a rename.
- **The owner picks the higher quality bar over the safe route on art** (2026-11-02): the slice is built in D4 rather than with D4 trialled alongside D1. Recommend the safe route, but put the critical-path cost in the option text.

## Skill improvement log

- 2026-10-04 (story-decision-graph, first run): **The `Skill` tool could not resolve a
  just-linked registry skill.** `/spark` and `/contest` were adopted mid-session (manifest edit +
  `link-registry.mjs`), but `Skill(spark)` returned "Unknown skill: spark" until a later tool call
  refreshed the harness's skill index. Running the method from the read `SKILL.md` worked; the
  lesson is to re-link and expect one turn's lag, not to re-invoke.
- 2026-10-04: **A quoted bash heredoc (`<<'EOF'`) is mangled by this harness's shell wrapper** for
  large markdown payloads - two attempts failed with "unexpected EOF while looking for matching `''`"
  on content containing no unbalanced quote. Write multi-KB files with the `Write` tool, not a
  heredoc; a script FILE is also reliable where an inline escape sequence is not.
- 2026-10-04: **A registry script with no `--help` executes instead.** A fleet guard hook blocked
  `contest.mjs --help`; grep the script's argv handling (or its header comment block) for flags.
- 2026-10-04: **The contest instrument does not read its own overlay** - `.claude/contest/config.md`
  is host-read, so `vault:` must be passed as `--vault` / `--vault-subdir` on `init` or the vault
  silently falls back to `<repo>/.contest`. Check the init output's `vault:` line before running.
- 2026-11-01 (gtai-uprising-project): **Scouts proved mount points but never booted the page.** `/` had been
  500 in dev since 2026-10-19 (a client-bundle leak); only the post-merge smoke test found it. Promoted to
  `## Gates` (main-checkout dev boot as the seam gate), together with the disk check. The contest-vault lesson
  recurred and moved to `.claude/contest/config.md ## Engines`.
- 2026-11-02 gta-quest-loop: **committed wire types + stubs let 4 packages fan out at once, including the
  consumer (the contracts pipeline) that was planned as sequential.** The builders' contract-gap reports
  (`provenance.runId`, `objective.durationS`, quests that realise arc beats) were the most valuable output
  of the wave. Plan a Director contract pass after the fan-out, not just a merge.
- 2026-11-02 gta-quest-loop: **a generator briefed against a validator must get the validator's vocabulary
  generated from the validator's own source.** The first live council invented variable names, so all 4 paths
  were red on the story guard. The fix: `assess-cli.ts --story-vars` feeds the brief.
- 2026-11-02 gta-quest-loop: **the fleet-memory live file is all DECISION and CONVENTION (204 entries), so
  `--prune` sends every new DELIVERED line straight to the archive**, including a sibling's fresh one. This is
  expected by design, not a defect. Say so in the commit so nobody reads it as a deletion.
- 2026-11-01 story-decision-graph resume: the idea note's frontmatter said `status: scouted` while its Build record showed 7 shipped commits - on `resume`, derive the phase from the Build record + `git log` over the brief's paths, never from the frontmatter alone, and rewrite the frontmatter when you wrap.
- 2026-11-01 story-decision-graph wiring: three parallel builders on file-disjoint scopes worked; two numbers a builder reported (art reach 77, 'walk can never pass') were wrong/partly wrong until the Director re-measured - re-run any pinned-count test yourself, and ask scouts/builders whether a produce body can read sibling steps BEFORE designing a step that depends on the stored sibling. Also: Phase 0 must note any dev server holding .next/dev/lock, since the e2e walker gate needs it stopped (ask the operator, never kill a PID you did not start).
- 2026-11-02 gtai-phase-2: **a relative path resolved against the repo root breaks inside a spark worktree.** `GameDef.engine.root: '../gtai'` resolved to `.claude/worktrees/gtai`, so the seam smoke read `root: null` until `POF_GAME_ROOT_GTAI` was set. Run any sibling-repo seam smoke from the main checkout after merge, or pass the env override. Also, builders in a fresh worktree must run `node scripts/gen-pipeline-registry.mjs` before `tsc`, because the generated registry is git-ignored.
- 2026-11-02 gtai-phase-2: **a cross-repo contract can be built by two parallel builders when the brief carries every wire identifier and the verdict table.** The PoF reader and the greenfield game repo's writer met at the first seam smoke with no fix-ups.
- 2026-11-10 rtai-builder-tooling-lane: **a builder's "no damage" claim about shared state needs a command in its evidence.** A tool test wrote `core.bare`/`user.email` into the shared repo's .git/config, and the lane's report said no commit got the fake author; `git log --format=%ae` showed one did. Any brief whose tools touch git must require tests on a temp repo with `GIT_CONFIG_GLOBAL`/cwd isolated, and the report's integrity lines must quote the command that proves them.
