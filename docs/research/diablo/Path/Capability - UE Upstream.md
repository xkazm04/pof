---
kind: capability
status: in-progress
requires: []
evidence: "W109 measured UE 5.8 on this ARM64 device: C++ build PASS (63.5 s), headless pythonscript PASS, D3D12 PASS - so the blocker is NOT the ISA. What remains is (a) the UE project itself, on Wolf, and (b) an emulated compiler, because UBT picks its MSVC host from its own process architecture (MicrosoftPlatformSDK.cs:1317) and only a win-x64 bundled .NET is installed"
---

# Capability - UE Upstream

W109's finding is that this node is **two** capabilities that were always conflated, and only one
of them is ARM-blocked:

- **Schema-down parity — NOT blocked.** `scripts/snapshot-ue-schema.ts` reads
  `<root>/Source/**/*.h` as plain text; no engine, no compiler, no editor. And its output is
  committed (`src/lib/catalog/ue-schema.generated.json`, 25 types / 187 fields), so
  `ue-schema-parity.test.ts` runs today. Restoring the UE **project repository** alone — a git
  clone, no engine — fully re-establishes canon `proj-sot`'s downward direction at zero ARM risk.
- **Producing into UE and verifying at runtime — NOT blocked by the ISA, pending the project.**
  W109 measured a working editor on this machine (build, commandlet and D3D12 all pass under x64
  emulation), so what these need is the project from Wolf, not different hardware. The one real
  cost is that every compile is emulated until a native ARM64 .NET drives UBT — see
  `../Findings.md` F-G2-4 for the chain and the one open question.

So the dependency the graph should carry is not "UE" but "a UE **runtime** on reachable hardware".
Split accordingly when W109's probe resolves; see `Waves/W109-ue-on-arm64.md` in the vault.
