# Dual-Execution Preview — browser mirror of catalog pipelines (spec)

> From the browser feel-prototype experiment (2026-07-22, `saber-arpg`). Status: **thin slice built** (see §4); full product is a staged program requiring human review per catalog item.

## 1. Principle

`pipeline_artifacts` (SQLite) is the engine-neutral authoring SOR; UE is one realization. A **browser runtime is a second, cheap realizer of the same artifacts** — a playable preview of items, skills, story, and progression before (and alongside) UE execution. Precedent: `CHARACTER_ABILITIES` ↔ `DT_AbilityCatalog` lockstep is already one-spec/two-runtimes.

Audited feasibility (step-facts, 342 steps): 212 text-config + 10 graph-data + 38 2d-art + 14 audio ≈ **80% directly browser-consumable**; 3d-mesh/animation partial (glb loads, fidelity diverges); 100 ue-runtime/test-gate/packaging steps stay UE-only — the verification moat is untouched.

## 2. Contract rules (non-negotiable)

1. **Read-only hydration.** The browser consumes artifacts; it never owns numbers (green-loop single-source rule).
2. **Tuning round-trips as artifact updates.** Converged browser tuning POSTs back through the server, which **re-grades with the step's own checker** (same truth rule as every write path). The browser is an instrument on the SOR, never a fork.
3. **No ladder claims.** Browser playability is a new *evidence label* (`browser-realized`), never a substitute for L3/L4 UE gates.

## 3. Full product — the trio process

Each catalog item advances through a **trio of artifacts**: PoF app (SOR + UI) → **Browser** (playable mirror) → **UE** (high-fidelity realization), with **human review after each catalog item** before the next is processed (no bulk auto-migration). Mirroring into UE = regenerate seeds from the (possibly browser-tuned) artifacts; fidelity calibration happens UE-side against the same numbers.

App impacts (user-required):
- **(a) /status browser-executable icon** — statusModel derives per-step-class `browserMirror` capability (from `src/lib/preview/browser-mirror.ts`) and the swimlane cell shows a mirror glyph for step classes executable in the browser preview.
- **(b) Per-item mirror badge in PoF UI** — StepFrame/ProvenanceStrip shows "browser mirror supported" (+ launch link) for a generated item whose data hydrates the preview.
- **(c) Headless MCP/API dual-development awareness** — pof-mcp exposes the mirror map (e.g. `pof_get_pipeline` gains `browserMirror` per step; a `pof_preview_hydrate` tool) so an established PoF project's generation flow can route a browser path alongside the UE path.

Per-domain preview scenes to grow into: combat sandbox (items/skills/status-effects — exists as saber-arpg), dialog/quest player (graph-data), progression session sim, zone walker, vendor screen.

## 4. Thin slice (built with this spec)

- **PoF:** `src/lib/preview/browser-mirror.ts` (pure: deliverable-class → mirror capability; the seed for a/b/c) + CORS-open read-only `GET /api/preview/hydrate?catalogId=` (aggregated per-entity mechanics) + `POST /api/preview/tune` (delegates to the graded upsert path — the caller can never fabricate a pass).
- **saber-arpg:** `src/data/hydrate.js` fetches the PoF origin (default `http://localhost:3001`, `?pof=` override), maps spellbook `off-arc-fp` (Effect Logic/Targeting/Balance) onto the duel's Force Push (cm→m conversion), shows a "LIVE: PoF spellbook" HUD chip, and a tuning panel (T) whose "Push to PoF" POSTs the merged step data back and displays the server's re-graded status. Silent fallback to built-ins when PoF is down.
- **Proof of value:** edit/tune Force Push while playing the duel → POST → the artifact in the lab reflects the tuned numbers, re-graded honestly → UE seeds would regenerate from the same row.

## 5. Effort map

Thin slice: L (done). Full product: XL, staged per-catalog with human review; per-domain scenes are M–L each; impacts a/b/c are S+S+M once `browser-mirror.ts` exists.
