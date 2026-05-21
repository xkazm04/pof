# Scenario Run — 2026-05-21 (SP-E: packaged-build launch smoke-test)

**Result:** PASS — the packaged build launches and the real game process survives a 25 s window.

## Smoke-test

The SP-C staged build (`…\PoF\Saved\StagedBuilds\Windows\PoF.exe`) was spawned
windowed (`-windowed -ResX=1280 -ResY=720 -log`) and observed for 25 s.

- `PoF-Win64-Shipping.exe` (the real game process) alive after 25 s: **true**
- Bootstrap `PoF.exe` exit code: `1` — the staged `PoF.exe` is a thin
  bootstrap that hands off to `PoF-Win64-Shipping.exe`; its own exit code is
  not the health signal. The honest signal is the game process, which stayed
  alive for the full window.
- Spawn error: none.

### Engine log

No log was captured. A packaged build writes under
`%LOCALAPPDATA%\PoF\Saved\Logs\`; that directory was created by the launch but
holds no `PoF.log` — the Shipping target sets `bUseLoggingInShipping = false`
(`PoF.Target.cs`), so logging is compiled out of the Shipping build. An absent
log is therefore expected, not a fault.

## The five vertical-slice success criteria — verdict

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | Packaged Win64 Shipping build launches as a standalone `.exe` | ✅ verified — process launched and survived 25 s |
| 2 | WASD moves the character on a flat level with collisions | ⛔ Not verifiable — no level |
| 3 | LMB triggers the attack ability; montage plays | ⛔ Not verifiable — nothing to run |
| 4 | Attack hits a dummy enemy and reduces its Health | ⛔ Not verifiable — no placed enemy |
| 5 | Enemy at Health ≤ 0 is destroyed; a loot pickup spawns | ⛔ Not verifiable — nothing to run |

**Why #2–#5 are not verifiable.** The UE project has no playable content:
zero `.umap` files, no `GlobalDefaultGameMode` and no default/startup map, no
Blueprints deriving from the C++ gameplay classes, and no placed actors. SP-B
generated the gameplay *systems* as C++ classes and SP-C packaged them, but a
runnable level was never assembled. The packaged build launches a process; it
does not launch a game.

## Next phase — what the full cycle needs

To accomplish the full cycle (an actually-runnable vertical slice that
satisfies criteria #2–#5), the following artifacts and dependencies are
required. This is the scope for the next brainstorm — listed here, not built
in SP-E:

- **A playable level** — a `.umap` with a floor mesh + collision, lighting, a
  `PlayerStart`, and a placed dummy enemy. UE maps are binary assets and cannot
  be authored as text; this needs an editor commandlet / Python editor script,
  or a level constructed at runtime in C++ (the project already has
  `ARPGLevelGenerator`).
- **Blueprints (or C++ class defaults)** deriving from `ARPGPlayerCharacter` /
  `ARPGEnemyCharacter`, configured with meshes, the `AnimInstance`, GAS ability
  grants, and the input mapping context.
- **GameMode + default-map wiring** — `GlobalDefaultGameMode`,
  `GameDefaultMap` / `EditorStartupMap` in `DefaultEngine.ini`, default pawn.
- **Asset dependencies** — at minimum a character skeletal mesh and an
  `IMC_Default` input mapping context wired to `IA_Move` / `IA_Attack`.
- **A verification mechanism** — once a slice exists, automated keyboard
  simulation or an in-engine automation test to check criteria #2–#5. Note
  that observing engine behaviour will also need logging in the build (the
  current Shipping target disables it) or a Development-config build.

**Key open problem for that phase:** PoF's autonomous Claude generates *code*
well, but UE *content* (maps, Blueprints, meshes) is binary and cannot be
authored as text. The next phase must decide how content is created — editor
scripting, procedural C++ construction, or a manual content checkpoint.
