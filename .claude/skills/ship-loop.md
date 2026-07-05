---
name: ship-loop
description: Iterative ship-readiness loop for the PoF repo. Boots by profiling the stack and running the build gate, fans out parallel audit lenses into a 9-dimension scorecard, files an append-only numbered backlog, then works in themed milestones separated by user checkpoints. Auto-decides reversible work and defers existential/product questions to the user. Its ONLY durable memory is the four state files under .claude/ship-loop/. Invoke with "run ship-loop" / "ship-loop boot | gate | audit | milestone | checkpoint | recall".
---

# Ship Loop — PoF ship-readiness loop

A repeatable loop that answers one question run over run: **how close is PoF to the current ship bar, and what is the highest-impact next batch of work?** It is *evaluative* (is the product good enough?) layered on top of *verification* (does the gate pass?). It is **not** a per-commit CI gate — it is a deliberate, memory-backed pass you run on a cadence.

> Portable engine vs. per-repo memory: this file is the engine. Everything the loop learns lives in the **`.claude/ship-loop/` overlay** (`state.md`, `backlog.md`, `decisions.md`, `journal.md`) — these ARE the cross-session memory; read them first every run. The overlay is gitignored (untracked scratch) so it never rides along in a shared-tree commit.

## The flow (one line)

**BOOT → GATE → AUDIT (parallel lenses) → 9-dim scorecard → append-only backlog → CP0 → themed milestones (each: work → gate → CPn).**
Governing rule at every fork: **auto-decide reversible work and log it as re-askable; defer existential/product decisions to the user at a checkpoint.**

## Stack profile — `stack-pof-ue`

PoF matches one profile. Signature: **Next.js 16 (app router) + React 19 + Zustand 5 + better-sqlite3 (WAL, `~/.pof/pof.db`) + Tailwind 4 + Vitest + Playwright + a live UE5/Blender/MCP bridge (`pof-mcp`, `mcp-unreal`)**. It is a **local, single-user dev tool**, not a hosted SaaS — so there is **no auth boundary and no billing** to certify; those two classic dimensions are re-pointed at PoF's real value surfaces (below). The profile fixes the gate commands and the lens set.

### The GATE (`stack-pof-ue`)
Run from repo root; hold each as a ratchet (never let a green dim go red without filing a backlog item):

| Step | Command | Ratchet |
|------|---------|---------|
| types | `npm run typecheck` | 0 errors |
| lint | `npm run lint` | 0 **errors** (warnings tracked, not blocking) |
| unit | `npm run test` (vitest run) | 0 failed |
| build | `npm run build` | exits 0 (Next prod build) |
| gen | `node scripts/gen-pipeline-registry.mjs` runs in pre* hooks | registry current |

`npm run validate` = typecheck + lint + test (the fast gate). **Build** is separate and slower. **E2e** (`npm run test:e2e`, Playwright catalog-pipeline-walker over a real dev server + SQLite, stub mode) is the **milestone-gate** step — slow, run at milestone boundaries, not every boot. The `validate`-time guard `src/__tests__/catalog/pipeline-e2e-coverage.test.ts` is the fast proxy for e2e coverage.

## The 9-dimension scorecard (PoF-adapted)

Each dimension scores 🟢 (solid) · 🟡 (gaps, shippable-ish) · 🔴 (blocking). Every cell carries **evidence** (`file:line`, gate output, or a lens verdict) and **top gaps → backlog #**. Two SaaS dimensions are re-pointed at PoF's real value/trust surfaces:

