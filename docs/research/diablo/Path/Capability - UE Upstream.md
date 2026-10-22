---
kind: capability
status: in-progress
requires: []
evidence: "~/Documents/Unreal Projects/PoF is absent after the 2026-10-19 reset, and this device is an ARM64 PC whose ISA Epic does not support for the Editor ('The Unreal Editor is not supported on ARM64', UE 5.8 Windows ARM64 docs, Experimental, game targets only)"
---

# Capability - UE Upstream

W109's finding is that this node is **two** capabilities that were always conflated, and only one
of them is ARM-blocked:

- **Schema-down parity — NOT blocked.** `scripts/snapshot-ue-schema.ts` reads
  `<root>/Source/**/*.h` as plain text; no engine, no compiler, no editor. And its output is
  committed (`src/lib/catalog/ue-schema.generated.json`, 25 types / 187 fields), so
  `ue-schema-parity.test.ts` runs today. Restoring the UE **project repository** alone — a git
  clone, no engine — fully re-establishes canon `proj-sot`'s downward direction at zero ARM risk.
- **Producing into UE and verifying at runtime — blocked.** Asset production, the C++ build of
  the ARPG module, the functional-test suite and every runtime claim of the W07–W15 kind
  ("the Skeleton kills the player in 28 hits") need a working editor on this machine.

So the dependency the graph should carry is not "UE" but "a UE **runtime** on reachable hardware".
Split accordingly when W109's probe resolves; see `Waves/W109-ue-on-arm64.md` in the vault.
