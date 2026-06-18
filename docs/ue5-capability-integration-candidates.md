# UE5 Capability Integration Candidates (5.6 / 5.7 / 5.8)

> Backlog candidates for plugging PoF's asset/character pipeline into **first-party Unreal Engine capabilities** that shipped (or entered preview) across UE 5.6, 5.7, and 5.8. This is the *engine-side* counterpart to [`visual-generation-roadmap.md`](./visual-generation-roadmap.md): the roadmap covers what PoF **generates**, this doc covers what the engine now **accepts and automates** — and where our `design → 2D → 3D → playable` flow should target it.

## Scope & horizon

- **Horizon:** 2026 (this-year). All items below are backed by shipped or preview UE 5.x builds available **now**.
- **UE6 is explicitly out of scope.** UE6 is a ~2028 architectural play (engine/UEFN unification, multithreaded simulation, Verse) with **no announced asset/character-generation tooling**. We do not architect around it. See chat research 2026-05-25. The one UE6 takeaway that *helps* us: its "one engine, one toolchain" goal should make a single integration target easier later — so keep the bridge/import layer engine-version-agnostic.
- **Status:** These are *candidates*, not committed work. They feed `/docs/improvements/`-style folders or future ECW phases when picked up.
- **Single biggest near-term unlock:** UE 5.7's full **MetaHuman Python/Blueprint scripting API** + UE 5.8's **"any mesh → MetaHuman" conforming**. Together they close PoF's long-standing auto-rig gap (UniRig was a placeholder) by routing generated character meshes into a fully-rigged, animation-ready MetaHuman — scriptable, headless, no manual editor work.

Markers: ✅ ready to wire today · 🟡 preview/experimental, prototype now · ⚫ depends on unbuilt PoF plumbing first.

---

## Candidate A — Genome → MetaHuman assembly (scriptable) ✅

**UE version:** 5.7 (MetaHuman scripting API) · 5.6 (MetaHuman Creator in-engine).

**What landed:** UE 5.7 lets you **automate and batch nearly all MetaHuman editing and assembly operations via Python or Blueprint** — interactively in-editor *or* offline on a compute farm. UE 5.6 brought MetaHuman Creator into the engine and loosened the license (characters/animations usable in other engines and in Maya/Houdini/Blender).

**Why it matters to PoF:** We already have a portable character genome and a codegen path to a UE5 C++ `AARPGCharacterBase` subclass. The genome's identity/appearance fields can now *also* drive a scripted MetaHuman assembly — turning "design DNA" into a photoreal, rigged character with zero manual editor steps.

**Integration points:**
- `src/types/character-genome.ts` + `src/components/modules/core-engine/sub_character/genome/codegen.ts` — add a MetaHuman-assembly target alongside the C++ codegen.
- `src/lib/visual-gen/ue5-import-templates.ts` — emit the Python assembly script.
- PoF Bridge companion plugin ([`ue5-companion-plugin-design.md`](./ue5-companion-plugin-design.md)) — dispatch the script; report back.

**Effort / dependency:** Medium. Needs the genome→MetaHuman field mapping defined and the bridge able to run MetaHuman Python. Headless/compute-farm mode is a stretch goal for batch character runs.

---

## Candidate B — Generated mesh → MetaHuman conform (closes the auto-rig gap) 🟡

**UE version:** 5.8 preview.

**What landed:** UE 5.8 can **turn almost any human mesh into a MetaHuman, with simultaneous head and body conforming**. Plus the **MetaHuman Crowd** plug-in for populating worlds.

**Why it matters to PoF:** This is the missing link in `design → 3D → playable character`. An AI-generated character mesh (Asset Forge: TripoSR / TRELLIS.2 / Hunyuan3D / cloud) can be conformed into a fully-rigged MetaHuman instead of relying on the placeholder UniRig path. It directly retires the riskiest step of [roadmap Direction 6 (Auto-Rig)](./visual-generation-roadmap.md).

**Integration points:**
- `src/lib/visual-gen/providers.ts` + `src/app/api/visual-gen/generate/route.ts` — Asset Forge character outputs become conform inputs.
- `src/components/modules/visual-gen/auto-rig/AutoRigView.tsx` — add a "Conform to MetaHuman" path next to the existing UE5 Mannequin / Mixamo presets.
- Bridge import step to run the conform script.

**Effort / dependency:** Medium-High, and **gated on 5.8 stability** (preview, not quality-tested). Prototype against preview, productionize when 5.8 ships. Also depends on Asset Forge generation being wired (currently a placeholder endpoint — 🟡 in the roadmap).

---

## Candidate C — MetaHuman as a base-mesh source into the Blender pipeline ✅

**UE version:** 5.6 (FBX + DNA export, Y-up/Z-up; open license).

