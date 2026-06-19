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

**Effort:** `S` (≤~30 LOC) · `M` (one file/feature) · `L` (multi-file) · `XL` (new subsystem / framework bet). Effort drives the action (Phase 7).

## Source classes — what a finding *is*

Classify the source up front; it changes the shape of every finding.
- **Tooling source** (a tool / feature / automation demo): findings are code/feature changes (buckets A/B/C). The default.
- **Knowledge / best-practice source** (a "how to build X *well*" talk — lighting, environment, combat feel, optimization): the value is **raising the quality of automated outputs**, not adding tooling. Route each best practice to one of **three homes** (D/B) and present candidates mapped to the home, not just the topic:
  1. **Knowledge base** → `ue-gotchas.ts` (`UE_GOTCHAS`, prompt-injected) or evaluator criteria (`module-eval-prompts.ts`). Cheapest + highest-leverage: the practice reaches every relevant dispatch prompt.
  2. **Preset** → a data-driven best-practice config (e.g. `visual-gen/lighting-presets.ts`, `rig-presets.ts`) that prompts/pipelines target.
  3. **Pipeline** → a new/extended catalog StepSpec pipeline (usually L/XL → spec it, don't half-build).

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
  **If yt-dlp hangs/throttles** (common after several pulls in one session): it's usually transient — wrap calls in `timeout`, retry once, or wait for a cooldown. Get the title independently via oEmbed (`curl -s "https://www.youtube.com/oembed?url=<watch-url>&format=json"`). Last-resort transcript fetcher: `python .claude/skills/research/scripts/fetch_transcript.py <id>` (uses `youtube-transcript-api`; needs PyPI + YouTube reachable).
  **Cleanup (mandatory, scoped to THIS run's id):** `rm -f "$WORK"/<id>.*` as soon as the cleaned text is in memory — before Phase 3, so a mid-run failure leaves no residue. Never blind-sweep `$WORK/*` (races parallel runs).
- **Article URL:** `WebFetch` for the body, stripped of nav/ads.
- **Raw text:** use as-is.
- **Web-discovery (a topic, no URL):** the user gives a topic/thread instead of a source. Run a focused `WebSearch` round (2-4 queries), then `WebFetch` the 1-2 **most substantive** results — prefer **research papers (arxiv) / primary docs / vendor docs over listicles/SEO posts**. Treat the fetched content as the source(s). This is how to reach material videos can't cover (e.g. agentic-3D research). Stay bounded — this is discovery, not a literature review.
- If transcript is disabled / text <300 words / no substantive source found: report it's too thin and stop.

### Phase 3 — Extract candidate ideas (lightweight — NO web, NO deep reads)
Extract 5–15 candidates. Each: `title` (imperative, <60 chars), `summary` (1-2 sentences), `source_anchor` (≤20-word quote or `[HH:MM:SS]`), `bucket`, `effort`, and a one-line **impact-map area** (which subsystem it'd touch — read straight from the already-loaded `docs/research/impact-map.md`; cheap). Apply memory filters (deprioritize patterns the user repeatedly declines; surface matching `descoped-reopenable` items as "reconsider?") + source-type yield calibration (engineering talk = dense; product/competitor demo = few + many "already-have" catches). Quick relevance: drop only candidates with **no plausible PoF attachment point**. **Do NOT web-search, grep, or read anchor files yet** — that budget is spent only on what the user picks.

### Phase 4 — Present candidates + PICK (early gate)
This is the cheap steering gate so a feature-rich video doesn't trigger wholesale web + codebase analysis. Show the candidate table:
```
#  Bucket  Effort  Title                          Area (impact-map)          Source
1  A       M       Wire X into the harness loop   Headless · harness/executor [04:12]
```
Note the source-type expected yield and flag any `descoped-reopenable` matches as "reconsider?". Then ask: **"Which should I investigate + (if real) implement? (numbers / all / none / ask)"**. Only picked candidates go deep. (If the run is autonomous or the user pre-authorized, pick the few highest-value yourself and say which.)

### Phase 5 — Deep-verify the PICKED candidates only
Now spend the expensive budget, on the picks only:
1. **Web-augment (bounded, ≤3 `WebSearch`/`WebFetch` calls for the whole run)** — only if a pick names a tool/technique/model whose definition sharpens framing and isn't already in the impact-map/`docs/`. One focused search → fetch the most authoritative page; capture a 2-4 sentence note (what / how / integration shape / why it matters to PoF). Don't validate the speaker's claims here; don't rabbit-hole.
2. **Impact analysis (anti-re-scan):** impact-map first → **host-infrastructure-first grep** (MCP tool → `Register*Routes`/registry; harness step → `src/lib/harness/`; pipeline step → `getStepComponent`/`ArchetypeStep`; API route → `apiSuccess`) → **read the anchor file(s)** (~30-100 lines) for the exact `file:line`.
3. **Drop if redundant** — a picked item can still resolve to an "already-have" catch; report that honestly, don't force it.
4. **Security escalation:** PoF exposes HTTP bridges (`:8090`, `:30040`), MCP servers, and spawns `claude --dangerously-skip-permissions`. If a pick touches one of these and the area lacks auth/sandbox handling, escalate it to a finding even if the source never mentioned security.

### Phase 6 — Present verified findings
The survivors (picked AND real), now with evidence. Cluster detection (same-file anchor → ships together; `depends-on [N]`; security pairs). Summary table + per-idea detail: source anchor, evidence (`file:line`), recommended action + effort, impact-map area, `aligns-with` an existing PoF pattern. Call out any picks that resolved to already-have catches.

### Phase 7 — Action-by-effort
Route each verified finding:
- **In-repo, S/M** → implement with **TDD** (`superpowers:test-driven-development`) + an atomic `research:` commit per finding. **Validate before commit:** the affected test(s) + `tsc --noEmit` + `eslint` on changed files for an S/M single-area change; run full `npm run validate` for an L or multi-area change.
- **In-repo, L** → implement the core slice (TDD + commit) + write a handoff for the remainder.
- **XL** (framework bet) → write a spec/handoff doc under `docs/` (don't half-build a subsystem); link it from the impact-map.
- **External / blocked** → the finding targets a system **outside this repo** (e.g. the UE C++ plugin) or needs an **unavailable dependency** (a disconnected MCP, an uninstalled engine, a preview product). Record a **backlog delta** in `docs/research/impact-map.md` under the owning subsystem AND a **`descoped-reopenable`** entry with a concrete reconsider-trigger (e.g. "when mcp-unreal reconnects / UE 5.8 installed"). This is **NOT a decline** — it's a real finding waiting on a blocker. PoF's UE-plugin work lands here often; don't force-fit it into an in-repo commit.
Honor `--no-commit` / "research only" if the user said so.

### Phase 8 — Persist + grow the impact-map
- **Obsidian Research note** `Research/{YYYY-MM-DD}-{slug}.md` (frontmatter: source, type, url, title, buckets, extracted/accepted/declined, commits, web_augmentations) + per-idea blocks with accept/decline + action taken.
- **Update `docs/research/impact-map.md`:** if the run touched an area that was missing/thin, or found a new anchor, gap, or structural fact, append/refine that subsystem's entry. **Record already-have catches into that subsystem's `already-has` line** (they confirm coverage and stop future re-proposing), and **log External/blocked findings as backlog deltas** under the owning subsystem. Keep entries thin (anchors + "lands here" + already-has + gaps + doc links). This is what makes run N+1 cheaper — treat it as part of the work, not an afterthought.

### Phase 9 — Reflect (learning loop)
- Ask the user once (batched) why declined findings were skipped; write `Lessons/{YYYY-MM-DD}.md` (decline reasons + a short self-assessment of what worked/didn't in *this run's process*).
- **Pattern promotion:** a decline reason seen 3+ times across `Lessons/` → propose adding to `Patterns/user-preferences.md`.
- **Descoped-reopenable:** a finding blocked by an external dependency (the user says "come back when…") → record in `Patterns/descoped-reopenable.md` with a reconsider-trigger.
- **Structural facts** the run discovered about the codebase → fold into the impact-map (PoF's analog of a "codebase-stack" doc).

### Phase 10 — Summary + Phase 11 — Atomic commit
Print: source, extracted/relevant/accepted/declined counts, already-have catches (surface prominently when finding count is low), files updated, commit SHA. Then commit (mandatory unless no changes or user opted out): explicit `git add <path>` for in-scope files **+ `docs/research/impact-map.md`** (never `-A`); `research:`-prefixed message; let hooks run (no `--no-verify`); end with the Co-Authored-By footer. The Obsidian vault is outside the repo — it won't appear in git, and that's correct.

## Common mistakes

- **Re-scanning the whole codebase.** The impact-map exists so you don't. If it's thin for an area, scan once and *add to it* — don't repeat the scan next run.
- **Proposing what already exists.** Phase 5 step 2 + the impact-map "already-has" notes + Obsidian memory exist to catch this. A demo that yields 8 "already-have" catches + 2 real gaps is a *successful* run.
- **Padding to a number.** Low finding count on a product demo is expected; report catches instead.
- **Forgetting to grow the map.** Phase 8's impact-map update is the compounding value — skipping it means every run stays slow.
- **Committing the Obsidian vault.** It's outside the repo by design; only `docs/`, code, and the impact-map are committed.
- **Building an XL finding in one run.** Spec/handoff it; don't half-ship a subsystem.
- **Mishandling an external/blocked finding.** A finding that targets the UE plugin or needs a disconnected MCP / uninstalled engine is NOT a decline and NOT a fake in-repo commit — route it to a backlog delta + a `descoped-reopenable` entry with a reconsider-trigger (Phase 7).

## Supporting files
- `scripts/clean_vtt.py` — VTT → deduped, timestamped transcript (proven on auto-subs).
