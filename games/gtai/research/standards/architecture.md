# GTAI: Uprising - Architecture and Codebase Standard (Godot 4.7.2)

Status: research draft, 2026-11-02. Scope: how the code is organised, communicates, is tested and shipped, for roughly two years of solo development with AI coding agents (Claude, Codex) writing most of it.

Evidence tags used on every rule and claim:
- **[V:Sn]** verified against source Sn in the Sources list (I fetched and read it, or its search summary quoted it).
- **[L]** measured by me in the local spike files (read-only), counts given.
- **[I]** inference or widely held practice that I could not confirm in a primary source in this pass. Treat as a hypothesis to check before it becomes a gate.
- **[4.7?]** version-sensitive: re-verify against Godot 4.7.2 / the pinned godot-cpp before relying on it.

Keyword meaning: MUST = a CI gate or review blocker; SHOULD = default, deviate with a written reason; MAY = optional.

Project owner conventions this standard inherits: files of 200 LOC or less, folders mirror the structure, camelCase-position naming is a PoF (web app) convention and is NOT carried over; GDScript uses snake_case per the Godot style guide [V:S6].

---

## 0. Summary of the standard (read this if nothing else)

1. One Godot project, feature folders, snake_case lowercase everywhere, `addons/` for third-party only.
2. Every GDScript file is statically typed, warnings are errors, files stay under 200 LOC (hard stop 300), functions under 40.
3. Nodes are for things that need the scene tree. Per-actor crowd data lives in packed arrays / structs, not in nodes. Rendering of crowds bypasses nodes (MultiMesh through the server).
4. A tiny autoload set (7 or fewer). Everything else is injected from one composition root, so every system can be built with fakes in a test.
5. Call down, signal up. A typed event bus is allowed for rare cross-feature domain events only. Nothing per-frame or per-actor goes through it.
6. Static balance data is typed `Resource` / typed tables, validated at load and in CI. Tool-generated data (PoF output) is JSON with a schema, validated at the boundary.
7. The hot simulation is native, thin binding over a plain-C++ core, with a permanent GDScript reference and an exact parity gate. One call per frame, packed arrays.
8. Simulation is fixed-step, seeded per system, and replayable. Godot physics is not trusted for determinism.
9. `.gitattributes` forces LF, `.uid` and `.import` are committed, `.godot/` is ignored, art/audio go through Git LFS, CI runs lint + tests + export on every push.
10. Frame-time, hitch and crash telemetry exist from the first playable, not at the end.

---

## 1. Rules

### 1.1 Project layout, naming, vendor policy

**R1.1 MUST** group by feature (scene + script + local art together), with a small `core/` of engine-agnostic infrastructure. Why: agents locate all code for one feature in one folder, and the official guidance is to keep assets "as close to scenes as possible". [V:S1]

**R1.2 MUST** use snake_case, lowercase, for every folder and file; PascalCase for node names and `class_name`. Why: Windows is case-insensitive but Godot's PCK and Linux are case-sensitive, so mixed case passes on the dev machine and breaks the export. [V:S1][V:S6]

**R1.3 MUST** keep third-party code only under `addons/`, each with an entry in `addons/VENDORS.md` (name, version, source URL, licence, date vendored, purpose). Why: the project guide puts third-party resources in a top-level `addons/` folder [V:S1]; the manifest is our own policy so agents never "just install a plugin" [I].

**R1.4 MUST** exclude test and dev-only addons from export (`exclude_filter="addons/gdUnit4/*,tests/*,tools/*"` in the export preset). Why: a preset with `export_filter="all_resources"` and an empty `exclude_filter` ships everything under `res://` [L: evolve `export_presets.cfg`]. [I]

**R1.5 MUST** keep generation sources, raw art, prompts and logs OUT of the Godot project root (repo-level `art_src/`, `tools/`), or hide them with an empty `.gdignore`. Why: `.gdignore` stops import and hides the folder, which also speeds first import. [V:S1] Local: `evolve/project/_chars` is 14 MB of tool data inside the project. [L]

