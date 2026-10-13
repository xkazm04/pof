# Scan-sweep bake-off brief (identical for both contestants)

You are one of two models given the SAME job in separate git worktrees. A director will
grade your ideas (accuracy, grounding, value) and your execution (diff quality, gates).
Work autonomously; do not ask questions. Do not stop until the report is written.

## Environment
- Your cwd is a git worktree (own branch). node_modules is a junction to the main checkout;
  the generated pipeline registry already exists. Never `git push`, never touch another worktree,
  never write to ~/.pof, never run the dev server, never run the full test suite or e2e.
- Read `CLAUDE.md`, `.claude/CLAUDE.md` for repo law (use `@/` imports, `logger` not console,
  no hex colors - use `@/lib/chart-colors`, timings from `UI_TIMEOUTS`, `Result<T,E>`).
- Method: read `.claude/skills/scan-sweep/SKILL.md` and `.claude/skills/scan-sweep/references/lenses.md`
  and follow the **stabilize** strategy's judging method (sections 4, 5, 7) with the OVERRIDES below.

## Scope (3 rounds, one per context; context file lists are in `context-map.json`, field `file_paths`)
1. `audio-module`
2. `combat-simulator`
3. `database-layer`
Stay inside each context's file paths (plus their tests). Read each context once, then judge.

## Fixed lens package (apply all 10 to every context; each must be pointed at a named artefact)
bounty-hunter, parity-auditor, error-handler, security-auditor, code-optimizer, ux-reviewer,
state-coverage, accessibility-checker, test-strategist, tech-debt-tracker
(use the definitions in lenses.md; a lens with no surface goes in `lens_no_surface`).

## OVERRIDES to the skill (this is a bounded bake-off)
- Budget: at most **8 findings per context** (24 total). Quality over count; zero from a lens is fine.
- Every finding uses the section 4.10 standard body (## Summary/Description/Flow/Expected impact/Evaluation)
  with `file:line` anchors (repo-relative paths). Dead-code claims need the zero-consumer grep in evidence.
- Routing: build ONLY Lane A items (XS/S, or M with risk<=3; Result better via gate/probe; inside the context).
  One atomic commit per finding: `fix(<context>): <title>` with a body line naming the lens and the
  re-measured After figure. Write a failing test first when a test can see the defect.
  Everything else (Lane B/C) is left as a finding with its size/effort/impact/risk scores - do NOT build it.
- Verify each fix with the gates, each in its own invocation, exit codes asserted (no pipes that swallow status):
  `npx vitest run <your test files>` , `npm run typecheck`, `npx eslint <files you touched>`.
  A whole-tree typecheck may be red from pre-existing causes: compare failing paths against yours.
- Commit with explicit pathspecs only (`git add <file>` then `git commit -m ... -- <paths>`); never `git add -A`,
  never stash. Do NOT commit anything under `.claude/sweep-bakeoff/`.
- No outbox, no Approvals hand-off, no registry leads, no scan-history snapshot. Skip sections 0, 6, 9, 10 of the skill.

## Deliverables (all inside `.claude/sweep-bakeoff/`, untracked)
1. `findings.jsonl` - one JSON object per finding:
   `{"context","lens","title","body","evidence","size","effort","impact","risk","result","method","gate","lane":"A|B|C","status":"built|backlog|rejected","commit":"<sha or null>"}`
2. `REPORT.md` - per context: files read, lenses pointed vs no-surface (with what each checked), findings built/backlogged/rejected,
   gate commands run with their exit codes, anything you could not verify, and your own honest self-assessment of confidence.
Finish by printing the line `BAKEOFF-DONE built=<n> backlogged=<n> rejected=<n>` .