| # | Dimension | What it means for PoF |
|---|-----------|-----------------------|
| 1 | Build & types | typecheck 0 · build 0 · registry gen current |
| 2 | Functional completeness | modules/pipelines actually *produce* (not stubs); NBA/eval/CLI-task paths real |
| 3 | Tests | vitest suite green + meaningful coverage of stores/lib/API |
| 4 | Simulated UAT / e2e | Playwright catalog-pipeline-walker + infra specs green; every registered pipeline e2e-walked |
| 5 | **Pipeline & UE-bridge integrity** *(replaces Billing/value-capture)* | the L0–L4 acceptance ladder derives from UE/DB truth (never a manual toggle); data contract UE↔SQLite locked; ground-truth verification (Tiers-of-Truth) — no "done" without an observation; MCP bridge honest about degrade paths |
| 6 | **Security & secrets** *(replaces Auth/RBAC — no auth surface exists)* | API keys (Leonardo/ElevenLabs/Gemini) never logged/committed; file/script/CLI-spawn paths can't traverse or exec arbitrary input; SQLite/WAL integrity; no secret in prompts or artifacts |
| 7 | UX/UI polish | shared primitives reused (not hand-rolled); a11y floor (WCAG 1.4.1 status not hue-only, 12px text floor, focus-ring); reduced-motion; suspend/LRU correctness |
| 8 | Ops readiness | CI story; docs in sync with code (`docs/` is source-of-truth per CLAUDE.md); scripts/hooks; scoped-check; nightly-build cron |
| 9 | Value & market reality | is the tooling genuinely useful vs. alternatives (Epic's first-party MCP, turnkey AI-anim)? where is the defensible moat (verification/ground-truth, the acceptance ladder)? → `.claude/ship-loop/value-case.md` |

## AUDIT — the lenses (parallel, read-only subagents)

At boot (and at any full re-audit) fan out **one subagent per lens**, each read-only, each returning a **🟢🟡🔴 verdict + top 3–6 gaps with `file:line` evidence + one strength worth protecting**. Lenses map to dimensions:

- **functional** → dims 2 (+ spot-checks 1)
- **tests** → dim 3 (+ e2e coverage feeding 4)
- **pipeline-ue-integrity** → dim 5 (acceptance ladder, data contract, MCP/UE bridge, Tiers-of-Truth)
- **security-secrets** → dim 6
- **ux** → dim 7
- **architecture-ops** → dims 1, 8 (module registries, store/persist patterns, docs-sync, CI, the mid-refactor modularization state)
- **value-market** → dim 9 (competitor map + honest moat + production-reality checklist → `value-case.md`)

Scope each lens tightly for a large codebase (33 contexts, ~60 routes): "verdict + top gaps + evidence, **do not fix anything**, be concise." Use `context-map.json` to target files. Findings are impact-ranked (frequency × reachability × cost), not by raw severity word.

## Checkpoints (CPn) — where the user decides

At **CP0** (after the boot scorecard) present the scorecard and ask four questions (use AskUserQuestion). At **CPn** (after each milestone gate) present milestone results, re-ask any deferred question, and confirm auto-decisions.

**CP0 questions (adapt options to PoF):**
1. **Ship bar — what does *done* mean?** e.g. *"Internal tool that reliably drives the UE5 loop for me"* / *"Shareable dev-tool others could run"* / *"Public product path"*.
2. **Cadence** — *Milestone (batch 5–8 items → full gate → check in)* / *Autonomous until ship bar (stop only for product decisions I can't auto-decide)* / *Per-item check-ins*.
3. **Milestone 1 cluster** — which theme first (e.g. *Build/refactor green first* · *Tests & e2e* · *Pipeline/UE integrity* · *Product decisions*).
4. **UAT depth** — *Deterministic e2e only (Playwright stub each gate)* / *E2e + a live-UE spot check* / *Full character-driven UAT run* (if a `/uat` overlay is adopted).

**AFK protocol:** if the user doesn't answer a checkpoint, apply the recommended provisional defaults, log them in `decisions.md` as re-askable, and proceed **only** with reversible non-decision work. Out-of-scope boundaries in CLAUDE.md (e.g. anything the user must push, destructive git, external publishing) are **never** crossable via timeout — explicit consent required.

## State files (the overlay — read first, write every run)

- **`state.md`** — context refresher (stack, branch, ship bar, cadence), the current 9-dim scorecard table, milestone tracking, checkpoint history.
- **`backlog.md`** — `# Backlog (☐ todo · ◐ in progress · ☑ done · ✕ cut) — numbering append-only, never renumber`. Columns `| # | S | Dim | Size | Item |` (`Dim` = e.g. `3-Test`, `5-Pipeline`; `Size` = S/M/L; inline `[C]/[H]/[M]/[L]` severity). Themed headings.
- **`decisions.md`** — `# Decisions log`; sections `## Boot decisions`, `## Auto-decided (pending user review at next CP)`, `## CP<n> — …`. Every autonomous choice logged as re-askable.
- **`journal.md`** — `# Journal (append-only, one line per event)`; verbs `BOOT`, `GATE(...)`, `AUDIT <lens> lens done`, `ITEM n ☑`, `GATE M<n>`, `CP<n> done`, `NOTE`, `SKILL v<n>`.

## Milestones — the work rhythm

A milestone = a **themed batch of small, reversible items** picked off the impact-ranked backlog. For each item: make the change, keep it small and reversible, verify locally. At the **milestone gate**: run the full gate (+ e2e), commit **path-scoped and locally only** (the user pushes — never push; never `git add -A` in this shared tree — author your own files or `git add -p`), append the gate result + item closures to the journal, then hit **CPn**.

## Trust rules (inherited)
- **Grounding:** no scorecard cell or finding without evidence (`file:line` / gate output / observation). Never fabricate a benchmark, a test result, or a "done".
- **Ground-truth for dim 5:** a pipeline/UE claim is not "done" until an observation confirms it (the Tiers-of-Truth discipline) — a green artifact status that isn't derived from UE/DB truth is a finding, not a pass.
- **Impact over label:** rank the backlog by impact (frequency × reachability × cost), not the severity word.
- **Docs-in-sync:** per CLAUDE.md, any structural change updates the matching `docs/` file in the same batch — a stale doc after a landed change is a dim-8 finding.
- **Shared-tree hygiene:** re-read before edit; targeted git add; commit locally only; state overlay stays gitignored.

## Recall

`recall` = read the overlay and report the trajectory (which dims moved run-over-run, open/closed/regressed items, current ship bar + cadence, top of the backlog) — no new scan. A dim that moved is the headline; a closed finding that reappears is a **regression**.
