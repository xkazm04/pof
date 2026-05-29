# Harness Applicability — wiring the Observation/Scenario harness across the catalog pipelines

**What the harness is:** a *faithful* runtime+visual verification engine for the UE project — a runtime `UScenarioController` (PoF module) + the `observation.*` verbs (api_probe / get_state / evaluate_pose / capture_frame / run_scenario(Ex)) driven over the PoF Bridge. It runs scenarios **inside a real game loop** (naturally-ticked PIE or standalone `-game`), drives **real input** (keys via IMC, or action-level), and emits machine- **and** vision-readable artifacts (JSON metrics + frame sequences a Claude Code agent `Read`s). Proven: it diagnosed + verified the player walk-cycle and WASD directions, and surfaced its *own* fidelity gaps (sim-key modifiers, sim-Boolean triggers).

**Where it fits the acceptance ladder** (`WIRING-AND-ACCEPTANCE.md §2`): the harness IS the **L3 (Runtime)** and **L4 (Visual)** engine. L0/L1/L2 (data / human-selection / static) are unchanged and parallel-safe; the harness fills the *deferred* tiers. It does NOT replace data or human-gated steps.

**Key upgrade over the current `test-gate-runner`:** today's executors prove *symbolic* facts (class loads, actor spawns, automation test returns PASS) — exactly the kind of green-but-wrong signal that let the player T-pose through every gate. The harness upgrades them to **observed behaviour** (the attribute actually moved, the character actually animated, the frame actually rendered the thing). Route the executors through it:

| `test-gate-runner` executor | today | upgrade to |
|---|---|---|
| `bridgeExecutor` (L3 cheap) | `load_class`/`load_asset`/CDO read | `observation.get_state` + `api_probe` (existence **and** loaded-state truth) |
| `spawnExecutor` (L3 behavioural) | spawn + `run-automation`, judge `-abslog` | `observation.run_scenario(Ex)` — spawn, drive input/events, **sample the observable effect** (attribute delta, montage played, pose, displacement) |
| `visualExecutor` (L4) | RHI screenshot + Gemini verdict | `observation.capture_frame` / scenario frame-sequence → **Claude Code agent `Read`s** (the T4 authority; no Gemini) |

---

## Applicability by archetype (the unit of work)

Extent = how much of the archetype's acceptance the harness can *faithfully* own.

| Archetype | Harness extent | What it verifies (L3 / L4) |
|---|---|---|
| **Animation** (locomotion/combat/emote) | **FULL** ✅ | L3: clip/montage plays + drives the skeleton (pose sampling, no T-pose); L4: rendered pose. *Proven path.* |
| **Rules/Logic — GAS abilities** | **FULL** ✅ | L3: scenario activates the ability → attribute moves / montage plays / cooldown blocks re-cast; L4: VFX renders. *Highest value.* |
| **Graph/Behavior — AI/NPC** | **FULL** ✅ | L3: spawn AI + target, observe patrol→chase→attack over time (positions/state). Pure behavioural. |
| **VFX (Niagara)** | **FULL** ✅ | L4: trigger the effect, capture frames, agent confirms it renders/animates; L3: spawns + triggers. |
| **Material** | **FULL** ✅ | L4: apply to a preview mesh, capture, agent confirms surface/maps; L3: perf via TestGate. |
| **3D & Rig / Mesh** | **FULL** ✅ | L4: spawn + capture (no broken/missing mesh, rig poses); L3: skeleton/bounds intact. |
| **Level / World / Zones** | **FULL** ✅ | L3: navmesh/spawns/triggers reachable; L4: zone renders, framed captures. |
| **TestGate** | **FULL** ✅ | This *is* the L3/L4 gate — the harness becomes its engine. |
| **Schema / Attributes** | **PARTIAL** ◐ | L0/L2 stay data/static; harness adds light L3 — spawn an actor, `get_state` confirms the attribute initialised to the schema value. |
| **Item behaviour** (equip/consume/loot-drop) | **PARTIAL** ◐ | L3: equip applies the stat / consumable fires / loot drops + picks up. Most item acceptance stays L0/L1/L2. |
| **UI / HUD** | **PARTIAL** ◐ | L4 only, and needs a **viewport/widget capture extension** (SceneCapture is world-space). The current Gemini HUD path covers this today. |
| **Balance / Economy** | **NONE** ✗ | Data-derived (curves/budgets) — L0. Nothing to observe at runtime. |
| **Concept2D / Icon2D** | **NONE** ✗ | L1 human-gated art selection. (Marginal L4: confirm the chosen asset imports/renders in-engine.) |
| **Audio / Music / VO** | **NONE** ✗ | No audio capture in the harness. Stays data + human + A/B TestGate. |
| **Localization / Accessibility / Packaging** | **NONE** ✗ | Static/data (L0/L2). |

