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

## F-G2-4 — UE builds and runs on this ARM64 device; the ceiling is the toolchain host (2026-10-22, W109)

Measured by `scripts/diablo/ue_arm_probe.ts` against UE 5.8 on a **partial, stalled 31 GB install**
(the launcher never finished: `LauncherInstalled.dat` still reads `"InstallationList": []`). So these
are floor numbers, not the device's best.

| Criterion | Result |
|---|---|
| C++ editor target builds | **PASS** — 7 actions, compile + link of `UnrealEditor-ArmProbe.dll`, UBA over 20 physical cores, **63.5–72.2 s** clean across four runs |
| headless `-run=pythonscript` | **PASS** — the script ran in-engine and wrote its result: `5.8.4-58902052+++UE5+Release-5.8` (12.7 s) |
| D3D12 on the NVIDIA GPU | **PASS** — `Creating D3D12 RHI with Max Feature Level SM5`, editor up in 13–24 s |

So Epic's "The Unreal Editor is not supported on ARM64" is a SUPPORT statement, not a technical
wall: the emulated x64 editor compiles C++, runs commandlets and initialises D3D12 here.

**The real ceiling, and the chain that sets it.** UnrealBuildTool chooses its MSVC host from its own
process architecture — `Engine/Source/Programs/UnrealBuildTool/Platform/Windows/MicrosoftPlatformSDK.cs:1317`,
`RuntimeInformation.ProcessArchitecture == Arm64 ? Arm64 : X64` — and `Build.bat` resolves the
bundled .NET by host architecture, announcing `Using bundled DotNet SDK version: 10.0 win-arm64`.
But this install ships only `Engine/Binaries/ThirdParty/DotNet/10.0/win-x64`. Hence:

1. `Build.bat` dies instantly (`0x80008096`, no output) reaching for a runtime that is not there.
2. Driving UBT under the x64 `dotnet` works, but UBT then selects
   `…/MSVC/14.44.35207/bin/**Hostx64**/x64/cl.exe` — so every compile and link is emulated.
3. `Hostarm64/x64/cl.exe` **is installed** and unused. A native ARM64 .NET for UBT is the single
   thing standing between this device and native-speed compilation of the x64 editor target.

**That open question is now CLOSED, and the answer is the ceiling.** The bundled .NET turned out not
to be the deciding factor at all. A native ARM64 .NET 10.0.13 was installed per-user (no elevation,
`~/.dotnet-arm64`, `RID: win-arm64`) and UnrealBuildTool was run on it directly. It does not work:

```
Unhandled exception: DllNotFoundException: Unable to load DLL 'blake3_dotnet'
  or one of its dependencies (0x8007007E)   at Blake3.Hasher.New()
```

UBT's own `runtimes/` folder publishes that native for `win-x64`, `win-x86` and `win-arm` — and
**not `win-arm64`**. So the shipped UnrealBuildTool cannot run as a native ARM64 process at all,
whether or not Epic ever delivers `ThirdParty/DotNet/10.0/win-arm64`: it would crash on Blake3
before reaching a compiler. `Build.bat`'s `win-arm64` announcement is therefore a dead end on this
engine version.

**Verdict: on UE 5.8 the emulated `Hostx64` compiler is this device's ceiling, not a
misconfiguration.** 63.5 s for a trivial 7-action module is the baseline. Nothing in PoF's control
changes it; it would take an ARM64 build of `blake3_dotnet` inside UBT, which is Epic's to ship.
The number that decides where UE lives is therefore a build of PoF's REAL module, compared against
Wolf with the same command (`ue_arm_probe.ts --engine <path>`), once the repo sync lands.

### Three traps this probe hit, recorded so the next session does not re-pay for them

- **UE python `print()` does not reach the process stdout.** A marker grep over the output reported
  a WORKING commandlet as a failure, twice. Success is read off a file the script writes, or off
  `LogPythonScriptCommandlet`.
- **`--skip-build` invalidates the python criterion**: a C++ project whose module was never compiled
  cannot finish loading, and the editor exits quietly with no error in its log.
- **A partial install fails in ways that mimic an ISA problem.** Every failure here had to be traced
  to a missing file before it could be scored, and none of them was the ARM64 ISA.
- **An ARM64 .NET makes UBT worse, not better** — it crashes on a missing native. The probe now
  tries the native host, recognises that crash and falls back to the emulated x64 one, reporting the
  fallback as the finding. A future engine version that ships a win-arm64 `blake3_dotnet` would make
  the same probe report `Hostarm64` with no code change, which is how this stays measurable.
