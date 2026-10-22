# Findings — defects in the source data and in the loop's foundations

Not PoF content defects (those are the backlog's business) — these are facts about the reference
data and about the loop's own machinery.

## F-G2-1 — the loop's memory had a single point of failure (2026-10-22)

The machine was reset around 2026-10-19 (`~/Documents` holds only junctions re-created 15:19 that
day). Gone with it: this vault, the devilutionX clone, `~/.pof/pof.db`, the UE project, the codex
ledger. No backup existed anywhere — C: is the only drive, and nothing was in Desktop/Downloads
or any sync folder.

What survived did so **because it was in the repo**: the mappings, the canon profile, the 34+
catalog scripts, the fleet-memory summary of W00–W107, and — by accident — the reference pin,
embedded in the canon `refs:` strings. Everything the SKILL designated as "memory" was lost;
everything it designated as "engine" survived.

The real finding is about the design, not the disk: a loop whose product is *the adjustments*
kept its ledger of adjustments only outside version control. `Adjustments.md`, `Path/` and
`Backlog.md` were the whole point of the exercise and they were the only part with no redundancy.

## F-G2-2 — `status.ts` could not report a cold store (2026-10-22, fixed)

The GATE snapshot died on an empty store instead of describing it: `descentSim.ts:771` throws
`the supplied wrappers have no d1-class-warrior aggregate`, which the `combat-map` handler's pool
raised through `status.ts`. So the one tool a human reads before every wave was unusable in
precisely the situation that most needs it. Fixed in `scripts/diablo/catalogs/pool.ts`
(`resolveStalenessPool`): a handler pool is built only when something is promoted to compare, a
pool that cannot be built reports its reason, and staleness then prints as UNKNOWN rather than
as "none". See [Adjustments](Adjustments.md) A-G2-1.

## Source-data sentinels still flagged at the restored pin

Unchanged from generation 1, re-confirmed by runs #1/#2 — recorded here so a later wave does not
re-discover them: `monsterPack = None ×29`; `power3/power4.value1/value2 = -1`; `adjMana = -1`;
`spell = Null` on each class row. Unresolved links: 6 (`bestiary:d1-MT_HORKDMN`,
`d1-MT_DEFILER`, `d1-MT_NAKRUL`; `spellbook:Mana`, `spellbook:Search`; `items:LGTFORGE`) — the
three monsters and LGTFORGE are Hellfire-scoped, which generation 1 established.

## F-G2-3 — the device cannot host the Unreal Editor natively (2026-10-22, W109)

This machine is an **ARM64 PC** (`systeminfo`: "ARM64-based PC"; ARMv8 Family 8 Model D87, vendor
NVIDIA — an N1X with a 6144-core Blackwell RTX GPU, 64 GB RAM, 529 GB free on C:).

Epic's UE 5.8 Windows ARM64 documentation is explicit and current: **"The Unreal Editor is not
supported on ARM64."** ARM64 support is **game targets only**, marked Experimental, and Clang is
not supported for ARM64/ARM64EC targets (MSVC only). Epic's own recommendation is to develop on an
x64 PC and deploy game builds to ARM64 hardware for testing; UE 5.8's Remote Windows Deployment
exists for exactly that. The only native-ARM64 editor anyone has built is a third-party Qualcomm /
Snapdragon Studio fork on a 5.4 branch — not Epic mainline.

What this device CAN do, verified here rather than assumed:

- **x64 user-mode emulation works.** This whole session proves it: `cmd` reports
  `PROCESSOR_ARCHITECTURE=AMD64` while `PROCESSOR_IDENTIFIER` reports ARMv8, and .NET inside an
  emulated process reports `X64` for both process and OS. Prism (Windows 11 build 28000, well past
  24H2) emulates user-mode x64 including AVX/AVX2 since the 2025 update. Kernel-mode drivers must
  be native ARM64 — which is a risk for launcher/anti-cheat components, not for the editor itself.
- **The compiler situation is better than expected.** VS 2022 Build Tools (MSVC 14.44.35207) is
  installed with `bin/Hostarm64/{arm64,x64,x86}` present — a **natively ARM64-hosted compiler that
  targets x64** — and with `lib/{arm64,arm64ec,x64,x86}`, so UE 5.8's stated ARM64 prerequisite
  (the ARM64 build tools component) is **already satisfied**. Whether UnrealBuildTool's
  `VCToolChain` selects the Hostarm64 host rather than emulating the x64 one is unverified and is
  the single biggest unknown for build times here.
- **.NET is ARM64-native** (runtime 8.0.15, `win-arm64`), though no SDK is installed.

Not blocked by any of this: **schema-down parity**. `scripts/snapshot-ue-schema.ts` reads
`<root>/Source/**/*.h` as text — no engine, no compiler, no editor — and its output is committed
(25 types / 187 fields). Restoring the UE project *repository* re-establishes canon `proj-sot`'s
downward direction on its own.

The install itself stops at an interactive wall, not a technical one: the Epic Games Launcher MSI
(v20.3.3, signed by Epic Games Inc., 264 MB, downloaded and verified) needs **elevation**
(`net session` → not elevated; the silent install refused before writing a log), and the engine
download needs an **Epic account sign-in**. Neither can be done unattended.
