---
name: research
description: "Use when the user shares a YouTube/article URL or raw text about Claude/AI game-dev automation, MCP/Unreal tooling, agent harnesses, or a dev-tool showcase and wants ideas PoF can adopt into its headless tooling or UI workflows. Triggers: '/research <url>', 'can we use this for PoF', 'research this video/technique', 'any ideas from this'."
---

# Research — mine external showcases into PoF improvements

## Overview

Turn an external source (YouTube demo, article, raw notes) into **concrete, codebase-grounded improvements** for PoF — the AI-driven UE5 game-dev tooling app. The north star: evolve PoF's harness + MCP + catalog pipelines into a framework for high-quality **automated game development**. So weight ideas that strengthen the *automation loop* (headless control, verification, orchestration, idea→UE→tested), at any effort scale from a 10-line tweak to a new subsystem.

**Core principle:** never propose against the whole codebase from scratch. Consult the **impact-map** (`docs/research/impact-map.md`) to jump straight to the handful of files an idea touches, confirm the gap with one targeted grep, and grow the map so the next run is faster. Research memory (Obsidian) stops you re-proposing what was already accepted, declined, or shipped.

## When to use

- A URL/text describing AI-for-gamedev, MCP/Unreal, Claude Code workflows, agent orchestration, or any dev-tool technique, **and** the user wants "can we use this?"
- NOT for: generic web research with no PoF angle (use `deep-research`), or implementing an already-decided feature (just build it).

## Three persistent artifacts

| Artifact | Where | Role |
|---|---|---|
| Research memory | `C:/Users/kazda/Documents/Obsidian/pof/` (`Research/`, `Lessons/`, `Patterns/`, `Index.md`) | One note per run + the learning loop. **Outside the repo** — never appears in git. |
| Impact-map | `docs/research/impact-map.md` (in-repo, versioned) | Thin triage index: subsystem → key file anchors → "what lands here / known gaps / already-has" → doc links. Read every run, **grown** every run. The anti-re-scan engine. |
| Commits | git, `research:` prefix | Code implemented + impact-map updates. |

## Buckets + effort

Tag every finding with a bucket and an effort scale.

- **A — Headless tooling**: `src/lib/harness/`, `tools/pof-mcp/`, `src/lib/claude-terminal/`, `src/lib/test-gate-runner/`, build pipeline, observation spine.
- **B — UI / catalog workflow**: catalog pipeline steps (`src/components/layout-lab/`), modules (`src/components/modules/`), `/layout` lab, evaluator, prompt builders.
- **C — UE bridge / MCP**: `mcp-unreal` (`:8090`), PoF Bridge plugin (`:30040`), UE 5.8 first-party-MCP convergence (`docs/ue58-mcp-convergence-plan.md`).
- **D — Prompt / knowledge / skill**: `module-registry.ts` prompts, `src/components/cli/skills.ts`, UE_GOTCHAS, knowledge tips.
- **E — Framework / cross-cutting**: verification (Tiers of Truth), orchestration, contracts, the "automated game-dev framework" bets.

**Effort:** `S` (≤~30 LOC) · `M` (one file/feature) · `L` (multi-file) · `XL` (new subsystem / framework bet). Effort drives the action (Phase 8).

## Procedure