**What landed:** From the MetaHuman Expression Editor you can **export FBX + DNA** for use outside MetaHuman Creator; the 5.6 license permits use in Blender/Maya/other engines.

**Why it matters to PoF:** Our Blender MCP pipeline (21 scripts incl. armature/weights/retarget) can ingest MetaHuman exports as a high-quality rigged base for customization, retopo, LODs, and re-export — without leaving PoF or violating licensing.

**Integration points:**
- `src/lib/blender-mcp/scripts/` — add a MetaHuman-FBX ingest/normalize script (handle the Y-up/Z-up + normals/tangents import caveats).
- `src/lib/blender-mcp/service.ts` — expose it as an operation.

**Effort / dependency:** Low-Medium. Builds directly on the existing, working Blender MCP service.

---

## Candidate D — Emit PCG graphs/params instead of (only) baked meshes ✅

**UE version:** 5.7 (PCG framework **production-ready** + PCG Editor Mode, faster GPU compute, GPU param overrides) · 5.8 (**editable PCG results**, experimental **Mesh Terrain**).

**What landed:** PCG is now production-grade with a scriptable graph API (`get_graph`, `execute`, `set_parameter`, `add_node`, `connect_nodes`, `get_results`) and an Editor Mode (spline drawing, point painting, volume creation).

**Why it matters to PoF:** Our procedural engine currently produces baked heightmaps/meshes/CSV. Targeting PCG lets PoF emit **graphs/parameters** the engine evaluates at runtime — designers keep editing in-engine (5.8 editable results), and large-scale worlds get GPU-accelerated. Upgrades [roadmap Direction 7](./visual-generation-roadmap.md) from "export blockouts" to "drive native PCG."

**Integration points:**
- `src/lib/visual-gen/generators/terrain.ts`, `dungeon.ts`, `vegetation.ts` — add PCG-graph/param emitters next to the mesh/CSV exporters.
- PoF Bridge — push graph params via the PCG graph API.

**Effort / dependency:** Medium-High. Needs a PCG graph schema mapping; biggest payoff for environment-scale work.

---

## Candidate E — Vegetation generator → Nanite-ready PVE assets ✅/🟡

**UE version:** 5.7 (Nanite Foliage) · 5.8 (**Procedural Vegetation Editor** — biologically-accurate, Nanite-ready, imports DCC meshes; nodes for growth/trimming/object-avoidance/grafting).

**Why it matters to PoF:** Our `scatter-vegetation.ts` Blender script and vegetation generator can target Nanite Foliage / PVE assets rather than raw instanced scatter, getting engine-quality foliage at scale.

**Integration points:**
- `src/lib/blender-mcp/scripts/scatter-vegetation.ts` and `src/lib/visual-gen/generators/vegetation.ts`.
- **Heed the known gotcha:** `AARPGVegetationScatter` regenerates HISM on `BeginPlay` (default true), discarding edit-time `NO_COLLISION` — set `generate_on_begin_play=false` (see project memory `reference_ue_scatter_begin_play_regen`).

**Effort / dependency:** 5.7 Nanite Foliage path is wireable now (✅); the full PVE path is 🟡 (5.8 preview).

---

## Candidate F — Material Lab exports Substrate slabs, not just legacy PBR ✅

**UE version:** 5.7 (Substrate **production-ready**).

**What landed:** Substrate is the production material framework — slab-based, unifying what used to be Default Lit / Subsurface / Cloth / clearcoat / thin-film.

**Why it matters to PoF:** Material Lab already generates PBR map sets + UE5 Material Instance parameter JSON. Adding a **Substrate Slab** export keeps PoF aligned with the engine's current material model (and is the more future-proof target as Substrate becomes the default).

**Integration points:**
- `src/components/modules/visual-gen/material-lab/` and the Material Instance JSON emitter referenced in [roadmap Direction 4](./visual-generation-roadmap.md).
- `src/lib/visual-gen/ue5-import-templates.ts` — Substrate-aware material creation in the import script.

**Effort / dependency:** Medium. Map our PBR channels → Substrate slab parameters.

---

## Candidate G — Converge on the first-party UE MCP server (control surface), keep PoF's verification moat ✅/🟡

**UE version:** 5.7 (in-editor AI Assistant + community `mcp-unreal` server — wireable today) · **5.8 (first-party Epic MCP server, Experimental)**.

> Updated 2026-06-18 after researching UE 5.8's official MCP (Epic docs + three demo walkthroughs). The original candidate only knew the *community* `mcp-unreal` (remiphilippe, Go) and the 5.7 AI Assistant; 5.8's **first-party** MCP is the bigger, more durable target and changes the recommendation from "adapter work" to "converge."

