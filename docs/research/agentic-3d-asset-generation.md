# Agentic 3D-asset generation — research patterns & how PoF maps

> Reference synthesis from a `/research` web-discovery run (2026-06-18). The "agent harness for 3D assets" topic *does* have substantive 2025–26 research (unlike the YouTube/listicle surface). The headline: **the research frontier is converging on the architecture PoF already has** — and it exposes one concrete gap. Sources cited inline.

## The four papers

| Paper | Core technique |
|---|---|
| [Agentic 3D Scene Generation w/ Spatial VLMs](https://arxiv.org/abs/2505.20129) (2505.20129) | 4-stage pipeline (asset gen → layout → environment → ergonomics). **Verification loop:** render the scene → VLM **chain-of-thought self-evaluation** (rendered vs expected) → **refine the Blender code**. Working memory = a continually-updated **scene hypergraph** (objects + spatial relations). |
| [SAGE](https://arxiv.org/html/2602.10116v1) (2602.10116) | Text → sim-ready scenes by **orchestrating generator tools + visual/physics critics**; the agent dynamically calls generators, critics give iterative feedback for self-improvement. |
| [3DCodeBench](https://arxiv.org/html/2606.01057) (2606.01057) | VLM agent draws on a **structured knowledge base** → Blender Python via API migration + **geometric validation** + iterative refinement using **multi-view renders**. |
| [Articraft](https://arxiv.org/abs/2605.15187) (2605.15187) | Agentic system for scalable **articulated (rigged) 3D-asset** generation. |

## The pattern (shared across all four)

**Generate → render/observe → critique (VLM/critic) → refine, with a structured knowledge base as working memory, looped until consistent.** This is precisely PoF's "Tiers of Truth" thesis applied to *asset* generation.

## How PoF maps (validation)

| Research pattern | PoF equivalent | Status |
|---|---|---|
| Render → VLM self-eval → refine | Observation spine + L4 Gemini visual gate (`test-gate-runner/visualExecutor.ts`); "no done without a ground-truth observation" | ✅ PoF does this — for **scenes/gameplay** |
| Multi-tool + critic orchestration | Harness (`src/lib/harness/`) orchestrating pipeline steps + L3/L4 gates as critics | ✅ aligned |
| Structured knowledge base / scene hypergraph as working memory | `pipeline_artifacts` (SQLite authoring truth) + `docs/research/impact-map.md` + the knowledge-injection this skill builds (gotchas/presets) | ✅ aligned (different shape: persisted truth vs in-run hypergraph) |
| Bounded, governed iteration | Harness budget/iteration governance (`claude-session.ts` cost + timeout) | ✅ **PoF is ahead** — the papers note no explicit termination criterion |

**Takeaway:** PoF's harness + observation spine + persistent authoring truth are a *production-grade* instance of what these papers prototype. PoF adds bounded iteration + a persistent (not just in-run) knowledge base — both gaps the papers leave open.

## The gap PoF has

**Self-correction on asset GENERATION.** PoF verifies scenes/gameplay (L3/L4), but the asset-generation path (`visual-gen/providers.ts` → `poll.ts`) is **fire-and-poll**: generate via a provider, poll to done/fail/timeout — there is **no render→critique→refine loop on the generated mesh/texture/character**. The papers' central technique is exactly that loop. → spec'd in [`self-correcting-asset-gen-spec.md`](./self-correcting-asset-gen-spec.md) (W2).

Secondary: **articulated-asset generation** (Articraft) — generating rigged/jointed assets agentically — is adjacent to PoF's auto-rig gap (MetaHuman-conform direction; see `ue5-capability-integration-candidates.md` Candidate B).

## Animation-generation landscape (Thread A — Mixamo alternatives)

Web research here was a relative bust for *tooling*: the popular Mixamo alternatives ([DeepMotion](https://mocaponline.com/blogs/mocap-news/mixamo-alternatives) video-to-motion, AccuRig, Cascadeur, Character Creator) are **GUI/credit-based, output needs cleanup (foot sliding, jitter), and lack clean headless APIs** — poor automated-pipeline fits (same shape as the run-2 AccuRig decline). The genuine, in-domain delta is **knowledge, not a provider**: Mixamo's library is aging/limited; for missing motions, AI video/text-to-motion can fill gaps but needs cleanup + retarget-quality verification before production. Captured as an `arpg-animation` evaluator criterion (W3).

## What this means for PoF

PoF is **on the right architecture** — the frontier is converging on it. The highest-leverage next step is closing the **self-correcting asset-gen loop** (W2): reuse the existing L4 visual gate as the "critic" for the generation path, not just for gameplay scenes.
