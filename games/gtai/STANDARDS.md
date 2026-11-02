# GTAI: Uprising - Engineering Standard

Version 1.0, 2026-11-02. Engine **Godot 4.7.2** (GDScript + one C++ GDExtension), store **Steam** (Windows build; Steam Deck through Proton). This file is the rulebook. The four research reports are the evidence behind it.

## 0. Purpose and precedence

- **Who it binds.** Every human and AI agent (Claude, Codex, council seats) that writes code, data, assets or release material for GTAI, from Phase 2 on. The spike trees (`gtai-spike/evolve`, `gtai-spike/cityscale`) are evidence, not product. They are exempt, except where section 21 says what to port.
- **Precedence.** 1) law and Valve's rules; 2) this standard; 3) design truth in `pitch.md` and the `STATE.md` decisions; 4) the research reports, which are evidence only; 5) agent habits and defaults. When the standard and a design decision collide, ask the owner. Neither side wins silently.
- **Keywords.** **MUST** = a CI gate or a review blocker. **SHOULD** = the default; deviating needs a written line. **MAY** = optional.
- **Deviations are recorded, never silent.** Add a line to `docs/decisions.md` in the game repo: `- [YYYY-MM-DD] DEVIATION <RULE-ID>: what, why, until when / re-check trigger, who`. Mark the code site with `# DEVIATION <RULE-ID>`. Review rejects a deviation that has no expiry or re-check trigger.
- **Stable IDs.** Rule IDs are never renumbered. A retired rule keeps its ID and is marked RETIRED. Rules marked **(4.7!)** are version-sensitive: re-verify them at every bump of Godot, godot-cpp, GodotSteam, the test framework or gdtoolkit.
- **Home.** On day one this file is copied to the game repo root, and `AGENTS.md` links it. From then on the game-repo copy is authoritative, and this file becomes a pointer.
- **Evidence keys.** [A] architecture, [D] data and formats, [R] Steam release, [W] Steamworks integration, [C] city-scale research, [G] city-scale gate. A citation such as `[A R10.1]` names that report's own rule or section.

## 1. Repository and git hygiene (GIT)

- **GIT-01 MUST** Make the game its own repository, outside every other working tree. `C:\Users\kazda\kiro` is itself a repo, so do not place it there. The Godot project lives in the subfolder `project/`. *Why:* the spike's repos are nested inside the kiro repo. [A G12][A]
- **GIT-02 MUST** Commit `.gitattributes` before the first content commit (section 22). Every clone and agent worktree runs `git config core.autocrlf input`. *Why:* in evolve, 35 `.import` files churned on line endings alone. [A R10.1-10.2][A] [D I2][D]
- **GIT-03 MUST** Configure Git LFS before the first commit that holds art, audio or fonts. Track png, jpg, webp, psd, wav, ogg, mp3, glb, fbx, ttf, otf and mp4. `.import` and `.uid` files stay in plain git. *Why:* adding LFS later means rewriting history, and evolve's `.git` was already 102 MB after 24 commits. [A R10.7][A] [^lfs]
- **GIT-04 MUST** Commit each `.uid` and `.import` file together with its source. Move assets in the editor, or move all three files together. Ignore `.godot/`, `*.translation`, `export_credentials.cfg`, `build/`, `*.pck`, `native/**/bin/`, `*.obj`, `.sconsign.dblite` and `*.pdb`. [A R10.3-10.4][A]
- **GIT-05 MUST** Store authored scenes and resources as text (`.tscn`, `.tres`), never as `.scn` or `.res`. *Why:* text diffs and merges. [A R10.5][A]
- **GIT-06 MUST** Follow the three-tier asset policy:
  1. Masters (raw generations, layered files, contact sheets, `work/`) stay outside git. A committed manifest records them.
  2. Game-ready files go in git, through LFS.
  3. Imported or baked output never goes in git.
  [D R1][D]
- **GIT-07 MUST** Commit no generated churn:
  - PNG optimise and downscale run as a pinned pipeline step, never as a hand re-save.
  - Every generated file carries a `DO NOT EDIT` header and a content hash.
  - CI regenerates these files and fails on drift.
  [D R3][D] [W 4.3][W]
- **GIT-08 MUST** Follow the shared-checkout rules:
  - stage per path;
  - no `git stash`;
  - no `git add -A`, `git add .` or `git add -u`;
  - no `reset --hard`;
  - commit each task as it lands;
  - parallel agents each work in their own `git worktree`.
  [A R10.9][A]
- **GIT-09 SHOULD** Keep each `.tscn` to about 50 authored nodes or fewer. When a `.tscn` merge conflicts heavily, redo one side in the editor instead of hand-merging. [A R10.6][A]

## 2. Project layout (LAY)

```
gtai/                      STANDARDS.md AGENTS.md versions.toml justfile .gitattributes .gitignore .editorconfig gdlintrc
  .github/workflows/ci.yml
  docs/                    decisions.md determinism.md data-contracts.md
  art_src/                 masters manifests only (masters themselves on NAS/object storage)
  tools/                   achievements/gen.mjs  pck_audit/  data_lint/  po_lint/  gen_constants/  scaffold/
  steam/                   manifest.json achievements/ ai-provenance/ content/ store/ build/ legal/ qa/ input/ richpresence/
  native/                  GODOT_CPP_VERSION  godot-cpp/ (submodule)  sim_core/{src,tests}/  binding/  SConstruct
  project/                 res:// -> project.godot export_presets.cfg
    addons/                VENDORS.md godotsteam/ <testfw>/ sentry/
    native/                gtai_sim.gdextension  bin/ (ignored)
    boot/                  main.tscn boot.gd world.gd (composition root) launch_args.gd
    core/                  log/ rng/ clock/ events/ data/ save/ settings/ replay/ loc/ math/
      platform/            platform.gd backends/{platform_backend,null_backend,steam_backend,fake_backend}.gd achievements/
    features/              city/ crowd/ vehicles/ characters/ combat/ police/ missions/ economy/ audio/ hud/ fx/ camera/ input/ menus/
    data/                  tables/*.json schemas/*.json generated/ loc/*.po
    assets/                atlases/ audio/ fonts/ shaders/   (feature-local art lives in features/*/art/)
    tests/                 unit/ integration/ scenarios/ parity/ golden/ saves/ support/
    dev/                   bots/ cheats/ overlays/ debug_tools.gd
```

- **LAY-01 MUST** Use the layout above:
  - one folder per feature, holding its scene, script and local art together;
  - `core/` holds engine-agnostic infrastructure;
  - `addons/` holds third-party code only.
  [A R1.1][A]
- **LAY-02 MUST** Name every file and folder in snake_case, lowercase. Node names and `class_name` use PascalCase. *Why:* PCK paths and Linux are case-sensitive, while Windows is not. [A R1.2][A]
- **LAY-03 MUST** Every addon gets a line in `addons/VENDORS.md`: name, version, URL, licence, date and purpose. Agents never install a plugin without that line and the owner's OK. [A R1.3][A]
- **LAY-04 MUST** Keep prompts, logs, raw art and tool data out of `project/`. A tool folder that must sit inside `project/` gets a `.gdignore` file. *Why:* today `_chars/` (14 MB of tool data) ships inside the export. [A R1.5][A]
- **LAY-05 MUST** Do not let features depend on each other's internals. `features/*` depend only on `core/` and on `WorldContext`. [A §2][A]
- **LAY-06 MUST** Give a script and its scene the same basename in the same folder, with singular names (`vehicle.gd`, `vehicle.tscn`, `vehicle_config.gd`). [A R1.7][A]
- **LAY-07 MUST** Keep three control files at the root:
  - `AGENTS.md`: the commands (`just lint|test|export|audit|ach`), the folder map, the top rules, and a "copy this" template for each file kind.
  - `docs/decisions.md`: one dated line per decision.
  - `versions.toml`: pins Godot, godot-cpp, the test framework, gdtoolkit, GodotSteam and Sentry.

  CI and agents read these files. [A R1.8, R14.4-14.5][A]

## 3. GDScript code rules (GDS)

