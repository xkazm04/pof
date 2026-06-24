# Parallel Development Plan — 4 concurrent Claude Code streams

Goal: run **4 Claude Code CLI sessions in parallel**, each developing a different slice of the game, then integrate into one playable vertical slice. The four slices:

1. **Environment** — an ancient arena with a sandy floor
2. **Character** — make the player a Jedi
3. **Actions** — force push, lightsaber attack, parry, roll (believable animations)
4. **Inventory** — a chest holding a health potion; loot it; display + use the inventory

The hard part isn't the features — it's **doing them in parallel on one UE project without merge hell**. UE `.uasset`/`.umap` are binary and **cannot be merged**. This plan exists to make the four streams *physically unable to collide*, and to keep every stream honest to the project's law: **no "done" without a rendered frame or a ground-truth observation.**

---

## The isolation model (read first — this is what makes parallel work)

Three rules, enforced by structure not discipline:

1. **One branch + one git worktree per stream.** Each stream is a separate working copy of the UE repo (`git worktree add ../PoF-<stream> feature/<stream>`), on its own branch off `main`. Separate worktree = separate Content on disk = separate headless UE editor (no editor-lock contention) = no working-tree collisions. (Cost: each worktree builds its own binaries + has its own DDC — heavy but correct. If the machine can't host 4 editors at once, stagger the *editor* steps; the authoring/codegen can still be concurrent.)
2. **Disjoint content folders + private maps.** Every stream owns a unique `Content/` subtree and its **own** test map. A stream **never** opens or saves another stream's `.uasset`/`.umap`. The shared playable level is assembled once, at integration, by a single owner.
3. **Shared C++ is a coordination zone.** A short list of files (below) is touched by more than one stream. Rule: **prefer new files / subclasses / components over editing shared files**; when a shared edit is unavoidable, it's *additive* and announced. Better: **Phase 0 pre-stubs the shared hooks** so the streams are purely additive.

> Run the sessions **from the app repo `kiro/pof`** (so they inherit the shared `CLAUDE.md`, the `docs/`, the tooling, and the project memory), and drive the UE worktree via the established headless recipes. The UE project path each session targets is its own worktree.

### Shared coordination zones (touch minimally, announce in commit)
| File / asset | Who wants it | Rule |
|---|---|---|
| `Source/PoF/Character/ARPGCharacterBase.{h,cpp}` | Character, Actions, Inventory | Add via **component / BP subclass / data**, not base edits. Phase 0 adds the inventory-component slot + an ability-grant list. |
| `Source/PoF.Build.cs` | anyone adding a module dep (UMG for Inventory UI) | additive only; announce |
| `DT_AbilityCatalog` / `CHARACTER_ABILITIES` (app `sub_character/_shared`) | Actions | keep app↔UE in lockstep (see memory `project-ability-catalog-sync`) |
| GAS `ARPGAttributeSet` | Actions, Inventory (potion heal) | additive attributes only |
| The integration map | Integrator only | streams use **private** maps |

---

## Phase 0 — integration stubs (do this once, before launching the 4)

A 30-minute pass (the integrator, or one bootstrap session) that pre-creates the shared seams so the streams never fight over `ARPGCharacterBase`:

- `BP_JediPlayer` — a Blueprint subclass of the player pawn (Character stream configures mesh/saber here; no base edit).
- A **data-driven ability-grant list** on the character (an array the Actions stream appends to via data, not C++ edits) — or confirm the existing `AbilitySet` covers it.
- A `UInventoryComponent` **stub** attached on the pawn (empty; Inventory stream fills it in its own files).
- `Content/Maps/Arena_Ancient.umap` **skeleton** (empty lit box) so Environment has a target and others have a place to integrate.
- Confirm the project **builds on 5.8** (the IWYU pins are on `main`) and the **harness smoke-captures** a frame.

Phase 0 lands on `main` first; the four streams branch off it.

---

## The four streams

| # | Stream | Branch | Owns (Content) | Owns (Code) | Private map |
|---|--------|--------|----------------|-------------|-------------|
| 1 | Environment | `feature/env-arena` | `Content/Environments/AncientArena/` | (none / a layout+lighting Python) | `Maps/Arena_Ancient` |
| 2 | Jedi character | `feature/jedi-character` | `Content/Characters/Jedi/` | `BP_JediPlayer` (+ optional ABP) | `Maps/Test_Jedi` |
| 3 | Actions | `feature/jedi-actions` | `Content/Anims/Jedi/`, `Content/Abilities/Jedi/` | `Source/PoF/AbilitySystem/GA_ForcePush,GA_SaberAttack,GA_Roll` (GA_Parry exists) | `Maps/Test_Actions` |
| 4 | Inventory | `feature/inventory` | `Content/Inventory/`, `Content/UI/Inventory/` | `Source/PoF/Inventory/*`, `Source/PoF/UI/*` | `Maps/Test_Inventory` |

Each stream's **acceptance is a frame or an observation**, captured by the harness — never a self-report.

### Stream 1 — Environment (ancient arena, sandy floor)
- **Deliver:** a lit `Arena_Ancient` map — sandy-floor material, ancient ruins/pillars/walls, warm key + cool sky (movable lights, **no Lightmass bake**), ExponentialHeightFog, an unbound PostProcess volume, a `PlayerStart`, and a navmesh.
- **Verify:** headless `-game /Game/Maps/Arena_Ancient -RenderOffScreen` → read a frame showing the lit sandy arena; optionally run the **VLM critique** on the frame for an aesthetic score.
- **Must-know (memory `project-starwars-duel-build`):** the **material-usage-flag gotcha** — a material missing `used_with_static_lighting`/`used_with_skeletal_mesh` renders flat grey; set the flags + recompile. The lit-arena recipe (`improve_arena_lighting.py`): movable directional+sky, low warm key (~2.2) for long shadows, `fog_inscattering_luminance`, `set_light_color` wants `LinearColor`, `auto_exposure_bias` −1.0, `save_current_level()`.
- **Depends on:** nothing — it's the foundation everyone integrates into.

### Stream 2 — Jedi character
- **Deliver:** `BP_JediPlayer` — Jedi appearance (robes/hood via materials or a swapped skeletal mesh on the Manny skeleton) + the **lightsaber** weapon (saber mesh on `hand_r`, glowing blade via `M_Saber_Blue`). Reuses `SKM_Manny` + `PA_VSPlayer`.
- **Verify:** headless capture → frame of the Jedi standing in `Test_Jedi` holding a lit saber. Eye/VLM check.
- **Must-know:** the saber attach (`WeaponMesh` → `WeaponAttachBone="hand_r"` + `WeaponGripOffset`; `M_Saber_Blue` needs the material usage flag or it greys out); the player mesh path `/MoverTests/.../SKM_Manny`; **don't edit `ARPGCharacterBase`** — configure via `BP_JediPlayer`.
- **Depends on:** Phase 0 (`BP_JediPlayer` stub). Actions + the integration map consume this.

### Stream 3 — Action animations (force push, saber attack, parry, roll)
- **Deliver:** believable animations for the 4 actions, wired as montages on the abilities. This is the stream that **most directly uses this conversation's pipeline**. Parry (`GA_Parry`), force push, and a melee/slash already exist as mechanics — the job is the **motion quality**.
- **The loop (docs `animation-capture-pipeline.md`):** `node shots/leo_video_gen.mjs --mode i2v` (Leonardo: GPT Image 2 → Hailuo 2.3 Fast) → `mha_capture.py` (MetaHuman markerless, `-AllowCommandletRendering`, `face_tracking=False`) → `mha_retarget.py` (IK rig + **op stack** → Manny) → harness `play_anim` render → `anim-critique.mjs --provider qwen` grade. **Verify motion numerically first** (bone-rotation range), then grade, then play the ability in-context and read a frame.
- **Must-know:** the 5 capture fixes; the `play_anim` scrub fix is already on `main`; gate on the numeric bone measurement, use the Qwen score as advisory; keep app↔UE ability catalog in lockstep.
- **Depends on:** Jedi character + saber for in-context shots (can author anims on plain Manny in parallel, integrate after).

### Stream 4 — Inventory (chest, potion, loot, display, use)
- **Deliver:** `AChest` (interactable, lootable), a **health-potion** item (data asset + a GAS heal effect), loot flow (open chest → items into a `UInventoryComponent`), an inventory **UI** (UMG) to display, and **use** (drink potion → Health restored).
- **Verify (observation-driven):** a headless scenario — spawn chest, player loots (observe `inventory.contains(potion)`), use potion (observe Health 50→100 via the GAS attribute the harness already reads). A frame showing the inventory UI open.
- **Must-know:** the **observation harness** reads GAS attributes (e.g. `Health`) directly — reuse it for the potion-heal proof; the app's **inventory module + item/loot catalog** + the **catalog acceptance ladder** (L0 data → L4 visual) for authoring the item; the `pof-mcp` layer can drive the catalog. Mostly **new files** → low conflict.
- **Depends on:** weakly on GAS (potion effect). Otherwise independent.

---

## Integration

- **Order:** Environment (foundation) → Jedi character → Actions (needs character) → Inventory (independent, can land anytime). Continuous small merges beat a big-bang integration.
- **Cadence:** each stream merges to `main` via PR when its private-map capture passes. Because content is disjoint and maps are private, merges are conflict-free except in the coordination zones (which Phase 0 minimized).
- **The integration map** (`Arena_Ancient`, owned by the integrator): drop `BP_JediPlayer` at the `PlayerStart`, confirm the 4 abilities fire, place a looted chest. Final acceptance = one headless run of the assembled slice → a frame showing the Jedi in the sandy arena, plus an observation log (an ability landed + a potion healed).
- **Build discipline:** any C++ change must build on 5.8 + pass a harness smoke-capture before merge (the project must stay green for the other streams).

## How each session bootstraps the shared knowledge
Sessions run in `kiro/pof` and inherit the **project memory** (same project scope) + `CLAUDE.md` + `docs/`. Each kickoff should have the session read: `docs/README.md`, `docs/animation-capture-pipeline.md` (Actions), the catalog docs (Inventory), and the memory entries `project-starwars-duel-build` (harness recipe + UE gotchas), `project-llm-ue-interface` (the Tiers-of-Truth verification law), `project-harness`, and `project-pipeline-data-contract` (Inventory). The headless recipes (build via bundled-dotnet UBT; `-game <map> -RenderOffScreen` capture; `-run=pythonscript`) live in `project-starwars-duel-build`.

## Risks
- **4 UE editors at once** is resource-heavy → stagger the editor/build steps if needed (authoring stays concurrent).
- **`ARPGCharacterBase` contention** → fully mitigated only if Phase 0 pre-stubs the hooks; otherwise serialize edits to it.
- **Ability-catalog drift** (Actions) → reseed after changes (`project-ability-catalog-sync`).
- **Silent grey assets** (Environment, Jedi) → the material-usage-flag check is mandatory before claiming a visual pass.

---

## Appendix — paste-ready kickoff prompts

Each goes into a fresh Claude Code CLI session started in `kiro/pof`. First set up the worktree: `git -C "<UE project>" worktree add ../PoF-<stream> -b feature/<stream> main`.

**① Environment**
> You are one of 4 parallel streams building a Jedi vertical slice. Your slice: an **ancient arena with a sandy floor**. Read `docs/parallel-development-plan.md` (you are Stream 1) + `docs/README.md`, and recall memory `project-starwars-duel-build` (lit-arena recipe + the material-usage-flag grey-fallback gotcha). Work ONLY in your UE worktree on branch `feature/env-arena`, owning `Content/Environments/AncientArena/` + the map `Content/Maps/Arena_Ancient.umap`. Do not touch any other Content or C++. Build a lit sandy arena with ancient ruins (movable lights, no Lightmass bake, height fog, post-process, a PlayerStart, navmesh). **Acceptance: a headless `-game /Game/Maps/Arena_Ancient -RenderOffScreen` capture that you READ and that shows the lit sandy arena** — no "done" without that frame. Verify material usage flags first (or it renders grey).

**② Jedi character**
> You are one of 4 parallel streams. Your slice: **make the player a Jedi**. Read `docs/parallel-development-plan.md` (Stream 2) + recall memory `project-starwars-duel-build` (saber attach: `hand_r` + `WeaponGripOffset` + `M_Saber_Blue`, material-usage-flag gotcha; player mesh `SKM_Manny`, `PA_VSPlayer`). Branch `feature/jedi-character`, own `Content/Characters/Jedi/` + `BP_JediPlayer` + map `Test_Jedi`. **Do NOT edit `ARPGCharacterBase`** — configure everything in `BP_JediPlayer`. Give the player Jedi robes/hood + a glowing lightsaber. **Acceptance: a headless capture you READ showing the Jedi holding a lit saber.**

**③ Action animations**
> You are one of 4 parallel streams. Your slice: believable **force push, lightsaber attack, parry, roll** animations. Read `docs/animation-capture-pipeline.md` end-to-end + `docs/parallel-development-plan.md` (Stream 3) + recall memory `project-animation-alternatives` (the Gemini-free pipeline) and `project-code-authored-animation`. Branch `feature/jedi-actions`, own `Content/Anims/Jedi/` + `Content/Abilities/Jedi/` + new ability files `GA_ForcePush/GA_SaberAttack/GA_Roll` (GA_Parry exists) + map `Test_Actions`. For each action run the loop: `leo_video_gen.mjs --mode i2v` → `mha_capture.py` → `mha_retarget.py` → harness `play_anim` render → `anim-critique.mjs --provider qwen`. **Gate on the numeric bone-rotation measurement; verify each anim with a READ frame in-context.** Keep the app↔UE ability catalog in lockstep.

**④ Inventory**
> You are one of 4 parallel streams. Your slice: a **chest holding a health potion — loot it, display the inventory, use the potion to heal**. Read `docs/parallel-development-plan.md` (Stream 4) + the catalog docs (`docs/catalog/`) + recall memory `project-pipeline-data-contract` (acceptance ladder) and `project-llm-ue-interface` (the observation harness reads GAS `Health`). Branch `feature/inventory`, own `Content/Inventory/`, `Content/UI/Inventory/`, `Source/PoF/Inventory/*`, `Source/PoF/UI/*` + map `Test_Inventory`. Build `AChest` + a potion item (data + GAS heal effect) + `UInventoryComponent` + a UMG inventory UI. **Acceptance: a headless scenario observation — loot the chest (inventory contains the potion), use it (Health 50→100 via the GAS attribute the harness reads), and a frame showing the inventory UI.**
