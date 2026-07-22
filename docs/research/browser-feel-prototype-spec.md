# Browser Feel-Prototype Tier (spec — not built)

> From `/research` run 2026-07-22 (`kimi-k3-one-shot-games`, tef's "KIMI K3 is Ridiculous."). Status: **spec only** — L effort, needs user appetite before building.

## The observation

One-shot text→game demos (Minecraft/Fortnite/GTA clones in ~1-2h of autonomous agent time) work because they target the **browser stack**: everything is code (three.js/canvas), there is no binary asset pipeline, no rigging/retargeting, no engine build — and "animation" is procedural transforms authored in code (grass sway, break/kill animations). LLMs are heavily in-distribution on this stack. None of that transfers directly to UE asset pipelines — but the *speed of a playable feel loop* does.

## The gap it closes in PoF

PoF's feel iteration (movement, combat rhythm, dodge timing — see `[[project_arpg_movement_feel]]`) currently pays the full UE round-trip per iteration: build → headless launch → scenario → capture → judge. Minutes-to-hours per data point. A browser prototype gives a **T0 "feel" gate in seconds**: play the mechanic with tuned constants, converge on numbers, THEN spend the UE round once.

## Shape (L)

1. **Produce:** a CLI task (`TaskFactory` + `useModuleCLI`) one-shots a **self-contained single-file HTML** (inline three.js or canvas; no CDN needed if bundled from the app's existing `three` dependency, else plain canvas 2D) implementing ONE mechanic from a direction prompt + the current balance numbers (single-source: pull from the pipeline's balance artifacts, never invent).
2. **Serve + play:** write under `generated/feel/<slug>.html`, serve via a `/api/feel/asset/<slug>` route (mirror `/api/visual-gen/asset`), render in an iframe panel (Experiment-Lab sibling surface or a `/feel` lab tab).
3. **Export the tuned constants:** the prototype exposes its tunables as sliders + a "copy constants" JSON block. The converged JSON becomes the **input contract for the UE implementation prompt** (the single-source-numbers rule from the green-loop lessons — no number lives only in the prototype).
4. **Optional judge tier:** capture frames of the prototype (Playwright screenshot loop) → the existing Qwen vision seam (`anim-critique/qwen.ts`) for a cheap feel/readability verdict. Not required for v1.

## What this is NOT

- Not a shipping target, not a UE replacement, and **no acceptance-ladder claim**: a browser prototype can never flip a step past L1 (it is not UE ground truth). It is an upstream ideation/tuning instrument.
- Not a general "generate games in the browser" feature — one mechanic per prototype, feeding one UE implementation.

## Anchors

`src/lib/cli-task.ts` (TaskFactory), `src/hooks/useModuleCLI.ts`, `src/lib/ue-experiment/` (lab-surface pattern), `/api/visual-gen/asset` (serve-route pattern), `src/lib/anim-critique/qwen.ts` (optional judge), balance artifacts via `pipeline_artifacts`.

## Reconsider trigger

Build when feel-tuning latency is the active complaint (another ARPG-movement-feel-style campaign) or when the user asks for a mechanic sandbox. First slice: movement feel (WASD + dash), since `project_arpg_movement_feel` already defines the target feel vocabulary.