**What landed:** UE **5.8 ships an official, first-party MCP server from Epic.** A built-in **Terminal** plugin runs Claude Code *inside* the editor (`Tools → Terminal`); companion **Unreal MCP** + **Toolset Registry** plugins do the work. Custom tools are authored **natively** — C++ `UFUNCTION(meta = (AICallable))` static methods on a `UToolsetDefinition`, or Python `@toolset_registry.tool_call` `@staticmethod` on `unreal.ToolsetDefinition` — and the **Toolset Registry** subsystem auto-discovers them (scans plugin `Content/Python/`; `ModelContextProtocol.RefreshTools` re-polls). **Tool-search is on by default** (the server advertises three meta-tools — `list_toolsets` / `describe_toolset` / `call_tool` — instead of every schema). `ModelContextProtocol.GenerateClientConfig ClaudeCode` writes the client `.mcp.json`. Transport is **HTTP + SSE only at `http://127.0.0.1:8000/mcp`** (no stdio/WebSocket). Shipped toolsets: ActorTools, SceneTools, MaterialInstanceTools, ObjectTools, AttributeSetToolset (GAS, experimental); most are Python.

**Caveats (Experimental — design around these):** loopback-only with **no authentication layer**; **no code-execution / "code mode" tool**; **Live Coding does not propagate new `UFUNCTION`s — adding a tool requires an editor restart** (friction vs. hot route edits).

**Where PoF stands today:** PoF targets **5.7** and runs a **bespoke dual-plugin** stack — `Plugins/MCPUnreal/` (HTTP `:8090`, ~37 hand-registered routes via `Register*Routes()`, behind a community Go MCP process, **no tool-search**) for raw control, and `Plugins/PillarsOfFortuneBridge/` (HTTP `:30040`, **auth-token validated**) for app/harness/test-gate integration. The app-spawned Claude Code session is launched with **no `--mcp-config`** (`src/lib/claude-terminal/cli-service.ts`) — it drives PoF via `@@CALLBACK` markers, not MCP tools.

