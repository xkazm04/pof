# Spec — Self-correcting asset-generation loop

> Research-originated **design spec** (not built). From the web-discovery run (2026-06-18) — the W2 candidate. Closes the gap identified in [`agentic-3d-asset-generation.md`](./agentic-3d-asset-generation.md): PoF verifies *scenes/gameplay* (L3/L4) but its **asset-generation path does not self-correct**. Effort **L/XL** → spec per the `/research` action-by-effort rule.

## Goal

Add the agentic **generate → render → critique → refine** loop (the shared technique of the four 2025–26 agentic-3D papers) to PoF's asset-generation path, **reusing the existing L4 visual critic** rather than building a new one. Output: generated meshes/textures/characters that auto-refine toward the prompt/reference instead of "generate once, hope."

## Current state (grounded)

- `src/lib/visual-gen/providers.ts` + `poll.ts` = **fire-and-poll**: kick a provider job (Leonardo / Tripo / Scenario …), poll to done/fail/timeout, return. **No critique, no refine.**
- The visual critic already exists but is wired only to gameplay/scene verification: `src/lib/test-gate-runner/visualExecutor.ts` → `/api/verify/visual` (Gemini reads a PNG and judges it). That's the reusable "critic".
- Bounded iteration already exists: harness budget/timeout governance (`harness/claude-session.ts`) — PoF's advantage over the papers (which note no termination criterion).

## Design

A `generateWithCritique` wrapper around the existing provider+poll flow:

1. **Generate** — existing provider call + `pollUntilReady`.
2. **Render/observe** — capture a preview of the *generated asset* (a turntable / multi-angle render — echoing 3DCodeBench's multi-view renders). For UE-bound assets this can reuse the `:30040` snapshot path; for raw provider output, a lightweight headless render.
3. **Critique** — feed the render(s) + the original prompt + reference images to the existing visual critic (Gemini via `/api/verify/visual`): "does the asset match the prompt/reference? list concrete defects." (= the papers' VLM CoT self-evaluation.)
4. **Refine** — if the critic fails AND budget remains: amend the generation params/prompt from the critic's defects (e.g. re-prompt, raise poly target, fix a missing side) and regenerate. **Bounded** by an iteration cap + the harness budget (PoF's strength — don't loop forever).
5. **Record** — persist the per-asset critique history (defects → refinements) as the asset's "working memory" (echoing the scene-hypergraph), in `pipeline_artifacts` / the asset library.

## Anchors

- `src/lib/visual-gen/poll.ts` (wrap), `providers.ts` (regenerate), `asset-library-db.ts` (record history).
- Critic: `src/lib/test-gate-runner/visualExecutor.ts` + `/api/verify/visual` (reuse, don't rebuild).
- Iteration governance: pattern from `harness/claude-session.ts` (budget + cap).
- Multi-view consistency: pairs with `reference-roles.ts` (multi-view master) from the `ai-render-engine` run.

## Phasing

- **Phase 1 — critic-on-gen (M):** single pass — generate → render → critique → *report* the verdict + defects (no refine yet). Immediately useful: surfaces bad generations instead of shipping them.
- **Phase 2 — bounded refine loop (L):** add the refine step with an iteration/budget cap.
- **Phase 3 — working memory (L):** persist per-asset critique history; use it to seed the next refinement (the hypergraph analog).

## Acceptance / risk / non-goals

- **Acceptance:** a generation that fails the critic is either auto-refined within the cap or surfaced with concrete defects + the iteration count; never silently shipped.
- **Risk:** preview-render of raw provider output needs a render path (headless); critic cost per iteration (bound it). Gate Phase 2+ on the iteration economics.
- **Non-goals:** building it now; a *new* critic (reuse L4); unbounded iteration (the papers' omission — PoF must keep the cap).

## Why this is the highest-leverage next step

The frontier converges on PoF's architecture; the one thing PoF's *generation* path lacks is the self-correction loop it already runs for gameplay. Closing it turns asset generation from "fire-and-poll" into the agentic render-critique-refine loop — directly raising generated-asset quality (the indie gap), with mostly-existing parts.