### Phase 0 — Bootstrap (idempotent, skip if present)
- Ensure the Obsidian vault exists: `C:/Users/kazda/Documents/Obsidian/pof/` with `Research/`, `Lessons/`, `Patterns/` (+ `Patterns/user-preferences.md`, `Patterns/descoped-reopenable.md`), and `Index.md`. Create only what's missing.
- Ensure `docs/research/impact-map.md` exists (it's seeded; if missing, build the skeleton from `docs/README.md` + `MEMORY.md`).

### Phase 1 — Load context + memory
1. Read `docs/research/impact-map.md` (PRIMARY — your fast map of the codebase).
2. Read `docs/README.md` for the live doc map (load specific `docs/architecture/*` / `docs/catalog/*` on demand in Phase 6).
3. Read Obsidian memory: `Patterns/user-preferences.md`, `Patterns/descoped-reopenable.md`, and the 3 most-recent `Lessons/` files. These set extraction priorities and stop duplicate proposals.

### Phase 2 — Ingest the source
- **YouTube** (`youtube.com/watch`, `youtu.be`, `shorts`): run the proven recipe, then parse with the bundled cleaner.
  ```bash
  WORK="$TEMP/pof-research"; mkdir -p "$WORK"
  yt-dlp --skip-download --write-auto-subs --write-subs --sub-langs "en.*" \
    --sub-format vtt --output "$WORK/%(id)s.%(ext)s" "<url>"
  python .claude/skills/research/scripts/clean_vtt.py "$WORK/<id>.en.vtt"   # → <id>.clean.txt
  ```
  Get the title/duration first with `yt-dlp --skip-download -O "%(id)s :: %(title)s :: %(duration_string)s :: %(channel)s" <url>`.
  **Cleanup (mandatory, scoped to THIS run's id):** `rm -f "$WORK"/<id>.*` as soon as the cleaned text is in memory — before Phase 3, so a mid-run failure leaves no residue. Never blind-sweep `$WORK/*` (races parallel runs).
- **Article URL:** `WebFetch` for the body, stripped of nav/ads.
- **Raw text:** use as-is.
- If transcript is disabled / text <300 words: report it's too thin and stop.

### Phase 2.5 — Web augmentation (bounded, ≤3 web calls)
Only if the source names a tool/technique/model that Phase 6 framing needs and that isn't already in the impact-map or `docs/`. One focused `WebSearch` → `WebFetch` the single most authoritative page. Capture a 2-4 sentence note (what it is / how it works / integration shape / why it matters to PoF). Don't validate the speaker's claims here (that's Phase 6) and don't rabbit-hole.

### Phase 3 — Extract ideas (5–15)
Each idea: `title` (imperative, <60 chars), `summary` (1-2 sentences), `source_anchor` (≤20-word quote or `[HH:MM:SS]`), `tentative_bucket`, `effort`. Apply memory filters (deprioritize patterns the user repeatedly declines; surface matching `descoped-reopenable` items as "reconsider?"). **Source-type yield:** engineering talk = dense (3-5 strong); product/competitor demo = few findings + many "already-have" catches (that's a *good* run — surface the catch count). Don't pad to hit a number.

### Phase 4 — Relevance filter
Score each idea against the impact-map. **Drop** ideas with no plausible PoF attachment point. Keep `High`/`Medium`.

### Phase 5 — Bucket + score
Assign final bucket(s) (multi-bucket OK) and confirm effort. Bias toward bucket E / automation-loop leverage when ranking.

### Phase 6 — Impact analysis (the anti-re-scan phase)
For each surviving idea, in order:
1. **Impact-map first.** Find the impacted subsystem in `docs/research/impact-map.md` → it names the likely file anchors and whether the area "already has" something. This replaces a blind codebase sweep.
2. **Host-infrastructure-first grep.** Before claiming "build new", grep for the *category* of infra the idea attaches to (e.g. an MCP tool → `Register*Routes`/tool registry; a harness step → `src/lib/harness/`; a pipeline step → `getStepComponent`/`ArchetypeStep`; an API route → the `apiSuccess` envelope). One discovery here usually reframes "new build" → "extend existing".
3. **Read the anchor file(s)** (~30-100 lines) to confirm the gap and the exact `file:line` where the change lands.
4. **Drop if redundant** (PoF already does it → log as an "already-have" catch).
5. **Security escalation:** PoF exposes HTTP bridges (`:8090`, `:30040`), MCP servers, and spawns `claude --dangerously-skip-permissions`. If an idea touches one of these surfaces and the area lacks auth/sandbox handling, escalate it to a finding even if the source never mentioned security.
6. If the impacted area is **missing/thin in the impact-map**, note it — you'll add it in Phase 9.

### Phase 7 — Present findings
Cluster detection first (same-file anchor → ships together; `depends-on [N]`; security pairs). Then a summary table:
```
#  Bucket  Effort  Title                              Relevance  Anchor
1  A       M       Wire X into the harness loop       High       src/lib/harness/executor.ts
```
Then per-idea detail: source anchor, evidence (`file:line`), recommended action, impact-map area, `aligns-with` an existing PoF pattern if any.

### Phase 8 — Triage + action
Ask "Which findings should I action? (numbers / all / none / ask)" — but if there's a single dominant in-repo finding and the run is autonomous, action it directly and report. Route each accepted finding:
- **In-repo, S/M** → implement with **TDD** (`superpowers:test-driven-development`) + an atomic `research:` commit per finding. **Validate before commit:** the affected test(s) + `tsc --noEmit` + `eslint` on changed files for an S/M single-area change; run full `npm run validate` for an L or multi-area change.
- **In-repo, L** → implement the core slice (TDD + commit) + write a handoff for the remainder.
- **XL** (framework bet) → write a spec/handoff doc under `docs/` (don't half-build a subsystem); link it from the impact-map.
- **External / blocked** → the finding targets a system **outside this repo** (e.g. the UE C++ plugin) or needs an **unavailable dependency** (a disconnected MCP, an uninstalled engine, a preview product). Record a **backlog delta** in `docs/research/impact-map.md` under the owning subsystem AND a **`descoped-reopenable`** entry with a concrete reconsider-trigger (e.g. "when mcp-unreal reconnects / UE 5.8 installed"). This is **NOT a decline** — it's a real finding waiting on a blocker. PoF's UE-plugin work lands here often; don't force-fit it into an in-repo commit.
Honor `--no-commit` / "research only" if the user said so.

### Phase 9 — Persist + grow the impact-map
- **Obsidian Research note** `Research/{YYYY-MM-DD}-{slug}.md` (frontmatter: source, type, url, title, buckets, extracted/accepted/declined, commits, web_augmentations) + per-idea blocks with accept/decline + action taken.
- **Update `docs/research/impact-map.md`:** if the run touched an area that was missing/thin, or found a new anchor, gap, or structural fact, append/refine that subsystem's entry. **Record already-have catches into that subsystem's `already-has` line** (they confirm coverage and stop future re-proposing), and **log External/blocked findings as backlog deltas** under the owning subsystem. Keep entries thin (anchors + "lands here" + already-has + gaps + doc links). This is what makes run N+1 cheaper — treat it as part of the work, not an afterthought.

### Phase 10 — Reflect (learning loop)
- Ask the user once (batched) why declined findings were skipped; write `Lessons/{YYYY-MM-DD}.md` (decline reasons + a short self-assessment of what worked/didn't in *this run's process*).
- **Pattern promotion:** a decline reason seen 3+ times across `Lessons/` → propose adding to `Patterns/user-preferences.md`.
- **Descoped-reopenable:** a finding blocked by an external dependency (the user says "come back when…") → record in `Patterns/descoped-reopenable.md` with a reconsider-trigger.
- **Structural facts** the run discovered about the codebase → fold into the impact-map (PoF's analog of a "codebase-stack" doc).

### Phase 11 — Summary + Phase 12 — Atomic commit
Print: source, extracted/relevant/accepted/declined counts, already-have catches (surface prominently when finding count is low), files updated, commit SHA. Then commit (mandatory unless no changes or user opted out): explicit `git add <path>` for in-scope files **+ `docs/research/impact-map.md`** (never `-A`); `research:`-prefixed message; let hooks run (no `--no-verify`); end with the Co-Authored-By footer. The Obsidian vault is outside the repo — it won't appear in git, and that's correct.

## Common mistakes

- **Re-scanning the whole codebase.** The impact-map exists so you don't. If it's thin for an area, scan once and *add to it* — don't repeat the scan next run.
- **Proposing what already exists.** Phase 6 step 2 + the impact-map "already-has" notes + Obsidian memory exist to catch this. A demo that yields 8 "already-have" catches + 2 real gaps is a *successful* run.
- **Padding to a number.** Low finding count on a product demo is expected; report catches instead.
- **Forgetting to grow the map.** Phase 9's impact-map update is the compounding value — skipping it means every run stays slow.
- **Committing the Obsidian vault.** It's outside the repo by design; only `docs/`, code, and the impact-map are committed.
- **Building an XL finding in one run.** Spec/handoff it; don't half-ship a subsystem.
- **Mishandling an external/blocked finding.** A finding that targets the UE plugin or needs a disconnected MCP / uninstalled engine is NOT a decline and NOT a fake in-repo commit — route it to a backlog delta + a `descoped-reopenable` entry with a reconsider-trigger (Phase 8).

## Supporting files
- `scripts/clean_vtt.py` — VTT → deduped, timestamped transcript (proven on auto-subs).