**Why it matters to PoF:** The first-party MCP is the durable, maintained target our bespoke `MCPUnreal` routes were a workaround for. Re-homing our 37 PoF-specific tools as a **Python Toolset Registry toolset** (we already ship plenty of `Content/Python/`) would retire the Go bridge *and* the hand-rolled HTTP routing, riding Epic's growing surface — our tools become exactly the "gap-filler" toolsets the community already expects to layer on top. **But the official MCP is only a *control* surface** — it has no verification, no code-mode, no auth. PoF's distinctive value (`execute_script`, the L3/L4 observation + Gemini-visual spine, the auth'd bridge) is precisely what Epic omits. So the bet is **adopt the control surface, keep the verification/orchestration moat** — not rip-and-replace.

**Integration points:**
- `Plugins/MCPUnreal/` — map the 37 `Register*Routes()` handlers to `@toolset_registry.tool_call` Python staticmethods (or C++ `AICallable`); **keep `execute_script` as a custom toolset** (the missing "code mode," and a candidate to contribute upstream).
- `src/lib/claude-terminal/cli-service.ts` — pass `--mcp-config` so the harness Claude can call UE tools directly (today: callbacks only).
- `src/lib/test-gate-runner/` + `PillarsOfFortuneBridge` (`:30040`) — keep as the verification/auth layer *above* whichever control transport wins.
- CLI skills (`src/components/cli/skills.ts`) — add a UE-MCP / bridge-ops skill (be-specific + coordinates-to-avoid-overlap prompting; check *both* the editor and server logs when debugging).

**Effort / dependency:** Medium, **gated on a 5.7 → 5.8 engine upgrade** (5.8 and the MCP feature are preview/Experimental). Prototype the Python-toolset path + `--mcp-config` wiring against 5.8 preview now; productionize when 5.8 ships and the restart-to-register / no-auth caveats are acceptable. High strategic value (less bespoke surface to maintain; forward-compatible with the UE6 "one toolchain" direction). **Concrete spike plan:** [`ue58-mcp-convergence-plan.md`](./ue58-mcp-convergence-plan.md).

**Sources:** Epic — *Unreal MCP in Unreal Editor* (https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor); demo walkthroughs — BuiltByMoebs (https://youtu.be/A3PbbbjzB1c), VibeUE (https://youtu.be/Ko3dy_G75-s), Flopperam (https://youtu.be/ct5dNJC-Hx4).

---

## Candidate H — Animation pipeline: MetaHuman Animator + Control Rig Physics 🟡

**UE version:** 5.7 (MetaHuman Animator) · 5.8 (**Control Rig Physics → Beta**).

**Why it matters to PoF:** Extends [roadmap Directions 6 & 10](./visual-generation-roadmap.md): MetaHuman Animator (video → facial animation) is a first-party alternative/complement to MediaPipe mocap; Control Rig Physics adds secondary motion to rigged characters. Natural follow-on once Candidate A/B land a rigged MetaHuman.

**Effort / dependency:** Medium-High; ⚫ depends on the character→MetaHuman path (A/B) existing first.

---

## Candidate I — Evaluator readiness checks for new engine features ✅

**UE version:** 5.7 (Nanite Foliage) · 5.8 (**MegaLights production-ready**, Mesh Terrain).

**Why it matters to PoF:** Low-effort, high-coverage. Our 3-pass module evaluators already check for things like State Tree vs. legacy behavior trees. Add readiness/usage checks for MegaLights, Nanite Foliage, Substrate, and PCG so generated/audited projects are scored against current-engine best practice.

**Integration points:** `src/lib/evaluator/module-eval-prompts.ts`.

**Effort / dependency:** Low. Prompt/criteria additions only.

---

## Priority (2026 horizon)

| Tier | Candidate | Rationale | Readiness |
|------|-----------|-----------|-----------|
| **P1 — do first** | A · Genome → MetaHuman assembly | Highest leverage; builds on existing genome + bridge | ✅ 5.7 shipped |
| **P1** | C · MetaHuman → Blender ingest | Low effort on a working subsystem; unlocks A/B | ✅ 5.6 shipped |
| **P1** | I · Evaluator readiness checks | Cheap, broad coverage | ✅ |
| **P2 — high value** | B · Mesh → MetaHuman conform | Closes the auto-rig gap; needs Asset Forge wired | 🟡 5.8 preview |
| **P2** | G · Converge on first-party UE MCP | Retires the bespoke dual-bridge; rides Epic's maintained surface; keep the verification moat | 🟡 5.8 (Experimental) · ✅ 5.7 community |
| **P2** | F · Substrate export | Future-proofs Material Lab | ✅ 5.7 |
| **P3 — environment scale** | D · PCG graph emission | Big payoff, larger schema effort | ✅ 5.7 / 🟡 5.8 |
| **P3** | E · Nanite/PVE vegetation | Mind the BeginPlay regen gotcha | ✅ 5.7 / 🟡 5.8 |
| **P4 — follow-on** | H · MetaHuman Animator + Control Rig Physics | Depends on A/B landing first | 🟡 |

**Critical path for the character pipeline:** C (ingest) → A (assembly) → B (conform) → H (animate). Wiring Asset Forge generation (currently a placeholder endpoint) is the shared prerequisite for B.

---

## How this relates to the existing roadmap

[`visual-generation-roadmap.md`](./visual-generation-roadmap.md) defines *what PoF builds* (10 directions). This doc says *which native UE 5.x features those directions should target* now that they've shipped:

- Direction 4 (Material Lab) → **Candidate F** (Substrate)
- Direction 6 (Auto-Rig) → **Candidates A, B, C, H** (MetaHuman scripting/conform/Animator)
- Direction 7 (Procedural Engine) → **Candidate D** (PCG)
- Direction 8 (Import Automation) → **Candidate G** (UE-MCP interop)
- Plus vegetation (E) and evaluator (I) cross-cutting both.

---

## Sources & confidence

**Well-sourced (shipped):** UE 5.6 MetaHuman in-engine + FBX/DNA export + open license; UE 5.7 (shipped 2025-11-12) PCG production-ready, Substrate production-ready, Nanite Foliage, MetaHuman Python/Blueprint scripting API, in-editor AI Assistant, MetaHuman Animator. **Preview (subject to change):** UE 5.8 (preview ~2026-05-14) Procedural Vegetation Editor, mesh→MetaHuman conform, MetaHuman Crowd, editable PCG results, experimental Mesh Terrain, MegaLights production-ready, Control Rig Physics Beta, **first-party MCP server (Experimental) — `AICallable` / Python Toolset Registry, tool-search, in-editor Terminal; HTTP+SSE loopback, no auth, restart-to-register**.

- Unreal Engine 5.7 release — https://www.unrealengine.com/news/unreal-engine-5-7-is-now-available
- UE 5.7 PCG production-ready — https://www.tweaktown.com/news/107858/unreal-engine-5-7-preview-now-out-with-production-ready-procedural-content-generation-framework/index.html
- MetaHuman 5.7 (scripting/Animator) — https://www.metahuman.com/releases/metahuman-5-7-is-now-available
- UE 5.7 MCP server (community) — https://github.com/remiphilippe/mcp-unreal
- UE 5.8 first-party MCP server (Epic, Experimental) — https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor
- MetaHuman 5.6 FBX/DNA export — https://dev.epicgames.com/documentation/metahuman/saving-and-exporting-data
- UE 5.8 preview — https://80.lv/articles/unreal-engine-5-8-preview-has-arrived
- UE 5.6 integrated MetaHuman Creator + license — https://wnhub.io/news/engines/item-47953

_Created 2026-05-25 from a UE 5.6/5.7/5.8 capability scan against the PoF pipeline._