**R1.6 SHOULD** keep each source file under 200 LOC (GDScript and scenes' scripts), with a CI hard stop at 300, functions under 40 LOC, at most 5 parameters. C++ translation units under 300 LOC. Why: agents edit reliably in small files; the style guide itself gives no file-size limit, so this is a project rule, not a Godot one. [V:S6 says no limit][I for the numbers]

**R1.7 SHOULD** name files for what they are, singular: `vehicle_body.gd`, `vehicle_config.gd`, `vehicle.tscn`. A script and its scene share a basename and a folder. Why: the style guide maps `class_name YAMLParser` to `yaml_parser.gd`. [V:S6]

**R1.8 MUST** keep one authoritative `AGENTS.md` (repo root) with the commands (`just lint`, `just test`, `just export`), the folder map, the rules in section 0, and a "copy this" template per file kind (feature script, state, resource, test). Why: agents follow concrete templates better than prose. [I]

### 1.2 Scenes, nodes, resources, servers

**R2.1 MUST** compose with scenes and child nodes, not deep inheritance. Maximum one level of script inheritance (a shared base such as `Actor`), no inheritance across features. Why: scenes should have "no dependencies" where possible and be self-contained [V:S2]; inheritance chains are hard for agents to reason about [I].

**R2.2 MUST** pick the lightest type that does the job: `RefCounted` for behaviour objects and data classes, `Resource` when it needs the Inspector or file persistence, `Node` only when it needs the tree (transform, process callbacks, signals to children). Why: the docs rank Object < RefCounted < Resource < Node by weight and note nodes cost more as they grow more complex. [V:S3]

**R2.3 MUST** keep crowd-scale actors (pedestrians, ambient cars, projectiles, particles) out of the scene tree: struct-of-arrays state, drawn through one MultiMesh per layer. Why: our own gate measured MultiMesh beating per-actor RenderingServer canvas items (riot, ~300 visible: 0.83 vs 1.14 ms avg, p99 3.0 vs 5.6 ms) and native draw writes at ~0.013 ms. [L: cityscale/GATE.md] The docs reserve direct server use for "tens of thousands of instances" after other optimisations. [V:S11]

**R2.4 MUST** treat RIDs as manually managed: every `RenderingServer.*_create()` has an owner that frees it, and the Resource backing an RID is kept referenced. Pool canvas items instead of free-and-recreate. Why: RID references are not counted [V:S11]; pooling cut our worst chunk-swap frame from 6.1 to 1.8 ms. [L]

**R2.5 MUST NOT** read values back from servers per frame, and MUST NOT drive RIDs owned by a node. Why: server calls run asynchronously and a returning call stalls them. [V:S11]

**R2.6 SHOULD** hero entities (player, boss, mission NPCs, police that are close) be nodes (scene per entity); everything beyond an activity bubble is data. Promote/demote between the two representations through one `ActorPromotion` seam. Why: matches the tiered bubble already proven in the spike (Tier A full sim, Tier B lane-follow only, beyond despawn) and the `rigged[]` promotion of 16 rigs. [L] [I for the seam name]

**R2.7 SHOULD** build static, regular structure (city chunks, parts rigs) in code from data, and hand-author in the editor only what a designer must tweak visually. Why: generated `.tscn` is large and merge-hostile; code-built nodes need no scene diffs. [I]

**R2.8 MAY** use `@abstract` (GDScript abstract classes, present in the stable style guide) for base classes. [V:S6][4.7?] Do not adopt until gdtoolkit parses it (see R7.7). [I]

### 1.3 Global state, singletons, injection

**R3.1 MUST** limit autoloads to a fixed list of at most 7: `Log`, `LaunchArgs`, `Events` (typed bus), `Game` (boot and composition root handle), `Data` (read-only tables after load), `SaveService`, `DebugTools` (dev builds only). Adding an eighth needs a written reason in `docs/decisions.md`. Why: the project guide says systems that track their own data and need global access are autoload candidates, but systems that modify other systems' data stay ordinary scripts or scenes. [V:S2] The numeric cap is ours. [I]

**R3.2 MUST** give every system a `setup(ctx: WorldContext)` method (or constructor args) and receive its dependencies (rng streams, clock, data tables, event bus, services) from a single composition root (`world.gd`). Features MUST NOT reach up the tree or into `/root/...` by string. Why: the parent provides what the child needs, and the child never needs to know where it sits. [V:S2] This is what lets a test build one system with fakes. [I]

**R3.3 MUST** make `WorldContext` a plain `RefCounted` holding typed references (no Dictionary of services). Why: typed fields give autocomplete and static-typing errors to agents; a string-keyed service locator defeats both. [I]

**R3.4 MUST** give every autoload with mutable state a `reset()` (called by tests and by "new game"). Why: autoloads outlive scenes; tests that share them leak state between cases. [I]

**R3.5 SHOULD** treat a service locator as a smell inside features; if one exists, it is only the `WorldContext`. Why: hidden global lookups make agent-written code untestable. [I]

**R3.6 MUST NOT** put per-frame gameplay state in autoloads. Why: a global that every actor reads is an unobserved coupling and a determinism hazard (see R9). [I]

### 1.4 Communication

**R4.1 MUST** follow call-down, signal-up: parents set properties, call methods and connect signals on children; children report with signals and never reference parents or siblings. Siblings are coordinated by their common ancestor. Why: the scene-organisation guide states that siblings "should only be aware of their own hierarchies" while an ancestor mediates, and that signals are "extremely safe, but should be used only to 'respond'". [V:S2]

**R4.2 MUST** declare signals with typed parameters and past-tense names (`vehicle_destroyed(vehicle_id: int, cause: int)`). Why: the style guide mandates past tense [V:S6]; typed params let the analyser catch mismatches. [I for typed-params benefit]

**R4.3 SHOULD** avoid bubbling a signal through more than one re-emit; beyond two or three hops, use the bus or a direct injected reference. Why: bubbled signals need three or four files opened to follow. [V:S23]

**R4.4 MAY** use one `Events` autoload with typed signals for low-frequency cross-feature domain events (mission started, wanted level changed, district entered, player died). Cap at about 30 signals, each documented with its emitter. The bus holds no state ("a post office, not a warehouse") and in debug builds logs every emit to a ring buffer. Why: GDQuest offers an Events singleton as the answer to long signal chains but sends readers to a separate pattern guide for trade-offs [V:S23]; "global buses are hard to trace" is our inference [I].

**R4.5 MUST NOT** route per-frame or per-actor data through any signal or bus (positions, damage ticks, AI percepts). Use packed arrays, polling of an injected data object, or the native sim's counters. Why: disconnected signal emission is cheap but not free and the trace becomes useless [V:S23 says "barely costs more than a function call"]; the real reason is traceability and determinism [I].

**R4.6 MUST** disconnect or scope any lambda connected to a longer-lived emitter. Why: lambdas capturing nodes can keep references alive past `free()`. [I, reported in third-party skill pages, not primary]

**R4.7 SHOULD** record every domain event with its tick number into the replay log (R9.6). Why: event streams are the cheapest scenario assertions ("mission_started then mission_failed within 600 ticks"). [I]

### 1.5 Data-driven design

**R5.1 MUST** author static game data (weapons, vehicles, wanted-level thresholds, economy, mission parameters) as typed data, never as literals scattered in logic. One source per number. Why: registry law "one authority per quantity" and the pinned-rules-data technique; our own constants (`CAP`, `HW`, headings) are duplicated between `sim_gd.gd` and `city_sim.h`. [V:S30][L]

**R5.2 SHOULD** use custom `Resource` classes (`class_name VehicleConfig extends Resource`, `@export` typed fields with defaults, stored as text `.tres`) for designer-tuned data edited in the Inspector. Why: defined properties mean the data is guaranteed to exist; Inspector support; identical loads return the same shared instance. [V:S29, search summary of the official docs page]

**R5.3 MUST** give every Resource class a `validate() -> PackedStringArray` (ranges, non-empty ids, cross-references) and a CI "data lint" that loads every data file and fails on any message. Also validate at game boot in debug. Why: Resources guarantee shape but not value ranges; validation is ours to write. [V:S29 says shape only][I]

**R5.4 SHOULD** use JSON (with a JSON Schema checked by a tool in CI) for data produced by PoF/AI pipelines and consumed by tools outside Godot: quest packages (`gtai.quest/1`), canon, entity catalogs, art part manifests. A typed loader converts JSON into typed `RefCounted`/`Resource` objects once at boot and returns an error list, never a half-built object. Why: JSON is plain text other tools read; Resources keep Godot types and load in one call. [V:S29] The PoF wire contract is already JSON. [L: `games/gtai/quest`]

**R5.5 MUST NOT** `load()` any file a player or an external tool could have edited as a `.tres`/`.res`. Saves are JSON or `bytes_to_var` without objects. Why: a resource file can embed a script, so loading a stranger's file runs code. [V:S29]

**R5.6 MUST** version every persisted format (`"schema": N`) with a migration function per step; saves written by build N load in N+1. Why: two years of development will change the schema many times. [I]

**R5.7 SHOULD** use enums (ints) in code and strings only at the data boundary. Why: integer compares are constant-time, string compares are linear. [V:S4]

**R5.8 SHOULD** keep hot actor data as `PackedFloat32Array` / `PackedInt32Array` structs-of-arrays, and cold per-actor data (names, dialogue) as typed Resources keyed by id. Why: arrays iterate fastest; Dictionary and Object lookups cost more. [V:S4]

### 1.6 State machines and AI

**R6.1 MUST** pick the AI shape by actor count and importance:
- Crowd (hundreds): flat integer-mode FSM inside the native sim, one `mode[]` byte per actor (as the prototype's `M_WALK/M_FLEE/M_DEAD/M_RIOT`). [L]
- Named / close actors (police squads, bosses, mission NPCs, tens): a GDScript hierarchical state machine of `RefCounted` `State` objects with `enter(ctx)`, `update(ctx, dt)`, `exit(ctx)`.
- Bosses and scripted set-pieces: HFSM phases driven by data, no behaviour-tree addon.
Why: simplest model that fits the scale; the prototype's `ped.gd` (118 LOC) and `car.gd` (184 LOC) are flat; `main.gd:_ai` is a 137-line function. [L][I for the tiering]

**R6.2 SHOULD** introduce utility scoring or a behaviour tree only when an HFSM exceeds roughly 8 states per level or transition code starts duplicating. Any such addon (for example LimboAI, Beehave) passes R1.3 and a perf test at 100 actors first. [I]

**R6.3 MUST** time-slice AI "thinking" (each actor thinks every N ticks, staggered by `id % N`), with the sensing → deciding → applying phases separated and structural changes (spawn, despawn) deferred to a drain after the loop. Why: order-independent results and no iterator invalidation. [V:S31]

**R6.4 MUST** make every transition table data (enum pairs in one dictionary or `Resource`) and unit-test it for unreachable states and missing transitions. [I]

### 1.7 GDScript discipline

**R7.1 MUST** statically type everything: variables, parameters, returns, typed `Array[T]` and typed `Dictionary[K, V]` (since 4.4). Why: typed code gets optimised opcodes [V:S5]; typed dictionaries shipped in 4.4 [V:S27]. Nested typed collections are not supported, so wrap them in a small class. [V:S5]

**R7.2 MUST** set these in `project.godot` under `[debug]` (values: 0 ignore, 1 warn, 2 error [I]): `untyped_declaration`, `unsafe_property_access`, `unsafe_method_access`, `unsafe_cast`, `unsafe_call_argument`, `inference_on_variant`, `return_value_discarded`, `unused_variable`, `unused_parameter`, `shadowed_variable` to **error** for `core/` and `features/`. `exclude_addons` stays true. Why: warnings are off by default [V:S5]; enabling UNTYPED_DECLARATION is the documented way to "always use static types" [V:S5]; any warning can be made an error [V:S7]. Exact setting names: verify in the editor's Project Settings → GDScript. [4.7?]

**R7.3 SHOULD** use `:=` only where the right side's type is obvious (constructors, literals); write the type explicitly when the source is a `Variant` (`Dictionary.get`, `load()`, `get_node()`, JSON). Why: inference on Variant silently yields Variant. [I, consistent with V:S5]

**R7.4 MUST** use `class_name` for any script that appears as a type in another file (data classes, states, services, events payloads); do NOT add it to scene-root scripts nobody types against. Do not use `const X := preload("...")` aliases except to break cyclic references. Why: global classes give typed signatures and avoid path strings; each `class_name` joins a global namespace that agents must not collide in. [I]

**R7.5 MUST** follow the style guide: tabs, LF, UTF-8, lines under 100 characters, code order (signals, enums, constants, exports, vars, onready, `_init`, callbacks, public, private, inner classes), `_private` prefix. [V:S6]

**R7.6 MUST** run `gdformat --check` and `gdlint` in CI and pre-commit (`gdformat` has only line-length as a setting). [V:S20]

**R7.7 MUST** pin gdtoolkit and prove it parses the newest syntax we use with a canary file in CI; until proven, do not use syntax gdtoolkit cannot parse. Why: I could not confirm a gdtoolkit release that supports Godot 4.5+ syntax (`@abstract`, new annotations) in this pass; formatting "may lead to data loss" per its own README. [V:S20][I][4.7?]

**R7.8 SHOULD** avoid in hot paths: `get_node`/`$` per frame (cache in `@onready`), `Dictionary` per actor, string building, `await`, capturing lambdas, `Object` property lookups; turn off processing (`set_process(false)`) on idle nodes; one manager `_physics_process` iterates arrays instead of thousands of node callbacks. Why: object property lookup is linear in inheritance depth [V:S4]; the rest is standard practice. [I]

**R7.9 SHOULD** keep a `.editorconfig` and `gdlintrc` in the repo (line length 100, max-file-lines 300, function-arguments 5). [I; verify rule names in gdlint]

### 1.8 The GDExtension boundary

**R8.1 MUST** limit native code to what measurement proved: the activity-bubble simulation (spatial hash, steering, lane following, collision, projectile step) and the render-buffer writer. Everything that is rules, content, UI, missions, or called rarely stays in GDScript. Why: our gate shows GDScript riot sim 4.56 ms (max 13.4) vs native 0.093 ms (~49x); GDScript-only riot frames fail the 7 ms gate, native passes. [L: GATE.md]

**R8.2 MUST** keep the API coarse: one `step()` and one `write_render()` per frame, bulk state in `Packed*Array`, a handful of setters, counters returned as one array. Per-actor calls (`get_actor(i)`, 10-arg `spawn`) only for events that are rare by design (a spawn, a promotion). Why: every bound call crosses the Variant boundary [I]; the spike's design already follows this. [L]

**R8.3 SHOULD** split native code into a plain C++ core (no `godot::` types, built and unit-tested standalone with a C++ test runner and sanitizers) and a thin binding file that converts packed arrays to spans. Why: lets agents test and debug the algorithm without launching Godot; `city_sim.h` currently mixes `PackedByteArray`/`RID` into the sim class. [L][I]

**R8.4 MUST** pin godot-cpp as a git submodule at a tag or commit recorded in `native/GODOT_CPP_VERSION`, and build against `api_version=4.7`. Why: extensions built for an earlier Godot minor load in later minors, not the reverse; godot-cpp 10.x+ is versioned independently of Godot and selects the API via `api_version`. [V:S15][V:S16] The prototype uses an untracked, git-ignored `native/godot-cpp/` checkout of `master` (commit e103d38). [L]

**R8.5 SHOULD** keep SCons (the documented path, same prerequisites as Godot) as the single build system; godot-cpp also ships CMake, so move only if IDE/CI integration demands it, and never keep both. [V:S15][V:S16 CMake present]

**R8.6 MUST** build and keep both `template_debug` and `template_release` in CI, plus a debug build with AddressSanitizer/UBSan on a Linux job that runs the parity test. [I]

**R8.7 SHOULD** set `reloadable = true` for dev only if it proves stable; hot reload works only for debug builds [V:S15], reported flaky on Windows because the editor locks the DLL, and restricted when classes change [I: forum/issue reports]. Plan the dev loop around headless tests and restarts, not hot reload. [4.7?]

**R8.8 MUST** declare per-platform libraries in the `.gdextension` file (windows debug/release, and linux if a native Linux build is chosen); export includes only the matching library. [V:S15] Currently Windows only. [L]

**R8.9 MUST** keep a GDScript reference implementation of the native sim permanently and a parity gate: same chunks, same seeds, fixed dt, full state snapshots compared at N checkpoints with an exact (or declared-tolerance) match, plus a planted-mutation check proving the test can fail, and a divergence log when the two disagree (who was right). Why: registry cross-runtime conformance; the spike's parity test already compared 40 snapshots over 1200 steps bit-identically. [V:S30 technique names][L: evidence/parity.json]

**R8.10 MUST** restrict sim arithmetic to operations that round identically in both runtimes (+, -, *, /, sqrt, floor on doubles, integer LCG, headings from integer vectors) and compile the sim translation unit with floating-point contraction off (`/fp:strict` or `-ffp-contract=off`). Why: GDScript and MSVC rounded the same decimal literal differently; a fused multiply-add moves results by one ulp. [L: GATE.md][V:S30][I for the flags]

**R8.11 MUST** generate shared constants (capacity, grid sizes, enum values) from one source into both the `.gd` and the `.h`. [V:S30 "pinned rules data"][L: duplicated]

**R8.12 MUST NOT** touch the scene tree or Godot objects from a native worker thread; native writes to servers happen on the main thread. [V:S10]

### 1.9 Threading, determinism, fixed step

**R9.1 MUST** run the simulation on a fixed tick (`_physics_process` at `physics/common/physics_ticks_per_second`, default 60, or an explicit accumulator) and never from `_process` with variable delta. Cap catch-up steps per frame. Why: ticks keep rate fixed [V:S14]; `_process` has no timing guarantee. [V:S24 via jam thread] The cityscale bench clamps dt to at least 1 ms per frame, i.e. variable-step, so its runs are not replayable. [L: GATE.md]

**R9.2 MUST** use one explicit `RandomNumberGenerator` per system, seeded from a master seed plus the system name; ban global `randf()/randi()/seed()` in gameplay. Why: replayability and per-system independence (adding a spawn must not shift AI dice). [I] The prototype seeds `rng` only in scripted modes (wall-clock otherwise) and calls global `seed(7)`; main.gd has ~32 `randf/randi/RandomNumberGenerator` references. [L]

**R9.3 MUST NOT** rely on Godot's built-in physics for outcomes that tests assert or replays reproduce. Why: it uses floating point extensively and is not deterministic across platforms. [V:S24] Use the custom sim and integer or exactly-rounded arithmetic.

**R9.4 MUST** declare the determinism contract in writing: (a) same build + same inputs + same seeds = identical state hash every run (MUST); (b) across machines/CPUs bit-identical (SHOULD, for the native sim only, thanks to R8.10); (c) never for Godot physics or rendering. [I]

**R9.5 SHOULD** use `WorkerThreadPool` only for data-only work (chunk preparation, PNG encoding, path queries), merge results in submission order (not completion order), and apply them on the main thread at a frame boundary, one chunk activation per frame. Why: scene-tree interaction is not thread-safe, `call_deferred` is the bridge, AStar objects are not thread-safe, containers resizing need a mutex. [V:S10][V:S31]

**R9.6 MUST** support deterministic replay: record master seed, build hash, and the per-tick input log; `--replay <file>` re-runs headless with `--fixed-fps` and compares the final state hash and an event timeline. `--fixed-fps` disables real-time sync. [V:S13][I for design]

**R9.7 SHOULD** for rendering smoothness, write previous and current transform to the MultiMesh buffer and interpolate in the shader/writer, or use engine physics interpolation for node-based hero actors. The engine feature is optional and off by default and adds visible latency; exceptions apply to fast-input games. [V:S14] Whether the player car and on-foot character should use it is an open question.

### 1.10 Version control

**R10.1 MUST** commit a `.gitattributes` with `* text=auto eol=lf` and explicit `eol=lf` for `*.gd *.tscn *.tres *.import *.uid *.gdshader *.cfg *.json *.godot *.gdextension *.md`, and LFS rules for binary assets. Godot can generate it (Project → Version Control → Generate Version Control Metadata) and the generated one enforces LF. [V:S9] The local evolve repo has `core.autocrlf=true`, no `.gitattributes`, and 386 tracked `.import` files (of 955), which is the source of the observed CRLF churn. [L]

**R10.2 MUST** document `git config core.autocrlf input` (or false) for contributors; agents' worktrees too. [V:S9]

**R10.3 MUST** commit `.uid` files with their source and move them together when moving a script/shader outside the editor; after the 4.4 conversion re-save all scenes once. Why: without them, UID references break on another machine and Godot falls back to paths with a warning per file. [V:S8]

**R10.4 MUST** commit `.import` files (they hold the UID and import settings) and ignore `.godot/`, `*.translation`, `export_credentials.cfg`, build outputs, native `bin/`, `.sconsign.dblite`, `*.obj`. [V:S9][V:S8]

**R10.5 MUST** keep scenes and resources in text formats (`.tscn`, `.tres`), never `.scn`/`.res`, for authored data. Why: text diffs and merges; Godot "aims to be VCS-friendly". [V:S9]

**R10.6 SHOULD** keep each `.tscn` small (about 50 authored nodes or less) so two sessions rarely edit the same file; when a `.tscn` merge conflicts heavily, redo one side in the editor rather than hand-merging. [I; V: community report in search result]

**R10.7 MUST** configure Git LFS before the first commit that contains art/audio; retrofitting needs `git lfs migrate` or a fresh repository. LFS-track png, jpg, webp, psd, wav, ogg, mp3, glb, fbx, ttf. [V:S9]

**R10.8 SHOULD** commit generator inputs (prompts, parts manifests, scripts) and a reproducibility hash for generated art; commit the imported final sprites, not intermediate sheets or logs. Why: 57 MB assets and 14 MB `_chars` already in the evolve project. [L][I]

**R10.9 MUST** follow the fleet rules in `CLAUDE.md` for the shared checkout: stage per path, no stash, no hard reset. [L: pof CLAUDE.md]

### 1.11 Testing

**R11.1 MUST** have four layers, all runnable headless from one command and all in CI:
1. unit tests (pure logic: formulas, state machines, validators, data loaders);
2. headless integration (instantiate a scene or system with fakes, step N ticks);
3. scenario / replay tests (scripted or recorded inputs, assert event timeline + state hash);
4. parity tests (native vs GDScript reference, R8.9).
Plus a small golden-image layer (R11.5) that needs rendering. [I]

**R11.2 SHOULD** use gdUnit4 for layers 1-2: it has a scene runner (simulated input, wait for signals), mocks/spies, parameterised tests, CLI, JUnit and HTML reports, and a GitHub Action. GUT 9.7.1 (targets 4.7.x) is the credible alternative. Pick one; do not mix. [V:S17][V:S19]

**R11.3 MUST** pin the test framework to a release verified against 4.7.2. The gdUnit4 table lists v6.2.x for 4.5-4.7.1 and master (v7.0.0) for 4.7/4.7.1/4.8-dev; 4.7.2 is not listed. Headless mode in its CI action requires v7+; v6 exits with code 103 in headless unless forced. [V:S17][V:S18][4.7?]

**R11.4 MUST** make scenario and parity runners plain `SceneTree` scripts (`godot --headless --path project --script res://tests/run_scenarios.gd -- args`) that return a non-zero process exit code on failure. The spike's `bench/parity.gd` is already this shape. [V:S13][L]

**R11.5 SHOULD** golden-image tests capture `get_viewport().get_texture().get_image()` after `RenderingServer.frame_post_draw` (the prototype already does), compare with a per-pixel threshold plus a percent-differing budget, store goldens in LFS, and run in a separate non-headless job because headless does not render. [V:S18 says headless does not render][L: main.gd awaits `frame_post_draw`][I]

**R11.6 MUST** CI jobs on every push: (1) lint: `gdformat --check`, `gdlint`, file-size gate, data lint; (2) import: `godot --headless --import` then a "load everything" script that `load()`s every `.gd/.tscn/.tres` and fails on error (the class-name cache lives in `.godot/` so a fresh clone must import first [I]); (3) tests (gdUnit4 + scenarios + parity); (4) native build matrix debug/release (+ sanitizer on Linux); (5) export Windows (and Linux if chosen) with committed `export_presets.cfg`. [V:S13 `--headless`, `--import`, `--check-only`][V:S28 presets must be committed]

**R11.7 SHOULD** run CI on both `windows-latest` and `ubuntu-latest`: Windows is the shipping and MSVC-parity target, Linux is fast and cheap for most jobs. [I]

**R11.8 MUST** unknown command-line args are silently ignored by the engine, so every test runner validates its own args and fails on an unknown one. [V:S13]

**R11.9 SHOULD** include planted-mutation checks for the suites that guard simulation (change a constant, expect the parity or scenario test to fail). [V:S30]

### 1.12 Debugging, logging, crash reporting, overlays

**R12.1 MUST** use one `Log` autoload (levels, categories, ring buffer, file sink under `user://logs/`, flush on exit, stdout in dev); no bare `print()` in committed code (lint rule). `push_error` / `push_warning` are routed through it. [I]

**R12.2 MUST** ship a debug overlay from the first playable (dev builds only, feature-tag gated): frame time (avg, p99, max), a hitch log for frames over 25 ms with the active streaming/native counters, actor counts per tier, draw calls, native step ms, RNG/tick counter, last 50 events. Register custom monitors with `Performance.add_custom_monitor`. [I] Why: the gate recorded unexplained whole-process stalls of 165 to 440 ms whose root cause was never found; they must be measurable per run. [L: GATE.md]

**R12.3 MUST** integrate crash reporting before any external playtest. Sentry's Godot SDK is a GDExtension on top of sentry-native: Windows/Linux minidumps for native crashes, automatic script and shader error capture, GDScript stack traces. 1.x/2.x need Godot 4.5+. [V:S21][V:S22] It does not mention Proton behaviour. [V:S21] Test a forced native crash under Proton on a Steam Deck before trusting it. [I]

**R12.4 MUST** produce symbols: official export templates have no debug info, so native-crash stack traces need our own template build with symbols (or our GDExtension PDBs) uploaded to Sentry; archive the PDBs for every shipped build. [V:S22]

**R12.5 MUST** scrub before send (`before_send` callback needs programmatic init, auto-init off) and gate telemetry behind explicit in-game consent; the SDK pages do not describe consent, so that is ours. [V:S22][I for the consent need]

**R12.6 SHOULD** make every bug reproducible by a seed plus input log (R9.6): the crash reporter attaches the replay file of the last N seconds. [I]

### 1.13 Export, build profiles, feature tags

**R13.1 MUST** commit `export_presets.cfg`; keep secrets out of it (4.1+ moved credentials to a separate ignored file; 3.x/4.0 could store them in it). [V:S9][V:S28]

**R13.2 MUST** gate all dev-only code (autoplay bots, test hooks, debug overlay, cheat commands, `--stress`) behind `OS.has_feature("debug")` or a custom `devtools` tag, and exclude the files from release export. Custom tags exist only in exported projects, not in the editor, so also check `OS.is_debug_build()`. Why: `main.gd` currently contains the test harness inline. [V:S12][L]

**R13.3 SHOULD** use project-setting overrides by tag (`setting.debug`, `setting.release`) for log level, vsync, telemetry defaults; read them with `ProjectSettings.get_setting_with_override`. [V:S12]

**R13.4 SHOULD** define presets: `windows-dev` (debug template, symbols, dev tags), `windows-steam` (release template), `linux-steam` (optional). `embed_pck=true` is fine for Steam depots but compare patch sizes. [L: preset][I]

**R13.5 SHOULD** use the `shader_baker` export option / feature tag to remove shader-compile hitches in exported builds, and prewarm materials in a loading step. [V:S12 lists the tag; details I][4.7?]

**R13.6 MAY** build custom export templates with an engine build profile (compile out unused classes) once the game's class list is stable; it also gives a symbol-bearing template (R12.4). [I]

**R13.7 MUST** verify the Steam path early: GodotSteam ships as a GDExtension (module and GDExtension code merged in the 4.22/4.11 line); the overlay works in exports not the editor; Windows exports are expected to run under Proton on Steam Deck. [V:S33][V:S32] Test an exported build on a Deck-class device each milestone.

### 1.14 What a principal Godot developer would add

**R14.1 MUST** use only InputMap actions (never raw keys) and test gamepad-only play; Steam Deck is a first-class target. [I]
**R14.2 MUST** route all user-facing strings through `TranslationServer` keys from day one even if only English ships (cheap now, expensive later). [I]
**R14.3 SHOULD** load streamed content with `ResourceLoader.load_threaded_request` and never block the main thread on `load_threaded_get`; one activation per frame under a time budget (1.5 ms in the prototype). [V:S32][L]
**R14.4 SHOULD** keep a decision log (`docs/decisions.md`, one line per decision with date) so agents do not re-litigate settled choices. [I]
**R14.5 SHOULD** pin engine, godot-cpp, gdUnit4, gdtoolkit, Sentry SDK versions in one `versions.toml` read by CI and `AGENTS.md`; upgrade engine patch releases deliberately (4.7.2 now), re-running the full suite. [I]
**R14.6 MUST** treat the version-sensitive items flagged [4.7?] as a checklist to re-verify at every engine bump.

---

## 2. Recommended layout

One repo for the game; the Godot project is a subfolder so native, tools and docs sit beside it. [I]

```
gtai/
  AGENTS.md                  # commands, folder map, rules summary, templates to copy
  .gitattributes  .gitignore  .editorconfig  gdlintrc  justfile  versions.toml
  docs/  decisions.md  determinism.md  data-contracts.md  architecture.md
  art_src/                   # generator inputs, prompts, raw sheets (NOT in project/)
  tools/                     # python/node/gd tools: data lint, schema check, new_feature scaffold
  native/
    GODOT_CPP_VERSION        # tag/commit of the submodule
    godot-cpp/               # git submodule
    sim_core/                # plain C++ (no godot types) + its own tests
      src/ (peds.cpp cars.cpp hash.cpp projectiles.cpp render_pack.cpp ...)  # each < 300 LOC
      tests/
    binding/ register_types.cpp city_sim_binding.cpp
    SConstruct
  project/                   # the Godot project root (res://)
    project.godot  export_presets.cfg  .gdignore-able dirs marked
    addons/                  # third-party only: gdUnit4/ godotsteam/ sentry/ (+ VENDORS.md)
    native/                  # gtai_sim.gdextension + bin/ (binaries ignored)
    boot/                    # main.tscn, boot.gd, world.gd (composition root), launch_args.gd
    core/                    # engine-agnostic infra, each < 200 LOC
      log/ rng/ clock/ events/ data/ save/ replay/ debug/ math/
    features/                # one folder per feature
      city/        (chunk_streamer.gd chunk_loader.gd lane_graph.gd city_gen/ ...)
      crowd/       (crowd_sim_bridge.gd crowd_render.gd promotion.gd)
      vehicles/    (vehicle.tscn vehicle.gd vehicle_config.gd handling/ damage/)
      characters/  (player/ ped_rig/ rig_parts.gd cutout_rig.gd)
      combat/      (weapons/ hit_resolver.gd projectile_bridge.gd)
      police/      (wanted.gd squad_fsm/ response_director.gd)
      missions/    (quest_runtime/ objectives/ quest_loader.gd)
      economy/ audio/ hud/ fx/ camera/ input/ menus/
    data/                    # authored tables and PoF-generated JSON
      tables/ (weapons/*.tres vehicles/*.tres wanted_levels.tres ...)
      generated/ (quests/*.json canon.json)   # from PoF, schema-checked
      schemas/
    assets/                  # shared art/audio only; feature-local art lives in features/*/art/
      atlases/ audio/ fonts/ shaders/
    tests/
      unit/  integration/  scenarios/  parity/  golden/ (images in LFS)
      support/ (fakes, builders, runners)
    dev/                     # dev-only (feature-tag gated, excluded from release export)
      bots/ cheats/ overlays/
```

Notes: `features/*` depend on `core/` and on `WorldContext` only, never on each other's internals; cross-feature talk is through injected interfaces or `Events`. Autoloads are registered from `boot/` and `core/` only.

---

## 3. Gaps against our prototype

Measured read-only on `C:\Users\kazda\kiro\gtai-spike\evolve\project` (E) and `...\cityscale` (C), 2026-11-02.

| # | Prototype fact [L] | Standard | Severity | Fix |
|---|---|---|---|---|
| G1 | `E/game/main.gd` is **4,267 lines**, 139 functions, longest `_ready` 217 lines, `_process` 160, `_ai` 137, `_mission_step` 136, `draw_hud` 118. Whole game is 7,201 lines in 10 files; main.gd is 59% | R1.6 (200 LOC, funcs under 40) | Critical | Split into about 25 feature files; `main.gd` becomes `world.gd` composition root under 150 LOC |
| G2 | Test and dev harness lives inside `main.gd` (`_selftest_step`, `_finish_stress`, `_autodrive_step`, `_soultest_step`, `_padtest_step`, `_weapontest_step`, `_movetest_step`, `_animtest_step`, `_fxstress_step`, ...; about 20 `OS.get_cmdline_user_args` hits) | R13.2, R11.1 | High | Move to `tests/scenarios/` + `dev/bots/`, behind feature tags, driven by `LaunchArgs` |
| G3 | **Zero** `signal` declarations in all 10 game files; coupling is direct calls on one big object | R4.1-R4.4 | High | Typed signals per feature, small `Events` bus; injected `WorldContext` |
| G4 | No `[autoload]`, no `[debug]` warning settings, no `gdlintrc`, no test framework, no CI in either project (only `bench/parity.gd`) | R3.1, R7.2, R7.6, R11.2, R11.6 | High | Add per section 2; warnings to error in `features/` and `core/` first |
| G5 | Typing is mostly good in `main.gd` (about 725 typed or `:=` declarations vs 7 untyped `var x =` by grep) but nothing enforces it; `class_name` missing on `main.gd` and `district.gd`; modules aliased with `const District := preload(...)` | R7.1, R7.4 | Medium | Keep the habit, turn the gate on |
| G6 | Other oversized files: `sim_gd.gd` 849, `robot.gd` 746, `cutrig.gd` 617, `arsenal.gd` 551, `bench.gd` 351 | R1.6 | High | Split by subsystem (reference sim into peds/cars/hash/projectiles to mirror native core) |
| G7 | `chardefs.gd` (146) is byte-identical in E and C; `cutrig.gd` (617) exists in both and has diverged | R1.1, R5.1 | Medium | One shared `features/characters/` module in the real project; delete copies |
| G8 | Native: single `city_sim.cpp` **851 LOC** + 100-line header with `godot::` types inside the sim class; `CAP/PCAP/W/TW/HW` duplicated in `sim_gd.gd` and `city_sim.h`; fixed-capacity arrays | R8.3, R8.11, R1.6 | High | Plain-C++ core + binding, generated constants, split TUs |
| G9 | godot-cpp is an untracked, git-ignored checkout of `master` (commit e103d38, 2026-10-30); `SConstruct` is 7 lines with no config; `.gdextension` has only `windows.debug/release`; `reloadable=false`; no sanitizer or Linux build | R8.4-R8.8 | High | Submodule + `GODOT_CPP_VERSION`; debug/release/ASan matrix in CI |
| G10 | Positive: GDScript reference + native port with exact parity (40 snapshots, 1200 steps, bit-identical) and a frame-budget evidence set; MultiMesh writer; item pooling measured | R8.9, R2.3, R2.4 | Keep | Promote the parity gate to CI; add planted mutation; keep reference forever |
| G11 | Determinism: `rng` seeded with wall clock outside scripted modes; global `seed(7)` plus global `randf` (about 32 RNG references in `main.gd`); bench uses variable per-frame dt (clamped at 1 ms) | R9.1, R9.2, R9.6 | High | Fixed tick, per-system RNG, replay log |
| G12 | No `.gitattributes` in either repo; `core.autocrlf=true` in E; 386 of 955 tracked files are `.import`; 17 `.uid`; nested repos inside a parent repo rooted at `C:/Users/kazda/kiro` | R10.1-R10.4 | High (the churn already seen) | Add `.gitattributes`, `autocrlf=input`, renormalise once (`git add --renormalize`, one dedicated commit) |
| G13 | Export preset: `export_filter="all_resources"`, empty `exclude_filter`, so `_chars/` (14 MB of tool data) and any test code ship | R1.4, R1.5 | Medium | Move tool data out of the project or `.gdignore`; exclude filter |
| G14 | Unexplained 165 to 440 ms whole-process stalls and a 170.8 ms swap frame in the first gate batch; root cause "not identified" | R12.2, R13.5 | High | Hitch recorder in every run; shader baker; track as a standing risk |
| G15 | ~70 JSON asset descriptors under `E/assets`; only 2 `JSON.parse` sites in `main.gd`; no schema or validation seen | R5.3, R5.4 | Medium | Schema + typed loader returning an error list; data-lint job |
| G16 | Native API is mostly coarse (`step`, `write_render`, counters), with per-actor `get_actor(i)` / 10-arg `spawn` used for rigs and spawns | R8.2 | Low | Keep; document these as rare-path only |
| G17 | `WorkerThreadPool` used for PNG saves inside `main.gd` with `wait_for_task_completion` at many sites (lines 623, 1494, 2076, ...) | R9.5 | Low | Dev-only capture module under `dev/` |

---

## 4. Open questions

1. **Sim tick rate.** 60 Hz fixed vs 30 Hz sim with interpolation for the crowd? Needs a frame-budget test on Deck-class hardware. Decides R9.1 and R9.7.
2. **gdtoolkit on Godot 4.7.2 syntax.** I could not confirm a release that parses 4.5+ syntax; test a canary file before gating (R7.7). If it fails, fall back to Godot's own `--check-only` plus a thin in-house style script.
3. **gdUnit4 vs GUT on 4.7.2.** gdUnit4's table stops at 4.7.1 and master is v7.0.0; GUT 9.7.1 is listed for 4.7.x. Pick after a one-hour spike on both with a scene-runner test and headless CI.
4. **Native Linux build or Proton-only?** Proton keeps one Windows binary, but Linux CI, ASan and Deck performance are easier native. GodotSteam and Sentry behaviour under Proton are unverified.
5. **Hot reload.** Is `reloadable=true` stable enough on Windows with DLL locking, or do we restart the editor? Measure in the first week of native work.
6. **JSON vs `.tres` for PoF-generated data.** Runtime JSON loader (flexible, no editor round trip) vs an import-time bake to `.tres` (typed, inspectable). Default here: JSON + typed loader; revisit if boot time or editor needs argue otherwise.
7. **Resource vs RefCounted for tables.** If designers never open tables in the Inspector, plain typed RefCounted loaded from JSON is simpler and agent-friendlier.
8. **Behaviour-tree addon (LimboAI / Beehave).** Not needed under R6.1; revisit only if police AI exceeds HFSM limits.
9. **Golden images.** Which renderer/driver pins make images stable between a dev GPU, CI and Deck? Needs a spike; may restrict goldens to a software-rendered CI job.
10. **Entity count of shipped Godot horde games.** Brotato and Halls of Torment postmortems with numbers were not found; the Halls of Torment GodotFest 2025 talk (project structure, communication, profiling, custom editor builds) should be watched and this document updated. [V:S25 abstract only]
11. **Custom engine build.** Halls of Torment's talk lists compiling a custom editor as a topic; worth deciding whether we ever do (symbols for crash reports, build profile) or stay on stock templates.
12. **`reloadable`, `compatibility_minimum`, `@abstract`, warning names, `gdlint` rule names, `Performance.add_custom_monitor`, shader baker details** all carry [4.7?] / [I] flags and need a one-time check in 4.7.2.

---

## 5. Sources

Official Godot docs and posts (fetched 2026-11-02):
- S1 https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html
- S2 https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html
- S3 https://docs.godotengine.org/en/stable/tutorials/best_practices/node_alternatives.html
- S4 https://docs.godotengine.org/en/stable/tutorials/best_practices/data_preferences.html
- S5 https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html
- S6 https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html
- S7 https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/warning_system.html
- S8 https://godotengine.org/article/uid-changes-coming-to-godot-4-4/
- S9 https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html
- S10 https://docs.godotengine.org/en/stable/tutorials/performance/thread_safe_apis.html
- S11 https://docs.godotengine.org/en/stable/tutorials/performance/using_servers.html
- S12 https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html
- S13 https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html
- S14 https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/physics_interpolation_introduction.html
- S15 https://docs.godotengine.org/en/stable/tutorials/scripting/cpp/gdextension_cpp_example.html
- S26 https://godotengine.org/releases/4.7/ and https://github.com/godotengine/godot/releases/tag/4.7-stable (4.7-stable, 2026-06-18; feature release that "preserves compatibility")
- S27 https://godotengine.org/article/dev-snapshot-godot-4-4-dev-2/ (typed dictionaries)
- S29 https://docs.godotengine.org/en/latest/tutorials/scripting/resources.html (via search summary)

Tools and community:
- S16 https://github.com/godotengine/godot-cpp (api_version, CMake present, v10 independent versioning)
- S17 https://github.com/MikeSchulze/gdUnit4 (compatibility table, features)
- S18 https://github.com/MikeSchulze/gdunit4-action (CI usage; headless needs v7+)
- S19 https://github.com/bitwes/Gut (9.7.1 for 4.7.x)
- S20 https://github.com/Scony/godot-gdscript-toolkit (gdlint, gdformat, pre-commit, CI)
- S21 https://github.com/getsentry/sentry-godot (GDExtension, Godot 4.5+, platforms)
- S22 https://docs.sentry.io/platforms/godot/ (minidumps, symbols, before_send)
- S23 https://gdquest.com/tutorial/godot/best-practices/signals/ (signals, bubbling, event bus)
- S24 https://www.gdquest.com/library/glossary/deterministic_simulation (floating point, physics not deterministic)
- S25 https://media.ccc.de/v/godotfest2025-a-peek-under-the-hood-technical-learnings-from-halls-of-torment
- S28 https://github.com/abarichello/godot-ci (presets must be committed)
- S33 https://godotsteam.com/blog/2026/08/22/godot-472-and-godotsteam-422--411/

Internal (local, read-only):
- S30 registry `knowledge/game-production/systems-canon/cross-runtime-rules-conformance/` (techniques: pinned-rules-data, golden-trace vectors, declared tolerance, planted mutation, divergence log) and `.../gameplay-runtime-patterns/techniques/update-order-and-frame-coherence.md` (S31).
- S32 `C:\Users\kazda\kiro\pof\games\gtai\research\godot-city-scale.md`
- L `C:\Users\kazda\kiro\gtai-spike\evolve\project\` (game/*.gd, project.godot, export_presets.cfg, git config) and `C:\Users\kazda\kiro\gtai-spike\cityscale\` (project/, native/, GATE.md, evidence/parity.json).

Not reachable in this pass (HTTP 404): Godot docs pages for autoloads-vs-nodes and the GDExtension "what is" page. Autoload guidance in R3.x therefore rests on S2 plus inference.