## Applicability by entity category (the 30 rows)

| Category | Extent | Note |
|---|---|---|
| **Characters / Hero / NPC** | **FULL** | Heaviest harness user: animation + mesh + behavior + signature VFX all L3/L4. |
| **Abilities / Combat / Bestiary (enemies)** | **FULL** | GAS-activation + AI-behaviour + hit/damage observation — the harness's sweet spot. |
| **VFX** (39) | **FULL (L4)** | Render/animation capture. |
| **Materials** (26) | **FULL (L4)** | Preview-mesh render capture. |
| **Items** (47) | **PARTIAL** | Mostly L0/L1/L2; L3 for equip/consume/loot behaviour, L4 for mesh/icon-in-engine. |
| **Loot** | **PARTIAL** | L3 drop/pickup/roll behaviour. |
| **Audio** (32) | **NONE** | Out of scope for a visual/positional harness. |

---

## Wiring plan (incremental, reuses existing infra)

1. **Make the harness the runtime/visual executor backend.** Point `src/lib/test-gate-runner/{bridgeExecutor,spawnExecutor,visualExecutor}.ts` at the `observation.*` verbs over the bridge (the executors already speak to the bridge; swap the called verb + parse the observation envelope). `drain.ts` keeps draining `deferred` L3/L4 artifacts one-at-a-time behind the live-UE lease — unchanged.
2. **Generalize `run_scenario` beyond locomotion.** The scenario spec (`{map, inputs[], observations[]}`) already supports extensible observations; add observation kinds the archetypes need: `attribute(name)`, `ability-activated(tag)`, `damage-dealt`, `actor-spawned(class)`, `montage-playing`. Each archetype's `TestGate` declares the observations that constitute its L3 trace (the "one observable end-to-end behaviour" from `WIRING-AND-ACCEPTANCE §2`).
3. **Calibration-first per archetype.** Before trusting a new archetype's gate, calibrate it against a known-good + known-bad (as done for locomotion: Manny-walks vs anim-less-T-pose). No archetype gate is believed until it separates them.
4. **Agent as the L4 authority.** `visualExecutor` returns the frame path(s); the catalog CLI/agent `Read`s them and writes the verdict — replacing Gemini per the LLM↔UE design (the multimodal agent is T4).
5. **Honor the parallel-CLI model.** L3/L4 stays a single-resource gate behind the live-UE lease; CLIs reach config-complete (L0–L2) solo and mark L3/L4 `deferred`; the serialized runner (now harness-backed) drains them. No change to the parallel model — just a *faithful* runner instead of a symbolic one.

## Priorities (highest ROI first)

1. **Animation + Abilities/Combat** — FULL extent, already proven, and the tiers most prone to green-but-wrong (the original motivation). Wire `spawnExecutor` → `run_scenario(Ex)` here first.
2. **VFX + Materials + Mesh** — FULL L4; wire `visualExecutor` → `capture_frame` + agent Read.
3. **AI/Behavior** — FULL L3; high value, no current faithful gate.
4. **Schema/Items** — PARTIAL L3; low effort (get_state), do opportunistically.
5. **Skip** Balance/Audio/Localization/Concept-Icon for the harness — their acceptance is data/human/audio.

## Honest limits (from stress-testing the harness)

- **Simulated input has fidelity gaps**: injected keys initially bypassed IMC modifiers (fixed by C++ authoring), and Boolean action triggers (e.g. dodge on SPACE) don't fire faithfully via injection. → For input-binding correctness, prefer **action-level injection** or **static IMC verification**; the real keyboard is the final oracle. Movement/animation/ability *effects* observe faithfully.
- **UI/HUD** needs a viewport/widget capture path the world-space SceneCapture doesn't provide.
- **No audio.**
- L3/L4 still serializes through one editor on the shared UE tree (the lease) — unchanged.