- **GDS-01 MUST** Type every variable, parameter and return statically, including `Array[T]` and `Dictionary[K, V]`. GDScript cannot type nested collections, so wrap them in a small class. *Why:* typed code compiles to optimised opcodes, and the analyser catches agent mistakes. [A R7.1][A]
- **GDS-02 MUST** Turn the `[debug]` warnings in section 22 into errors (value `2`) and set `exclude_addons=true`. **(4.7!)** Verify the exact setting names in the 4.7.2 editor. [A R7.2][A]
- **GDS-03 MUST** Keep files small:
  - GDScript files: about 200 LOC each (the owner's convention); CI hard stop at 300.
  - Functions: 40 lines or fewer, with at most 5 parameters.
  - C++ translation units: 300 LOC or fewer.

  *Why:* agents edit small files reliably, and `main.gd` (4,267 lines) shows what happens without a gate. [A R1.6][A]
- **GDS-04 MUST** Follow the Godot style guide:
  - tabs, LF line endings, UTF-8, lines under 100 characters;
  - the guide's code order (signals, enums, constants, exports, vars, onready, `_init`, callbacks, public, private, inner classes);
  - a `_private` prefix for private members.

  `gdformat --check` and `gdlint` run in pre-commit and in CI. [A R7.5-7.6][A]
- **GDS-05 MUST** Pin gdtoolkit. A canary file in CI holds the newest syntax we use. Syntax the canary cannot parse is banned until it can (for example `@abstract`). The fallback linter is `godot --headless --check-only` plus a small in-house style script. **(4.7!)** [A R7.7][A]
- **GDS-06 MUST** Use `class_name` on every script that another file uses as a type, and on no scene-root script that nobody types against. Write no `const X := preload(...)` aliases, except to break a cycle. [A R7.4][A]
- **GDS-07 MUST** Use `:=` only when the right-hand type is obvious. Write the type explicitly when the value comes from a Variant source (`Dictionary.get`, `load()`, `get_node()`, JSON). [A R7.3][A]
- **GDS-08 MUST** Commit no bare `print()`; everything logs through `Log`. All input goes through InputMap actions, never raw keycodes. Every user-facing string goes through `Loc.t()` / `tr()` from day one. [A R12.1, R14.1-14.2][A]
- **GDS-09 SHOULD** Keep hot paths cheap:
  - no `get_node`/`$` per frame;
  - no per-actor Dictionary;
  - no string building, no `await`, no capturing lambdas;
  - idle nodes call `set_process(false)`;
  - one manager loop iterates arrays instead of thousands of node callbacks.

  [A R7.8][A]
- **GDS-10 MUST** A lambda connected to a longer-lived emitter is either disconnected explicitly or bound to the receiver's lifetime. [A R4.6][A]
- **GDS-11 SHOULD** Use int enums in code, and strings only at the data boundary. [A R5.7][A]

## 4. Architecture and communication (ARC)

- **ARC-01 MUST** Pick the lightest type that does the job:
  - `RefCounted` for behaviour and data;
  - `Resource` only when the Inspector or file persistence is needed;
  - `Node` only when the scene tree is needed.

  Compose with scenes, allow at most one level of script inheritance, and allow no inheritance across features. [A R2.1-2.2][A]
- **ARC-02 MUST** Cap the autoloads at seven: `Log`, `LaunchArgs`, `Events`, `Game`, `Data`, `Save`, `Platform`. An eighth needs a `decisions.md` line. `DebugTools` is not an autoload: `Game` instantiates it from `dev/` when the build is a debug build or carries the `devtools` tag. [A R3.1][A] [W §7][W] [^autoload]
- **ARC-03 MUST** Give every autoload that holds mutable state a `reset()`, called by tests and by "new game". No per-frame gameplay state lives in an autoload. [A R3.4, R3.6][A]
- **ARC-04 MUST** Build `WorldContext` once, in the composition root `boot/world.gd`. `WorldContext` is a typed `RefCounted` holding the RNG streams, clock, data, events and services. The root calls `setup(ctx)` on every system. Banned:
  - `/root/...` string paths;
  - reaching up the tree;
  - a string-keyed service locator.

  *Why:* any system can then be built with fakes in a test. [A R3.2-3.5][A]
- **ARC-05 MUST** Call down, signal up. Siblings are coordinated by their common ancestor. A signal is re-emitted at most twice; beyond that, use `Events` or an injected reference. [A R4.1, R4.3][A]
- **ARC-06 MUST** `Events` is a stateless autoload of typed, past-tense signals for low-frequency domain events that cross features: mission, wanted, district, death, and the achievement triggers.
  - Cap: 40 signals.
  - Each signal is listed with its emitter and its typed parameters in `data/schemas/events.json`.
  - Debug builds log every emit, with its tick, to a ring buffer.

  [A R4.2, R4.4][A] [W E1-E2][W] [^bus]
- **ARC-07 MUST NOT** Route per-frame or per-actor data (positions, damage ticks, percepts) through any signal or bus. Use packed arrays or an injected data object instead. [A R4.5][A]
- **ARC-08 MUST** State that several features read (wanted level, cash, mission state) changes through one setter, and that setter emits. Raw field writes are banned. *Why:* the spike writes `wanted` at 8 sites and `cash` at 3. [W §6][W]
- **ARC-09 MUST** Choose the AI model by actor count:
  - Crowds: an int-mode FSM inside the native sim, one byte per actor.
  - Named actors (tens): a GDScript HFSM of `RefCounted` states, each with `enter`, `update` and `exit`.
  - Bosses: HFSM phases driven by data.

  Add a behaviour-tree addon only when an HFSM exceeds about 8 states per level, the addon passes LAY-03, and it passes a perf test with 100 actors. [A R6.1-6.2][A]
- **ARC-10 MUST** Make AI transition tables data, unit-tested for unreachable states and missing transitions. Time-slice AI thinking (every N ticks, staggered by `id % N`), keep sense, decide and apply as separate phases, and defer spawns and despawns to a drain after the loop. [A R6.3-6.4][A]
- **ARC-11 MUST** Hero entities (the player, bosses, mission NPCs, police near the player) are nodes. Everything beyond the activity bubble is data. Promotion and demotion between the two go through one `ActorPromotion` seam. [A R2.6][A]

## 5. Data tables (DAT)

- **DAT-01 MUST** Each number has one source. Static game data is typed data, never a literal scattered through logic. *Why:* `CAP`/`HW` are duplicated between `sim_gd.gd` and `city_sim.h`. [A R5.1][A]
- **DAT-02 MUST** JSON is the source of truth for items, weapons, vehicles, enemies, wanted thresholds, economy, missions, dialogue structure and achievements. Write it as UTF-8 with LF line endings and sorted keys, through one canonical formatter. A flat designer sheet MAY be CSV. [D D1][D] [^data]
- **DAT-03 MUST** Every table has a JSON Schema. CI checks:
  - the schema;
  - referential integrity (item, loot, mission, dialogue, audio, icon and loc-key references);
  - unique, immutable snake_case ids.

  A bad row fails the build; it is never skipped. [D D2][D] [A R5.3][A]
- **DAT-04 MUST** Every row carries a stable string `id`. Saves and cross-references use ids, never indices. A rename needs an alias map so old saves still load. [D D3][D]
- **DAT-05 MUST** A typed loader reads each table once, at boot, into typed objects.
  - The loader returns an error list, never a half-built object.
  - A table over 2000 rows loads on a worker thread (about 11 ms to parse).
  - JSON numbers arrive as floats: cast them, and never use a numeric id above 2^53.

  [D D6][D]
- **DAT-06 MUST** `.tres` is only for editor-authored visual resources (themes, SpriteFrames, particles). Balance data is never hand-written or AI-written as `.tres`. `.res` is never committed. [D D5][D]
- **DAT-07 MUST** Every persisted or generated format names its schema and version (`"schema": "gtai.quest/1"`). PoF wire contracts (quests, economy, canon) are validated at the boundary when they are imported. [A R5.4, R5.6][A] [D D7][D]
- **DAT-08 MUST** Dialogue tables carry speaker, conditions, line IDs and audio refs. The words themselves live in localisation. [D D4][D]
- **DAT-09 MUST** Non-resource files reach the PCK through `include_filter`. The export audit proves they are present (EXP-05). [D D7][D]

## 6. The native C++ boundary (NAT)

- **NAT-01 MUST** Native code covers only what measurement proved:
  - the bubble sim: spatial hash, steering, lane following, collision, projectile step;
  - the render-buffer writer.

  Rules, missions, UI and rare calls stay in GDScript. *Why:* the riot sim takes 4.56 ms in GDScript and 0.093 ms native; GDScript alone fails the 7 ms gate. [G][G] [A R8.1][A]
- **NAT-02 MUST** Keep the API coarse: one `step()` and one `write_render()` per frame, with bulk state in `Packed*Array`. Per-actor calls exist only for rare events (spawn, promotion), and each is documented as such. [A R8.2][A]
- **NAT-03 MUST** Split the native code in two:
  - a plain C++ core with no `godot::` types, tested standalone under sanitizers;
  - a thin binding that converts packed arrays to spans.

  [A R8.3][A]
- **NAT-04 MUST** Add godot-cpp as a git submodule at the tag or commit recorded in `native/GODOT_CPP_VERSION`, and build with `api_version=4.7`. Never track a floating `master`. **(4.7!)** [A R8.4][A]
- **NAT-05 MUST** Use SCons only. CI builds `template_debug` and `template_release` with MSVC, plus a Linux debug build under ASan/UBSan that runs the parity test. [A R8.5-8.6][A]
- **NAT-06 MUST** Keep a GDScript reference sim permanently, with a parity gate in CI:
  - same chunks, same seeds, fixed dt;
  - full snapshots at N checkpoints must match exactly;
  - a planted-mutation check proves the test can fail;
  - a divergence log records who was right when the two disagree.

  [A R8.9][A]
- **NAT-07 MUST** Sim maths uses only operations that round identically in both runtimes: `+ - * /`, sqrt and floor on doubles, an integer LCG, and headings built from integer vectors. The sim translation unit is compiled with `/fp:strict` (MSVC) or `-ffp-contract=off`. *Why:* GDScript and MSVC rounded the same literal differently. [A R8.10][A] [G][G]
- **NAT-08 MUST** Shared constants (capacities, grid sizes, enums) are generated from one source (`tools/gen_constants`) into both the `.gd` and the `.h`. [A R8.11][A]
- **NAT-09 MUST NOT** Touch the scene tree or Godot objects from a native worker thread. Server writes happen on the main thread. [A R8.12][A]
- **NAT-10 MUST** The `.gdextension` file declares a library per platform, and each export ships only the matching one. [A R8.8][A]
- **NAT-11 MUST** Native and Steam work is built and tested on x64. The dev PC is ARM64 and `steam_api64.dll` is x64-only, so use the x64 editor under emulation, the x86_64 Ryzen box, or CI. [W §1.4][W]
- **NAT-12 SHOULD** Base the dev loop on headless tests and restarts. Set `reloadable=true` only once it proves stable on Windows, where the editor locks the DLL. [A R8.7][A]

## 7. Simulation and determinism (SIM)

- **SIM-01 MUST** Run the sim on a fixed 60 Hz tick (`_physics_process`, or an explicit accumulator), with at most 4 catch-up steps per frame (provisional). Never use variable delta. *Why:* the gate bench clamps dt, so its runs cannot be replayed. [A R9.1][A]
- **SIM-02 MUST** Give each system its own `RandomNumberGenerator`, seeded from the master seed plus a hash of the system name. Lint bans the global `randf`, `randi` and `seed()` in gameplay code. *Why:* adding a spawn must not shift the AI's dice. [A R9.2][A]
- **SIM-03 MUST NOT** Use Godot physics for any outcome that a test asserts or a replay reproduces. Crowds use no physics bodies. [A R9.3][A]
- **SIM-04 MUST** Write the determinism contract in `docs/determinism.md`:
  - the same build, inputs and seeds give an identical state hash (MUST);
  - the native sim is bit-identical across machines (SHOULD);
  - Godot physics and rendering are never deterministic.

  [A R9.4][A]
- **SIM-05 MUST** Support replay. Record the master seed, the build hash and a per-tick input log. `--replay <file>` re-runs headless with `--fixed-fps 60` and compares the final state hash and the event timeline. [A R9.6][A]
- **SIM-06 MUST** Use `WorkerThreadPool` for data-only work. Merge results in submission order and apply them on the main thread at a frame boundary. [A R9.5][A]
- **SIM-07 MUST** Store every generated output (chunks, quests) with its seed, generator version and parameters. [D C1][D]
- **SIM-08 SHOULD** Smooth crowd motion by interpolating the previous and current transforms in the MultiMesh writer. Use engine physics interpolation only on hero nodes, and only if a play test asks for it. [A R9.7][A]

## 8. World streaming and rendering budgets (WLD)

- **WLD-01 MUST** Use 128 m chunks, with a resident 3x3 ring plus a 1-ring prefetch. Stream plain data (packed arrays), never scenes. [C §3][C]
- **WLD-02 MUST** Load chunks in two stages:
  1. Read and decode on `WorkerThreadPool`, handing over through a mutex queue.
  2. Activate on the main thread, time-sliced to 1.5 ms per frame, one chunk at a time, with pooled canvas items.

  *Why:* pooling cut the worst swap frame from 6.1 ms to 1.8 ms. [G][G] [D C6][D]
- **WLD-03 MUST** Build an activity bubble around the camera:

  | Zone | Range | Simulation | Caps |
  |---|---|---|---|
  | Tier A | about 80 m | full sim | 80 pedestrians, 20 cars, 12 police |
  | Tier B | about 160 m | lane following only | 120 pedestrians, 30 cars |
  | Beyond | | nothing simulated | |

  The total hard cap is 400. Pursuers and mission actors are promoted to Tier A and kept as data records. [C §3][C]
- **WLD-04 MUST** Keep crowd actors (pedestrians, ambient cars, projectiles, particles) out of the scene tree. Store their state as struct-of-arrays and draw one MultiMesh per layer, with shared atlases and per-instance custom data, culled per area by the sim. *Why:* MultiMesh beat canvas items at riot density (p99 3.0 vs 5.6 ms). [A R2.3][A]
- **WLD-05 MUST** Manage RIDs by hand: every `*_create()` has an owner that frees it, and the backing Resource stays referenced. Pool instead of freeing and re-creating. Never read back from a server per frame. [A R2.4-2.5][A]
- **WLD-06 MUST** Rig only the 16 nearest people within 14 m, with rigs pooled per body plan. Everyone else is an atlas frame. *Why:* re-planning a rig was a measured 16 ms spike. [G][G]
- **WLD-07 MUST** Prepare everything behind the loading screen:
  - prewarm every material and shader variant;
  - load textures with `load_threaded_request`;
  - never block the main thread on `load_threaded_get`;
  - export with the shader baker. **(4.7!)**

  *Why:* first-use compiles caused hitches of up to about 200 ms. [D T8][D] [A R13.5][A]
- **WLD-08 MUST** Enforce the section 20 budgets with a perf job on an exported release build, using a scripted riot scenario and a crowded-drive scenario. It runs per milestone and on every change under `native/`, `features/city` or `features/crowd`. A run outside a hard limit fails the job. [G][G]
- **WLD-09 MUST** Navigation:
  - Cars use an authored lane graph with intersection reservation and progress-based jam breakers.
  - Pedestrians random-walk a sidewalk graph with spatial-hash separation and no RVO.
  - Police chasers share one flow field toward the player.

  [C §2][C]

## 9. Assets and formats (AST)

- **AST-01 MUST** Import every sprite, cutout part, decal, UI image and shader input as **Lossless** (`compress/mode=0`). Never use Lossy for sprites, never S3TC, never Basis Universal. *Why:* Lossy saves no VRAM, and S3TC measured 27 dB on the ped atlas. [D T1-T4][D]
- **AST-02 MAY** Use BC7 (`compress/mode=2`, `high_quality=true`) for one class of large opaque tiles or big atlases. It must first pass an A/B gate: 64 px/m zoom, print shader on, PSNR of at least 40 dB, and the owner's eye. [D T3][D]
- **AST-03 MUST** Generate mipmaps only together with a `*_WITH_MIPMAPS` filter:
  - world art that scales: Linear-Mipmap;
  - UI and 1:1 sheets: no mipmaps;
  - Nearest: pixel fonts and pixel UI only.

  Set the project default filter explicitly. [D T6][D]
- **AST-04 MUST** Put texture defaults in `[importer_defaults]` and set `detect_3d/compress_to=0`. A per-file `.import` is written only where it differs from the defaults. [D T9, I3][D]
- **AST-05 MUST** Each texture is at most 4096 px per side and 32 MB of VRAM, unless there is a written exception. Leave 2 px of bleed between atlas cells (4 px with mips) and set `fix_alpha_border=true`. Block formats pad sizes to multiples of 4. [D T7][D]
- **AST-06 SHOULD** Decide texel density per asset class and cut it in the pipeline with a pinned Lanczos tool, never at runtime. Art authored at 128 px/m is drawn at 32-64 px/m (Q9). [D T5][D]
- **AST-07 MUST** Audio formats:
  - SFX and barks of 3 s or less: WAV with QOA, mono, trim on.
  - Music, ambience and voice over 3 s: Ogg Vorbis.
  - No Opus or other third-party codec until it is built and tested on Windows and Deck.

  [D A1-A4][D]
- **AST-08 MUST** Normalise loudness offline in LUFS:

  | Class | Target |
  |---|---|
  | Mix | -18 LUFS integrated, -1 dBTP ceiling |
  | Voice and barks | within 1 LU of each other |
  | SFX | 3-6 LU below dialogue |
  | Music | 9-12 LU under dialogue |

  The gain lives in a `suggestedGainDb` sidecar, applied at play time. Voices play through a pool with `max_polyphony` and a limiter. [D A6-A7][D]
- **AST-09 MUST** Every loop carries explicit loop data: WAV loop points, or Ogg `loop_offset` with `bpm`/`beat_count`. Verify the seam in the exported build. [D A5][D]
- **AST-10 MUST** Fonts:
  - bundle every font; never rely on system fonts;
  - dynamic fonts for body text and UI;
  - MSDF only for display text and world-scaled labels;
  - an explicit fallback chain;
  - a glyph-coverage lint per locale;
  - CJK subset and shipped in its language PCK;
  - every licence recorded.

  [D F1-F5][D]
- **AST-11 MUST** City chunk files:
  - One file per chunk, named `c_XX_YY.bin`, never renumbered.
  - A 32-byte header: magic `GTCH`, `format_version` u16, float-width flag, chunk x/y, generator version, truncated SHA-256.
  - The payload is `var_to_bytes` of packed arrays, decoded only with `bytes_to_var`.
  - A failed header or hash means: log, skip, never instantiate.
  - No compression now. Per-chunk zstd MAY be added once a chunk exceeds 256 KB.

  [D C2-C5][D]
- **AST-12 MUST** Chunks are build output, baked from authored district JSON by a deterministic tool. CI bakes twice, byte-compares the results, and checks them against a golden hash list. [D C1, C8][D]

**Format decision table** (asset -> shipping format) [D §10][D]

| Asset | Ship as | Settings | Why |
|---|---|---|---|
| Characters, cutout parts, small sprites | PNG -> `.ctex` Lossless | Linear-Mipmap only if drawn below 1:1; atlas bleed of 2-4 px | exact riso pixels |
| Ground, road and roof tiles | PNG -> `.ctex` Lossless; BC7 opt-in after A/B | author at the class density | the biggest VRAM lever (BC7 is 4x smaller at 40-52 dB) |
| Big atlases (peds 2048x5504) | Lossless; BC7 opt-in | split under 4096 px | 44 MB -> 11 MB with BC7 |
| Decals, soft-alpha FX | Lossless | `fix_alpha_border` | alpha breaks under DXT |
| HUD, UI | Lossless, no mips | integer scale | crisp |
| Shader LUTs and noise | Lossless | repeat as needed | exact input |
| Fonts | TTF/OTF dynamic; MSDF for titles | CJK subset | section AST-10 |
| SFX, barks (3 s or less) | WAV + QOA | mono, trim | about 5:1, cheap polyphony |
| Music, ambience, voice | Ogg Vorbis q3-5 | loop data; one PCK per language | size |
| Game data | JSON + JSON Schema | `include_filter`, loaded once | reviewable diffs |
| Editor visual resources | `.tres` (`.res` at export) | default | Inspector authoring |
| Strings | PO per locale | lint + pseudoloc | plurals, tooling |
| City chunk | header + `var_to_bytes` | one file per chunk | 10 us decode |
| Save slot | `GTSV` container + JSON | tmp/verify/bak/rename | safe, diffable |
| Settings | versioned JSON | device/profile split | no object parsing |
| Packs | several PCKs, unencrypted | `embed_pck=false` | SteamPipe chunks |

## 10. Saves and settings (SAV)

- **SAV-01 MUST** A save is JSON inside a checked container. For anything under `user://` or Steam Cloud, never use `ResourceSaver`/`ResourceLoader`, `ConfigFile`, `str_to_var`/`var_to_str` or any `*_with_objects` call. *Why:* each of these paths can run code from a shared or cloud-synced file. [D S1][D]
- **SAV-02 MUST** Save container `state.sav`:

  | Field | Size |
  |---|---|
  | magic `GTSV` | 4 bytes |
  | `container_version` | u16 |
  | `min_reader_version` | u16 |
  | `flags` (bit 0 = zstd) | u32 |
  | `payload_len` | u64 |
  | SHA-256 of the stored payload | 16 bytes |
  | payload: UTF-8 JSON (`sort_keys=true`, `full_precision=true`) | rest |

  The reader checks both versions before parsing. A hash mismatch is corruption, never a reason to default-fill. [D §6, S2-S3][D]
- **SAV-03 MUST** Write protocol:
  1. Snapshot the state on the main thread.
  2. On a worker, serialise it and round-trip parse it.
  3. Write `.tmp` and close it.
  4. Re-read it and verify the length and SHA-256.
  5. Rename `.sav` to `.bak`.
  6. Rename `.tmp` to `.sav`.

  Load order: `.sav`, then `.bak`, then a valid `.tmp` newer than both. If all fail, stop and offer recovery; never reset silently. *Why:* on Windows, Godot's rename deletes the target first, and Godot has no fsync. [D S4-S5][D] [^save]
- **SAV-04 MUST** Every save carries a `save_version`, with chained pure migration functions (`vN -> vN+1`). A fixture for every released version lives in `tests/saves/vN.sav`, and tests load each one. A save newer than the reader knows is refused and never overwritten. [D §6][D]
- **SAV-05 MUST** Store world state as sparse deltas against the generated chunks, referencing data ids. Budget: 256 KB per slot, 8 files per profile, under 5 MB in total. [D §6][D]
- **SAV-06 MUST** Use a custom user dir, `<Studio>/GTAI Uprising`, laid out as:
  - `profile/` (synced): `prefs.json`; `slot_N/{meta.json, state.sav, state.sav.bak}`; `auto_a/`, `auto_b/`.
  - `device/` (never synced): `settings.json`, `achievements_mirror.json`.
  - `logs/` (never synced).

  When Steam is up, the profile path includes the SteamID. [D §6, S7][D]
- **SAV-07 MUST** Use Steam Auto-Cloud, not the API:
  - root `WinAppDataRoaming`, subdirectory `<Studio>/GTAI Uprising`;
  - patterns `profile/**/*.sav` and `profile/**/*.json`;
  - graphics settings, the mirror, logs and caches are never in the cloud.

  [D S8][D] [W C1-C3][W]
- **SAV-08 MUST** Save at checkpoints, mission ends and quit, with encode, hash and write off the main thread. *Why:* the Deck sends no suspend callback. `meta.json` shows last played, playtime and mission, so the Steam conflict dialog's timestamps can be checked against the title screen. [W C4-C5][W] [D S6][D]
- **SAV-09 MUST** Test the cold paths: truncated file, flipped byte, newer version, missing `.bak`, zero-length file, no write permission. [D S9][D]
- **SAV-10 MUST** Settings are versioned JSON:
  - deep-merged over code defaults, clamped, unknown keys ignored;
  - on a parse failure: rename to `settings.corrupt-<time>.json`, use defaults, tell the player;
  - bindings stored as plain data (`action`, kind, `physical_keycode`, joypad button/axis), never as `InputEvent` objects;
  - written on change after a 1 s debounce and on exit, with the SAV-03 protocol.

  [D P1-P4][D]

## 11. Localisation and profanity (LOC)

- **LOC-01 MUST** Key strings by stable symbolic IDs (`M03_FIXER_GREET_02`). English is just another locale. [D L1][D]
- **LOC-02 MUST** Use gettext PO, one file per locale. At runtime load only the active locale (20k lines take 128 ms). The fallback locale is `en`. Debug builds render a missing key as `!!KEY!!`. [D L2, L7][D]
- **LOC-03 MUST** Treat every `.po` file as code-execution input on Godot 4.1.0-4.7.2. The `Plural-Forms` header reaches `bytes_to_var_with_objects`, and the hole is unpatched as of 2026-10-26. Therefore:
  - only our own reviewed PO files ship, and only from the PCK;
  - never load PO from `user://`, workshop or mod folders;
  - CI pins each file's `Plural-Forms` to a whitelist of exact GNU strings;
  - vendor-delivered files are untrusted until linted;
  - re-check at every Godot bump. **(4.7!)**

  [D L3][D]
- **LOC-04 MUST** Use named placeholders, with a lint comparing the placeholder sets across locales. Plurals use `tr_n`. No string concatenation. Gender variants get separate keys. [D L5][D]
- **LOC-05 MUST** The e2e walk runs pseudo-localisation (`double_vowels`, expansion 0.3-0.5, accents, `fake_bidi`, `skip_placeholders`), plus a second run with `override` to catch hardcoded text. *Why:* the spike uses `tr(` 0 times. [D L4][D]
- **LOC-06 MUST** Joke profanity is an overlay, not a locale:
  - the base `KEY` is always neutral;
  - the variant is `KEY@joke`;
  - `Loc.t()` returns the variant when the pref is on and the variant exists;
  - voice follows the same rule (`voice/<lang>/<id>@joke.ogg`);
  - a lint checks that every `@joke` has a base and identical placeholders.

  Never use `msgctxt` for this. [D L6][D]
- **LOC-07 MUST** Every Steam-facing surface is all-ages: achievement names, descriptions and icons, capsules, Rich Presence, store text. Profanity lives only in the game. [W §0.5][W] [R §3][R]
- **LOC-08 MUST** Tick no language on Steam that is machine-translated and unreviewed. AI translation is disclosed (LEG-07). UI containers budget 40% extra text width. [R §4][R] [D L8][D]

## 12. Security (SEC)

- **SEC-01 MUST NOT** `load()` any `.tres`, `.res` or `.scn` that a player or an outside tool could have edited. *Why:* embedded scripts run on load. [A R5.5][A]
- **SEC-02 MUST NOT** Run `str_to_var`, `ConfigFile.parse`/`load`, `bytes_to_var_with_objects`, `get_var(true)` or `store_var(..., true)` on external data. CI greps for these names outside an allowlist. *Why:* on 4.7.2, `str_to_var` and `ConfigFile` were shown to instantiate objects. [D §6][D]
- **SEC-03 MUST** PO files follow LOC-03. Mods are not supported at 1.0. If they ever are, they are data-only and go through the same JSON loaders, never PO, `.tres` or scripts.
- **SEC-04 MUST NOT** Use PCK encryption, the Steam DRM wrapper or custom copy protection. No secret ever lives in the client. *Why:* PCK encryption is effort, not a barrier; it broke a Deck Linux runtime; the DRM wrapper delays Proton support. [D X6][D] [R R57-R58][R]
- **SEC-05 MUST** The publisher Web API key never appears in the client, the repo or a CI log. It lives in a secret store that only the drift-check job uses. The game never calls `SetUserStatsForGame`. [W R9, T5-T6][W]
- **SEC-06 MUST** Keep secrets out of `export_presets.cfg` (credentials go in the ignored `export_credentials.cfg`). Never put `steam_appid.txt` in a depot or a CI build. [A R13.1][A] [W §1.1][W]
- **SEC-07 MUST** The game's only network traffic is opt-in crash reporting, scrubbed in `before_send`. There are no runtime AI calls. *Why:* the "no live-generated AI" disclosure must stay true. [A R12.5][A] [R R28][R]
- **SEC-08 SHOULD** The save hash is corruption detection, not anti-cheat. Build no anti-cheat and no server validation of achievements. [D S3][D] [W R9][W]

## 13. Platform layer and Steamworks (STM)

- **STM-01 MUST** Use the GodotSteam **GDExtension** (`v4.23.2-gde` or newer) with the stock 4.7.2 editor and export templates. Pin it in `versions.toml` and vendor the binaries with checksums. Never mix it with GodotSteam's precompiled builds; the precompiled 4.7.2 variant is the fallback only. Prove the load and the overlay on 4.7.2 before the first Steam milestone. **(4.7!)** [W G1-G2][W]
- **STM-02 MUST** `Platform` is an autoload that always processes. It picks the backend:
  - `SteamBackend` when the build has the `steam` feature tag and init succeeds;
  - `NullBackend` otherwise;
  - `FakeBackend` in tests.

  The interface is `start/shutdown/is_online/unlock/set_stat/inc_stat/get_stat/flush/rich_presence/hardware/text_input_request/glyph_family`, plus the signals `achievement_confirmed`, `store_failed` and `overlay_toggled`. [W §7][W]
- **STM-03 MUST** `core/platform/backends/steam_backend.gd` is the only file that contains `Steam.`. A CI grep enforces this. [W L1][W]
- **STM-04 MUST** Init sequence:
  1. In release Steam builds, call `restartAppIfNecessary(APP_ID)` and quit if it returns true.
  2. Call `steamInitEx(app_id, false)`, with auto-init and embedded callbacks off.
  3. Call `run_callbacks()` every `_process`.

  [W §1.3][W]
- **STM-05 MUST** When Steam is absent, the game degrades to `NullBackend` and logs the reason. A malformed config (bad app id, SDK mismatch) fails loudly in dev and CI. The debug overlay shows the active backend. [W G4, L5][W]
- **STM-06 MUST** `NullBackend` persists the achievements mirror and replays its unlocks into Steam at the next Steam launch. It is not a stub that returns true. [W L4][W]
- **STM-07 MUST** Test the overlay (Shift+Tab) in a release export with the real app id, on Windows and on the Deck, before any build review. The sim pauses on `overlay_toggled(true)` and on focus loss. [W O1-O2][W]
- **STM-08 MUST** Use the current APIs:
  - detect hardware with `isRunningOnSteamHardware()`;
  - never call the removed `isSteamRunningOnSteamDeck()` or `requestCurrentStats()`;
  - never poll `isOverlayEnabled()` at startup.

  **(4.7!)** [W O3-O4, R1][W]
- **STM-09 MUST** InputMap is the only input path. Glyphs come from a static atlas per family (deck, xbox, playstation, switch, kbm), chosen by the last device used, with 0.5 s of hysteresis. No keyboard or mouse glyph shows while a pad is active, and no "Press E" is hardcoded. [W I1][W] [R R73][R]
- **STM-10 MUST** Every text field calls `showFloatingGamepadTextInput` when a pad is active. The default controller configuration reaches all content (menus, workshop, soul swap, mission select) without the player changing a setting, and it is uploaded as the default Steam Input config. [W I3, I5][W] [R R72, R74][R]
- **STM-11 MUST** Choose the renderer by measurement: test `d3d12` and `vulkan` under Proton on a real Deck, and ship the better one as the default. The spike runs `d3d12`; Valve recommends Vulkan on the Deck. **(4.7!)** [R R63][R] [W §1.4][W]
- **STM-12 SHOULD** Set Rich Presence from localised tokens (`#InMission`, `#FreeRoam`, `#BossFight`) plus a few keys. Update it on state changes only, check the return value, and never include spoilers. [W P1-P2][W]
- **STM-13 MUST** Until the real App ID exists, app 480 is used for plumbing tests only. `steam_appid.txt` sits only beside editor and dev builds. [W §1.3][W]

## 14. Achievements pipeline (ACH)

- **ACH-01 MUST** The single source is `steam/achievements/achievements.json` (schema `gtai.achievements/1`). It holds `languages`, `stats`, and `achievements`, each achievement with `id`, `block`, `name`, `desc`, `hidden`, `stat`, `trigger`, `missable`, `icon` and `source`. [W §4.1][W] [^steamdir]
- **ACH-02 MUST** Ids match `ACH_[A-Z0-9_]{3,44}` and are immutable once published. A published achievement is never deleted, only archived. Soul achievements use `ACH_SOUL_<n>_...`, never a working soul name. [W §4.1, Q11][W]
- **ACH-03 MUST** Triggers use a closed grammar, with no scripting:
  - `on`: an `Events` signal;
  - `where`: `eq`, `in` or `gte` on the signal's parameters;
  - `do`: `stat_inc`, `flag` or `unlock`;
  - `unlock_when`: `stat_gte` or `flag_all`.

  [W §4.1][W]
- **ACH-04 MUST** `tools/achievements/gen.mjs` fails the build on any of:
  - duplicate ids, or an id that breaks the regex;
  - missing `english` text;
  - a `story` achievement marked missable;
  - a trigger whose `on` is not in `events.json`, or has no `Events.<name>.emit` site in the code (a dead achievement);
  - a referenced stat that does not exist;
  - a `goal` that differs from the stat's progress max;
  - a hit in the all-ages lint (profanity and real-brand wordlists over name, description and icon brief);
  - a `source` that does not resolve in canon or entities.

  An off-band block mix only warns. [W §4.3][W]
- **ACH-05 MUST** The generator emits:
  - into `build/steam/achievements/`: `definitions.csv`, `localization.csv`, `icons/<ID>_ACHIEVED.png` and `icons/<ID>_UNACHIEVED.png` (256x256), `STATS_TO_CREATE.md`, `UPLOAD_CHECKLIST.md`;
  - `project/core/platform/achievements/ach_ids.gd` (`class_name AchIds`);
  - `project/data/generated/achievements_runtime.json` (triggers and bindings, no text).

  The CSV headers come from templates exported from the partner site, never hard-coded. [W §4.3][W]
- **ACH-06 MUST** Icons:
  - Made from a brief: square, one centred subject, no text, no gore, in the current art direction.
  - The unachieved icon is derived deterministically: Rec.709 luminance with compressed contrast.
  - Acceptance: at 64x64 the icon keeps its edge density, and perceptual hashes are pairwise distinct.
  - Provenance is logged (LEG-05).

  [W §4.3][W]
- **ACH-07 MUST** Gameplay only emits `Events`. `AchievementTracker` is an engine-free `RefCounted` owned by `Platform`. It evaluates triggers, owns the counters, and calls `Platform.unlock`, `set_stat` and `flush`. Gameplay never calls Steam, `Platform` or the tracker. [W E1-E3][W]
- **ACH-08 MUST** Unlocks and stores:
  - `unlock(id)` is idempotent and checks `getAchievement` first;
  - after an unlock, flush after a 2 s debounce;
  - flush stats at checkpoints, at most once per 60 s, and on quit and `WM_CLOSE_REQUEST`;
  - never store per kill, per frame or per damage tick;
  - a failed store stays pending and retries at the next checkpoint.

  [W R2-R8][W]
- **ACH-09 MUST** Keep a mirror at `user://device/achievements_mirror.json` (`{unlocked, stats, pending}`):
  - in Steam builds it is an outbox, reconciled by union at startup;
  - in Null builds it is the store;
  - it never goes in the cloud.

  [W E4][W]
- **ACH-10 MUST** The tracker computes run-scoped conditions (no-hit, all four forms in one fight) from events such as `encounter_started`, `encounter_ended` and `damage_taken`, never by sampling nodes. [W E5][W]
- **ACH-11 MUST** Design 30-38 achievements:

  | Block | Count |
  |---|---|
  | story | 10-12 |
  | soul | 8-10 |
  | absurd | 8-10 |
  | mastery | 3-4 |
  | meta | 1-2 |

  Story achievements are never missable, and twist-bearing ones are Spoiler. Only `absurd` and `mastery` may be missable, each with a noted retry path. [W §3][W]
- **ACH-12 MUST** The manual steps follow `UPLOAD_CHECKLIST.md`:
  1. Create the stats by hand.
  2. Run Bulk Import.
  3. Click "Save imported data".
  4. Publish.
  5. Enable the Steam Achievements feature.

  This takes about 5 human minutes. No browser automation of the partner site. [W §4.4][W]
- **ACH-13 SHOULD** A drift check after each publish diffs `GetSchemaForGame` against the JSON. A `STAT_SCHEMA_VERSION` stat gates deliberate wipes. Before release, the debug overlay lists unlock state, and a developer-only set holds test achievements. [W R10, T5, §2.3][W]

## 15. Testing and CI (TST)

- **TST-01 MUST** Five test layers run headless from `just test`: unit, integration (systems with fakes), scenario/replay, and parity. The fifth layer, golden images, runs in a separate rendering job. [A R11.1][A]
- **TST-02 MUST** Use one test framework, pinned and proven on 4.7.2. A one-hour spike in Phase 2 week 1 picks gdUnit4 v7 or GUT 9.7.1; never use both. [A R11.2-11.3][A] [^test]
- **TST-03 MUST** Scenario and parity runners are `SceneTree` scripts that return a non-zero exit code on failure and reject unknown arguments. *Why:* the engine silently ignores unknown args. [A R11.4, R11.8][A]
- **TST-04 MUST** CI runs five jobs on every push:
  1. **lint**: gdformat, gdlint, file size, banned-API grep, `Steam.` grep, data lint, PO lint, the achievements generator.
  2. **import**: `--import`, then load every file, then a reimport-clean check (`git status --porcelain` empty).
  3. **tests**.
  4. **native matrix**.
  5. **Windows export** plus the PCK audit.

  [A R11.6][A] [D I4][D]
- **TST-05 MUST** Plant a mutation for each suite that guards the sim, parity or the tracker, so each suite proves it can fail. [A R11.9][A]
- **TST-06 MUST** Achievements are tested end to end:
  - tracker replay: golden event logs produce exact unlock sets;
  - the generator has its own Node tests;
  - one contract suite runs against both `NullBackend` and `FakeBackend`;
  - a Steam smoke checklist (init, unlock a test achievement, store, read back) runs from the debug menu before each release candidate.

  [W T2-T4][W]
- **TST-07 MUST** CI never needs a Steam client, never writes `steam_appid.txt`, and never logs the publisher key. [W T1, T6][W]
- **TST-08 SHOULD** Run most jobs on Linux, and MSVC parity and export on Windows. Golden images are captured after `frame_post_draw`, compared by per-pixel threshold plus a percent-differing budget, and stored in LFS. [A R11.5, R11.7][A]

## 16. Telemetry, crash and hitch recording (TEL)

- **TEL-01 MUST** `Log` has levels, categories, a ring buffer, a `user://logs/` file sink and a flush on exit. `push_error` and `push_warning` route through it. [A R12.1][A]
- **TEL-02 MUST** A dev overlay exists from the first playable, gated by feature tag. It shows:
  - frame avg, p99 and max;
  - actors per tier, draw calls, native step ms, tick;
  - the last 50 events;
  - the active backend and the achievement state.

  It is built on `Performance.add_custom_monitor`. [A R12.2][A]
- **TEL-03 MUST** Every build, release included, records hitches locally: each frame over 25 ms goes to `user://logs/hitches.jsonl` with the streaming and native counters. The 165-440 ms stall class stays a standing risk until it is root-caused with WPR or PIX on an idle machine. [G][G] [A R12.2][A]
- **TEL-04 MUST** Integrate crash reporting before any external playtest (the Sentry Godot GDExtension needs 4.5+). Prove it with a forced native crash under Proton on a Deck. [A R12.3][A]
- **TEL-05 MUST** Produce symbols: a symbol-bearing template build, or at least the GDExtension PDBs, uploaded and archived for every shipped build. PDBs never go in a depot. [A R12.4][A]
- **TEL-06 MUST** Reporting is off until the player opts in. Turn Sentry's auto-init off, and scrub paths and usernames in `before_send`. The privacy policy covers it (LEG-10). [A R12.5][A]
- **TEL-07 SHOULD** A crash report attaches the replay of the last N seconds (seed plus input log). [A R12.6][A]

## 17. Export and packaging (EXP)

- **EXP-01 MUST** Export with `embed_pck=false` and ship `GTAI.exe`, the PCKs, the GDExtension libraries and `steam_api64.dll` side by side. [D X1][D] [^embed]
- **EXP-02 MUST** Split PCKs by domain and change cadence: `core.pck`, `world_<district>.pck`, `music.pck`, `voice_<lang>.pck`, `loc.pck`, later `dlc_*.pck`.
  - Mount them in an autoload's `_init()` with `load_resource_pack()`.
  - New content gets a new PCK.
  - Each PCK stays at or under 1 GB.

  [D X2][D] [R R53-R54][R]
- **EXP-03 MUST** Keep source paths stable and never reorder them. *Why:* PCK data is sorted by path, and one early insertion left 0 of 34 chunks reusable. [D X3][D]
- **EXP-04 MUST** Commit `export_presets.cfg` with three presets:
  - `windows-dev`: debug template, symbols, `devtools` tag;
  - `windows-steam`: release template, `steam` tag;
  - `linux-steam`: only if Linux is decided.

  The `exclude_filter` covers `tests/*,dev/*,tools/*,addons/<testfw>/*`. GodotSteam files ship only in the Steam preset. [A R1.4, R13.4][A] [W L2][W]
- **EXP-05 MUST** Audit every export by parsing the PCK v4 table of contents. Assert:
  - no source PNG or WAV;
  - no `dev/`, `tests/`, `_chars/` or evidence files;
  - every `include_filter` file is present;
  - each folder is within its size budget;
  - the file count is as expected.

  [D X5][D]
- **EXP-06 MUST** Shipping builds come from one pinned runner on Godot 4.7.2 exactly. `.godot/imported` is a cache. Let Steam do the diffing; Godot patch PCKs are an emergency channel only. [D I1, X4][D]
- **EXP-07 MUST** Gate dev-only code twice: behind `OS.is_debug_build()` or the `devtools` tag, and by exclusion from the release export. Custom tags do not exist in the editor. [A R13.2][A]
- **EXP-08 MUST** On the Deck, default to 1280x800 with `canvas_items` stretch and `expand` aspect. Test 1280x720, 16:10 and ultrawide. [R R70][R]
- **EXP-09 MUST** Generate `THIRD_PARTY_NOTICES.md` at export and show it in Credits. It includes:
  - Godot's MIT text and engine notices (`Engine.get_license_info()`, `Engine.get_copyright_info()`);
  - GodotSteam's MIT licence;
  - font OFL texts, audio and plugin licences;
  - an "AI-assisted content" section.

  [R R90-R92][R]
- **EXP-10 MUST** Depots carry no `steam_appid.txt`, `.pdb`, editor files or logs. Set `FileExclusion` in the depot VDF, and run a `"Preview" "1"` dry run first. Tick the VC++ redistributable only if a clean VM proves the DLL needs it. [R R52, R59-R60][R]

## 18. Steam release and metadata artifacts (REL)

- **REL-01 MUST** All Steam metadata lives under `steam/`. `steam/manifest.json` tracks every artifact below: id, path, spec, owner, status, due date and sha256. [R §13][R]
- **REL-02 MUST** Onboard by T-26w, as a legal name or entity that matches the bank and tax records (tax verification can take up to 30 days). Pay the $100 fee at least 21 days before release. [R R1-R6][R]
- **REL-03 MUST** Fix the final name before the first store-page review, because the name locks there (LEG-01). [R R7][R]
- **REL-04 MUST** Coming Soon is public for at least 2 weeks before release; aim for T-16w. Check the page in Store Beta Mode first, because publishing pushes every asset public. [R R6, R46][R]
- **REL-05 MUST** Review and release order:
  1. Submit the store presence for review.
  2. Submit the build, at least 7 business days before it is needed.
  3. Press Release yourself, on a weekday.

  The release date cannot change inside the last 2 weeks. [R R40-R44][R]
- **REL-06 MUST** Store media:
  - Capsules: game art, the logo and an optional subtitle only; PG-13, no gore. The logo is composited in code, never typed by a model.
  - Screenshots: at least 5 gameplay captures taken by script, with at least 4 marked all-ages.
  - Trailers: at least one, gameplay first. It must not still be converting at release. A gore-trimmed trailer is restricted by country.

  [R R11-R14, §3][R]
- **REL-07 MUST** Store text and settings:
  - The text describes only features in the launch build, with no links and no GTA or other product references.
  - Tags: 5-20.
  - The accessibility wizard is filled honestly.
  - Controller support is declared "Full" only if everything, including text entry, works on a pad.

  [R R15-R19][R]
- **REL-08 MUST** Builds and branches:
  - Tick only the OSes you test: Windows only, unless Linux is real.
  - The `default` branch carries a near-final build.
  - Keep beta branches `internal`, `deck-test` and `hotfix`; every post-release update goes through a beta first.
  - Closed tests use Steam Playtest.

  [R R42, R50-R56, R61-R62][R]
- **REL-09 MUST** Treat Deck Verified as a build requirement:
  - 30 fps at 800p on default settings;
  - text at least 9 px at 1280x800 (target 12 px);
  - correct glyphs and the on-screen keyboard;
  - no launcher and no mouse-only screen.

  Request the Deck review once the build review passes. [R R70-R78][R]
- **REL-10 MUST** Derive the system requirements from measured runs. Use a build account that holds only Edit App Metadata and Publish rights, and build with `steamcmd +login <builder> +run_app_build ..\scripts\app_build_<APPID>.vdf +quit`. [R R9, R52][R]
- **REL-11 SHOULD** Price all 37 currencies; a missing currency makes the game unavailable there. A launch discount is 10-15%, with a maximum of 40%. [R §12][R]

**Store asset specs** [R §3][R] [W §0][W]

| Asset | Size (px) | Format | Rule |
|---|---|---|---|
| Header capsule | 920x430 | PNG/JPG | key art + legible logo |
| Small capsule | 462x174 | PNG/JPG | logo nearly fills it; legible at 120x45 |
| Main capsule | 1232x706 | PNG/JPG | key art + logo, no other text |
| Vertical capsule | 748x896 | PNG/JPG | sale pages |
| Library capsule | 600x900 | PNG/JPG | logo required |
| Library header | 920x430 | PNG/JPG | falls back to the header capsule |
| Library hero | 3840x1240 | PNG | no text; 860x380 safe area in the centre |
| Library logo | 1280 wide and/or 720 tall | PNG, transparent | logotype only |
| Shortcut icon | 256x256 or 512x512 | ICO/PNG | from the logomark |
| App icon | 184x184 | JPG | no alpha (alpha turns black) |
| Page background (optional) | 1438x810 | PNG/JPG | dim, ambient |
| Screenshots (5 or more) | 1920x1080 minimum, 16:9 | PNG/JPG | gameplay only; 4 or more all-ages |
| Trailer | up to 1920x1080 | H.264 + AAC, .mp4 | 30/60 fps, 5 Mbps or more, 44.1/48 kHz |
| Event cover / header | 800x450 / 1920x622 | PNG/JPG | announcements |
| Description images | 1170 wide | PNG/JPG/GIF/WEBP | under 5 MB each, under 15 MB total, animations 12 s max, alt text |
| Achievement icons | 256x256 (min 64) | PNG | achieved in colour, unachieved grey; all-ages |

**Metadata artifacts manifest** (paths are under `steam/`. Owner: H = owner, C = agent/pipeline, L = counsel. T = release day.) [R §13][R]

| ID | Artifact | Path | Owner | Due |
|---|---|---|---|---|
| M01 | Partner account, NDA + SDA, bank, tax, ID selfie | portal (status in `manifest.json`) | H | T-26w |
| M02 | App fee receipt + App ID | `manifest.json` `appId` | H | T-24w |
| M03 | Title memo + trademark clearance | `legal/title-memo.md` | H+L | T-20w |
| M04 | Logo master + library logo | `store/logo/` | C | T-20w |
| M05 | Capsule set (7 images per the asset table) | `store/capsules/` | C | T-16w |
| M06 | Shortcut + app icons | `store/icons/` | C | T-16w |
| M07 | Screenshots + `all-ages.txt` list | `store/screenshots/` | C | T-14w, refresh T-6w |
| M08 | Gameplay trailer + gore-trimmed DE variant | `store/trailers/` (LFS) | H+C | T-14w / T-6w |
| M09 | Short description, About, description images | `store/text/en.md` | C | T-16w |
| M10 | Tags, accessibility answers, controller declaration | `store/basic-info.json` | H | T-16w / T-6w |
| M11 | Language matrix (interface/audio/subtitles) | `store/languages.json` | H | T-8w |
| M12 | System requirements + benchmark reference | `store/sysreq.md` | C | T-8w |
| M13 | Content disclosure sheet | `content/disclosure-sheet.md` | C | T-8w, per build |
| M14 | Satire memo | `content/satire-memo.md` | H+C | T-8w |
| M15 | Content survey answers (saved copy) | `content/survey.md` | H | T-6w |
| M16 | AI disclosure text + provenance log | `content/ai-disclosure.md`, `ai-provenance/` | C+H | continuous; final T-6w |
| M17 | Achievements JSON, CSVs, icons, stats table | `achievements/` -> `build/steam/achievements/` | C (upload H) | T-8w |
| M18 | Rich Presence token file | `richpresence/<lang>.txt` | C | T-8w |
| M19 | SteamPipe scripts (`app_build_<APPID>.vdf`, `depot_build_<ID>.vdf`, `upload.ps1`) | `build/` | C | T-8w |
| M20 | Depots, launch options, branches record | `build/config.md` | H | T-6w |
| M21 | Default Steam Input config | `input/` | C+H | T-6w |
| M22 | `THIRD_PARTY_NOTICES.md` + credits | generated at export | C | T-8w |
| M23 | Privacy policy (own site URL) | `legal/privacy.md` | H | T-8w |
| M24 | Deck test report | `qa/deck-<date>.md` | H | T-6w, T-2w |
| M25 | Price table + launch discount | `store/pricing.json` | H | T-4w |
| M26 | Event art, launch post, patch-notes template | `store/events/` | C | T-1w |
| M27 | Demo App ID + demo build (if Next Fest) | `manifest.json` `demoAppId` | H+C | Fest -3w (-5w for press preview) |

## 19. Legal and content (LEG)

- **LEG-01 MUST** Get a trademark search and counsel's opinion on the public title by T-20w, and keep a fallback title ready. "GTAI" is one letter from Take-Two's "GTA". Until cleared, "GTAI" is a working name only and appears on no public surface. [R §14.7][R] (Q1)
- **LEG-02 MUST** Avoid GTA trade dress: no GTA-like logo composition, fonts, colours, key-art layout, cop-car or character designs. Use no real brands, people or likenesses; all brands are invented. [R §14.8, §14.10][R]
- **LEG-03 MUST** Use no real DoD seals, insignia, service marks, unit names or officials. The antagonist is a fictional contractor, and the Pentagon is labelled fictionally if in doubt. [R R97, §14.9][R]
- **LEG-04 MUST NOT** Prompt a model with a franchise name, a real artist or a GTA key-art reference. Check outputs for look-alikes of GTA art. [R R31][R]
- **LEG-05 MUST** Log provenance for every AI asset in `steam/ai-provenance/<yyyy-mm>.jsonl`, one line per asset: `{file, sha256, tool, model, date, prompt_ref, references, seed, human_edits, accepted_by, ships_in}`. Masters have their own manifest (GIT-06). CI checks that every shipped image and audio file has a provenance line or a `human:` line. [R R30][R] [D R1][D]
- **LEG-06 MUST** Answer the content survey (General, Mature, Generative AI) from the disclosure sheet, which is updated per build.
  - Declare Frequent Violence or Gore and General Mature Content.
  - Disclose content that is in the build but not reachable (cut content, debug rooms).
  - Never tick Adult Only Sexual Content.

  [R R20-R25][R]
- **LEG-07 MUST** Disclose pre-generated AI for art (Nano Banana, OpenAI image via Codex), audio (TTS), narrative (LLM-assisted), localisation and marketing. Keep "no live-generated AI" true. A patch that adds AI content means re-opening the survey. [R R26-R33][R]
- **LEG-08 MUST** The satire aims at institutions, corporations, the military and the genre, never at protected groups. Each borderline joke is tied to a point in the satire memo. [R §5, §14.2][R]
- **LEG-09 MUST** Regional rules:
  - Germany: keep a gore-reduction toggle and a country-restricted trailer.
  - Australia: no drug use tied to rewards, and no real drug names as power-ups.
  - Indonesia: a possible ban is accepted.
  - Pay for no ESRB, PEGI or USK rating, and enter no IARC numbers.

  [R R34-R39][R]
- **LEG-10 MUST** Publish a privacy policy before any data leaves the device, linked in Basic Info. No custom EULA at 1.0 unless counsel advises one. Use the Steam logo and Deck badges only under Valve's branding rules. [R R93-R96][R]
- **LEG-11 SHOULD** Record the human-authored layer (rig, composition, procedural motion, writing). Pure AI output may not be copyrightable. [R §6][R]

## 20. Performance budgets

Measured figures are from the exported release build on the Ryzen 7800X3D (gate runs, 2026-11-02). "Provisional" means set here, to be confirmed by a Phase 2 measurement.

| Budget | Target | Hard limit (fails WLD-08) | Measured today | Source |
|---|---|---|---|---|
| Frame, desktop | 60 fps (16.6 ms) | 1% low above 45 fps | 1% low 148-295 fps | [G][G] |
| CPU frame (wall) | p99 5 ms or less | p99 7 ms or less | p99 2.6-3.0 ms | [G][G] |
| Native sim step, 400 actors | 1 ms or less | 3 ms | 0.025 (drive) / 0.093 (riot) ms | [G][G] [C §3][C] |
| Render submit + MultiMesh write | 1 ms or less | 3 ms | write 0.013 ms | [C §3][C] |
| GDScript gameplay (missions, police, HUD) | 2 ms or less | 3 ms (provisional) | not built | [C §3][C] |
| Nav, A*, flow field | 1 ms or less | 2 ms (provisional) | not built | [C §3][C] |
| Streaming, main-thread share | 1 ms average | 1.5 ms slice, 1 activation per frame | 0.6-0.85 ms | [G][G] |
| Worst frame in a swap window | 16.6 ms | 50 ms | 1.8-5.3 ms (reruns); 170.8 ms once (first batch) | [G][G] |
| Hitch log threshold | none | every frame over 25 ms is recorded | isolated 25-45 ms frames | TEL-03 |
| Actors | 260 nominal | 400 cap; rigs: 16 nearest within 14 m | 400 at about 0.8 ms/frame | [C §3][C] [G][G] |
| Rig cost | 0.3 ms for 16 | 1 ms (provisional) | about 0.3 ms | [G][G] |
| Draw | one MultiMesh per layer (5 layers); 8 canvas items per chunk | 9 resident chunks (about 72 items) plus layers (provisional) | as target | [G][G] |
| VRAM, world textures | 300 MB per district | 600 MB resident, RGBA-equivalent (placeholder until a Deck measurement) | evolve 378 MB, cityscale 142 MB | [D T7, G1][D] |
| One texture | none | 4096 px per side, 32 MB | peds atlas 43 MB | [D T7][D] |
| RAM, process | set in Phase 2 on the Deck | 2 GB (provisional) | not measured | none |
| Chunk file | 31 KB | 256 KB before compression is considered | 8.03 MB for 256 chunks | [D §5][D] |
| Save | 256 KB per slot | 5 MB total, 8 files per profile | none | [D §6][D] |
| Build size | core + world PCKs 1.5 GB or less at 1.0 (provisional) | 1 GB per PCK | 34.8 MB PCK, 144 MB exe | [D X1-X2][D] [R R53][R] |
| Voice | about 48 MB per language | own PCK | none | [D A8][D] |
| Cold start to menu | 3 s or less (provisional) | 10 s | 1-1.5 s (spike) | STATE |
| Steam Deck | 40 fps (25 ms) at 1280x800, default settings | 30 fps (Verified); text 9 px or more (target 12) | not measured | [R R76][R] [C §3][C] [^deck] |
| `storeStats` | at checkpoints | at most once per 60 s (unlock debounce 2 s) | none | [W R3][W] |

## 21. Where we stand

The spike against this standard, ordered by what Phase 2 must fix first. E = `gtai-spike/evolve/project`, C = `gtai-spike/cityscale`. Every figure is from the reports' gap tables.

| # | Area | Spike today | Rules | Phase 2 action |
|---|---|---|---|---|
| 1 | Repo | Nested repos inside the kiro repo; no `.gitattributes`; `autocrlf=true`; 386 of 955 tracked files are `.import`; 35 files with CRLF-only churn; `.git` is 102 MB after 24 commits; no LFS | GIT-01..07 | Create a fresh game repo with the section 22 setup; do not carry over the spike history |
| 2 | Monolith | `main.gd` is 4,267 lines, 59% of the game, `_ready` 217 lines; `sim_gd.gd` 849, `robot.gd` 746, `cutrig.gd` 617, `arsenal.gd` 551 | GDS-03, LAY-01, ARC-04 | Port into about 25 feature files under a `world.gd` root of 150 LOC or less; never copy `main.gd` |
| 3 | Gates | No `[debug]` warnings, no gdlint, no test framework, no CI (only `bench/parity.gd`) | GDS-02, GDS-04, TST-01..04 | Turn the gates on before the first ported feature |
| 4 | Events | 0 `signal` declarations, 0 `.emit(`; `wanted` written at 8 sites, `cash` at 3 | ARC-05..08 | `Events` autoload + `events.json`; setters that emit |
| 5 | Determinism | RNG seeded from the wall clock; global `seed(7)`; about 32 global RNG calls; bench uses a variable dt | SIM-01..05 | Fixed tick, per-system RNG, replay log |
| 6 | Dev harness | About 20 test modes inside `main.gd` (`_selftest_step`, `_soultest_step`, ...) | EXP-07, TST-03 | Move to `tests/scenarios/` and `dev/bots/`, behind feature tags |
| 7 | Native | One 851-LOC `city_sim.cpp` with `godot::` types; constants duplicated in `.gd`/`.h`; godot-cpp is an ignored `master` checkout (e103d38); Windows only; no sanitizer | NAT-03..05, NAT-08 | Plain-C++ core + binding; submodule + `GODOT_CPP_VERSION`; generated constants |
| 8 | Parity (keep) | GDScript ref vs native: 40 snapshots over 1200 steps, bit-identical | NAT-06 | Promote to a CI gate with a planted mutation |
| 9 | Stalls | 165-440 ms whole-process stalls, never root-caused; 25-45 ms frames; pipeline compiles up to about 200 ms | TEL-02..03, WLD-07 | Hitch recorder in every run; WPR/PIX on an idle box; prewarm |
| 10 | Export | `embed_pck=true`, `all_resources`, empty `exclude_filter`; 14 MB `_chars/` ships; no audit; exe 144-160 MB | EXP-01..05, LAY-04 | Unembedded split PCKs, exclude filter, PCK audit |
| 11 | Platform | No Steam, no platform layer, no achievements; spike runs `d3d12`; ARM64 dev box vs x64 `steam_api64.dll` | STM-01..13, ACH-01..13, NAT-11 | `Platform` + `NullBackend` stub on day one; GodotSteam proof on x64 |
| 12 | Data | 63 JSON files, no schema, no id lint, no versions, numbers as floats | DAT-02..05 | Schemas + typed loaders + data lint |
| 13 | Chunks | 256 x 31 KB bare `var_to_bytes`, no header, version or hash (the generator is byte-deterministic) | AST-11..12 | `GTCH` header + double-bake CI |
| 14 | Saves/settings | No saves (`user://` used 0 times); settings = window size only | SAV-01..10 | Build the container + protocol before any persistent progress exists |
| 15 | Localisation | `tr(` used 0 times; 8 hardcoded `.text =` | LOC-01..06 | `Loc.t()` from the first UI string |
| 16 | Textures | 378 MB of VRAM in E; 128 px/m art drawn at 32-64; mips on 202/340 under a non-mip filter; `detect_3d` on every file; 11 textures over 2048 px | AST-01..06 | Importer defaults, filter fix, density decision (Q9) |
| 17 | Deck | Untested; viewport 1280x720 with `aspect="keep"` (letterboxes at 16:10); no glyphs; no keyboard call | EXP-08, STM-09..11, REL-09 | Real-Deck run at the first playable |
| 18 | Audio | WAV only, levels by RMS; 1 h of music as WAV would be about 317 MB | AST-07..09 | Ogg path, LUFS pipeline |
| 19 | Fonts | 0 TTF/OTF; the default font covers only part of Latin-1 | AST-10 | Bundled fonts + fallback chain |
| 20 | Duplication | `chardefs.gd` identical in E and C; `cutrig.gd` exists in both and has diverged | LAY-01, DAT-01 | One `features/characters/` module |

## 22. Day-one setup checklist (the real game repository)

1. **Repo.**
   ```
   git init gtai
   git -C gtai config core.autocrlf input
   git lfs install
   ```
   Commit `STANDARDS.md` (copied from here) and `AGENTS.md` before anything else.
2. **`.gitattributes`.** Commit it before any asset:
   ```
   * text=auto eol=lf
   *.gd *.tscn *.tres *.import *.uid *.gdshader *.cfg *.godot *.gdextension *.json *.po *.csv *.md text eol=lf
   *.png *.jpg *.webp *.psd *.wav *.ogg *.mp3 *.glb *.fbx *.ttf *.otf *.mp4 filter=lfs diff=lfs merge=lfs -text
   *.res *.scn *.pck *.dll *.so *.pdb binary
   ```
3. **`.gitignore`.**
   ```
   .godot/  *.translation  export_credentials.cfg  build/  *.pck  project/native/bin/  *.obj  .sconsign.dblite  *.pdb  steam_appid.txt  *.tmp
   ```
4. **Pins.** `versions.toml` holds:
   - Godot `4.7.2-stable` (URL and SHA-256);
   - godot-cpp;
   - gdtoolkit;
   - the test framework;
   - GodotSteam `v4.23.2-gde`;
   - Sentry.

   Then run `git submodule add https://github.com/godotengine/godot-cpp native/godot-cpp`, check out the chosen tag, and write that tag into `native/GODOT_CPP_VERSION`.
5. **Lint.** `pip install gdtoolkit==<pinned>`.
   - `gdlintrc`: `max-line-length: 100`, `max-file-lines: 300`, `function-arguments-max: 5`. Check the key names with `gdlint --dump-default-config`.
   - CI runs `gdformat --check --line-length 100 project/` and `gdlint project/`.
   - Pre-commit runs both.
   - Add `.editorconfig` (tabs, LF, UTF-8) and `tools/canary.gd` for GDS-05.
6. **Warnings as errors.** Add to `project.godot` (verify the names in the 4.7.2 editor):
   ```
   [debug]
   gdscript/warnings/exclude_addons=true
   gdscript/warnings/untyped_declaration=2
   gdscript/warnings/unsafe_property_access=2
   gdscript/warnings/unsafe_method_access=2
   gdscript/warnings/unsafe_cast=2
   gdscript/warnings/unsafe_call_argument=2
   gdscript/warnings/inference_on_variant=2
   gdscript/warnings/return_value_discarded=2
   gdscript/warnings/unused_variable=2
   gdscript/warnings/unused_parameter=2
   gdscript/warnings/shadowed_variable=2
   ```
   In the same file:
   - `application/config/use_custom_user_dir=true`;
   - the custom user dir name;
   - `[importer_defaults]` (Lossless, `detect_3d/compress_to=0`);
   - an explicit canvas texture filter;
   - stretch `canvas_items` + `expand`;
   - `physics/common/physics_ticks_per_second=60`;
   - the 7 autoloads.
7. **Test framework.** Run the one-hour spike (TST-02): gdUnit4 v7 vs GUT 9.7.1, each with a scene-runner test and a headless CI run. Vendor the winner into `addons/` with a `VENDORS.md` line. Add `tests/run_scenarios.gd`, which exits non-zero on failure. Add `justfile` recipes: `lint test parity export audit ach`.
8. **CI.** `.github/workflows/ci.yml`, with the five TST-04 jobs (Linux, plus Windows for MSVC and export):
   - Godot is fetched from the `versions.toml` URL and its hash is checked;
   - run `godot --headless --path project --import` before any test;
   - the export job runs `tools/pck_audit`.
9. **Folder skeleton.** Create the section 2 tree, with `.gdignore` wherever needed. Add `docs/decisions.md` (first line: "adopted STANDARDS.md v1.0"), `docs/determinism.md` and `addons/VENDORS.md`.
10. **Platform layer stub.** Create:
    - `core/platform/platform.gd`, as an autoload with `process_mode = PROCESS_MODE_ALWAYS`;
    - `backends/platform_backend.gd`, holding the interface;
    - `null_backend.gd`, with the mirror file in `user://device/`;
    - `fake_backend.gd`;
    - an empty `steam_backend.gd`, guarded by the `steam` tag.

    Add the CI grep for `Steam.` (STM-03) and the contract test against Null and Fake.
11. **Achievements.** Seed `steam/achievements/achievements.json` with `"schema": "gtai.achievements/1"`, `"languages": ["english"]`, empty `stats` and empty `achievements`. Write `tools/achievements/gen.mjs` with these commands:
    - `validate`, which exits 1 on the first ACH-04 failure;
    - `emit`, which writes empty CSVs with headers from the partner templates once those exist, plus `ach_ids.gd` and `achievements_runtime.json`;
    - `--check`, the CI drift check.

    Also create `data/schemas/events.json`, which ARC-06 and ACH-04 read.
12. **Provenance log.** Create `steam/ai-provenance/README.md` holding the LEG-05 line schema, and an empty `steam/ai-provenance/2026-11.jsonl`. Add `art_src/MASTERS.md`, naming where the masters live. Add the CI check that every shipped asset has a provenance line.
13. **Steam folder.** Create `steam/manifest.json`, listing M01-M27 with status `todo`, and `steam/content/disclosure-sheet.md` with empty sections.
14. **Proof run.** Export `windows-dev`, run the PCK audit, then run the empty scenario suite. All of CI must be green before the first feature is ported.

## 23. Open questions for the owner

Merged from the four reports. Only questions that need a human decision are kept; measurement questions became rules or checklist items.

1. **Public title. RESOLVED 2026-11-02:** the owner rebranded the public title to **RTAI: Uprising** ("Robot Theft A.I."); `gtai` stays internal. LEG-01 still applies: run a quick clearance search on "RTAI" before the store review. Original question: "GTAI" sits one letter from Take-Two's "GTA" mark, and the Steam name locks at the first store review. Do you commission a trademark search and counsel's opinion now, and what is the fallback title? (LEG-01, REL-03)
2. **Legal entity and country.** Sole proprietor under your legal name, or a company? This sets the name on the bank, tax (W-9 vs W-8BEN) and SDA records, and changing it later means re-onboarding.
3. **Platforms and hardware.** Windows plus Proton only, or also a native Linux build? Either way you need a real Steam Deck: will you buy or borrow one? Deck Verified, the renderer choice and crash capture cannot be decided without it.
4. **Release window and Steamworks start.** When do you create the app ($100, which starts the 21-day clock and gives the App ID that real achievement testing needs)? Which Next Fest: 22 Feb-1 Mar 2027 (register by 10 Jan) or 14-21 Jun 2027? A game gets one Next Fest, ever.
5. **Languages at 1.0.** English only, with more languages added as updates? Does any voice-over ship? TTS counts as AI audio. Are achievement texts English-only at launch?
6. **AI that ships, and how it reads on the page.** Confirm the final list: art parts, key art, TTS, LLM text, AI translation, marketing. Confirm the tone of the disclosure Valve may print, and that the OpenAI and Google output terms allow commercial use.
7. **Germany and Australia.** Accept a regional loss, or tune the content (a gore toggle, no drug rewards)? Pursue a formal Australian classification?
8. **Joke profanity.** The default per locale, whether the toggle syncs through the cloud (the spec says yes), and how many voice-over variants.
9. **Texel density.** Is 64-96 px/m for ground and roofs acceptable for the riso grain at boss zoom? It cuts world VRAM about 4x. (AST-06)
10. **New Game+ or mission select.** Is either in scope? This decides whether any story achievement can be missable.
11. **Crash reporting and privacy.** Opt-in Sentry from the first external playtest? That needs a privacy-policy page on a site you own.
12. **Price.** The USD base price, the launch discount, and the regional pricing method.
13. **Repository hosting.** Where does the game repo live (a private GitHub repo?), and what is the budget for LFS storage and bandwidth and for the off-git masters store (NAS or object storage)?

---

**Where the reports conflicted**

[^lfs]: [D R1] waits for a ~1 GB repo before LFS; [A R10.7] says before the first art commit. Picked [A]: retrofitting rewrites history, and evolve reached 102 MB in 24 commits.
[^data]: [A R5.2] prefers typed `.tres` Resources for balance data; [D D1/D5] makes JSON the source and bans AI-written `.tres`. Picked [D]: agents write most of the data, `.tres` diffs carry random sub-resource ids, and [A]'s own open questions 6-7 lean to JSON.
[^embed]: [W §1.3] says `embed_pck=true`, and [A R13.4] calls it fine. Picked [D X1] (`false`): measured PCK chunk reuse and Valve's packing guidance favour separate, domain-split packs.
[^autoload]: [A R3.1] caps autoloads at 7, including `DebugTools`; [W] adds `Platform`, `GameEvents` and `AchievementTracker`. Merged: `GameEvents` becomes [A]'s `Events`, the tracker is owned by `Platform`, and `DebugTools` leaves the autoload list, because an autoload pointing into the excluded `dev/` folder would break release exports.
[^bus]: [A R4.4] makes the bus a MAY with typed params; [W E1-E2] makes it a MUST with payload dictionaries. Picked MUST (achievements need it), with typed params ([A R4.2]); the tracker turns the arguments into a dictionary using the parameter names in `events.json`.
[^save]: [W C3] says "temp, fsync, rename" with `save_N.json`; [D S5] shows Godot has no fsync and that its Windows rename deletes the target first. Picked [D]'s protocol and file layout.
[^steamdir]: [R §13] puts Steam metadata in the PoF repo (`games/gtai/steam/`), and [W §4.1] puts achievements in `games/gtai/achievements/`. Picked the game repo's `steam/`: the build review compares the build against the survey and the store page, so the metadata must be versioned with the build.
[^test]: [A] names gdUnit4 or GUT; [W] names gdUnit4 or Vest. Vest is dropped (it has no 4.7.x evidence); the choice is made by measurement in week 1.
[^deck]: [C §3] targets 40 fps on the Deck; [R] needs 30 fps for Verified. Both are kept: 30 is the hard limit, 40 the target.

[A]: research/standards/architecture.md
[D]: research/standards/data-and-formats.md
[R]: research/standards/steam-release.md
[W]: research/standards/steamworks-integration.md
[C]: research/godot-city-scale.md
[G]: ../../../gtai-spike/cityscale/GATE.md
