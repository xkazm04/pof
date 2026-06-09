# Bug Hunter Fix Wave 6 — Security hardening

> 2 commits, 2 critical findings closed (both security).
> Baseline preserved: tsc 0→0 errors, eslint 0→0 errors. Related audio/build test files 50/50 pass.
> Sweep verdict: the two reported holes were the only exploitable instances of their shapes.

## Theme

The two highest-blast-radius findings in the scan: a remote command-injection and an arbitrary-file-read, both on privileged server surfaces (a subprocess spawn site and a filesystem read endpoint) whose only guard was a non-empty-string check or a flawed prefix match. Each fix makes the vulnerability class *structurally impossible* rather than filtering known-bad inputs.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|--------|----------------|----------|-------|
| 1 | `3c96050` | ue5-bridge-live-sync #1 (command injection) | critical | `lib/ue5-bridge/build-pipeline.ts`, `app/api/ue5-bridge/build/route.ts` |
| 2 | `88b6fae` | audio-generation-scenes #1 (path traversal) | critical | `app/api/audio-asset/route.ts` |

## What was fixed

1. **UE5 headless build — command injection** (`3c96050`). `executeBuild` spawned `UnrealBuildTool.exe` with `shell: true`, re-joining every arg (including the interpolated `projectPath`/`targetName`/`additionalArgs`) into one `cmd.exe` command line. A `projectPath` like `C:\proj" & calc & "x` closed the quote and executed arbitrary commands with full server privileges; the route validated only non-emptiness. **Fix:** spawn the `.exe` directly with `shell: false` and a literal argv array (no shell parsing, embedded `-Project="..."` quotes dropped since each argv element is already atomic), and reject non-identifier `targetName` (`/^[A-Za-z0-9_]+$/`) and `..` in `projectPath` at the route boundary as defense-in-depth.
2. **Audio asset read — path traversal** (`88b6fae`). The containment check `abs.startsWith(normalize(AUDIO_DIR))` was a separator-less prefix match, so a sibling dir whose name *starts with* the basename (e.g. `audio-secrets`) passed, and `..` segments climbed out of `AUDIO_DIR` entirely to `readFileSync` and stream back arbitrary files (SQLite DB, secrets) to an unauthenticated `GET`. **Fix:** reject any `relPath` containing `..` up front, then require `path.relative(AUDIO_DIR, abs)` to be non-empty, not `..`-prefixed, and not absolute — structural containment.

## Sweep (privileged-surface check, per the harness security rule)

Grepped the whole `src/` tree for sibling instances of both shapes:

- **`shell: true` spawn sites** — 2 hits. `build-pipeline.ts` (fixed above). `harness/orchestrator.ts:140` spawns `npx next dev --port 3000` with **fully static args**; `projectPath` only sets `cwd` (never concatenated into the command line) and `shell:true` is required there for Windows `npx.cmd` resolution → **not injectable, left untouched** (changing it would break the dev-server launch).
- **`startsWith`-based path containment** — 3 hits. `audio-asset` (fixed above). `blueprint-transpiler-write.ts:43` and `harness/screenshot/route.ts:43` both correctly use `root + path.sep` (separator-terminated) → **safe**, no change.

## Verification

| Gate | Result |
|------|--------|
| `tsc --noEmit` | 0 errors |
| `eslint` (changed files) | 0 errors |
| Related tests (audio-asset-db, build-pipeline-id, build-health, audio panels) | 50/50 pass |
| Behavior preserved | `shell:false` passes paths-with-spaces correctly as atomic argv (quotes no longer needed); legitimate `relPath`s still resolve |

## Cumulative status (across waves so far)

| Wave | Theme | Findings closed | Crit | High |
|------|-------|----------------:|-----:|-----:|
| 1 | Trust-boundary input validation | 7 | 3 | 4 |
| 6 | Security hardening | 2 | 2 | 0 |
| **Total** | | **9 / 140** | **5 / 18** | **4 / 70** |

## Patterns established (catalogue items 5–6)

5. **Never `spawn` with `shell: true` and interpolated input.** Pass a literal argv array with `shell: false` so the OS executes argv[0] with the rest as atomic, un-parsed arguments. If `shell: true` is unavoidable (e.g. Windows `.cmd` resolution), the command and *all* args must be static constants — no untrusted value anywhere on the command line. `cwd` is safe (an option, not part of the command string).
6. **Path containment must be separator-aware and traversal-rejecting.** `abs.startsWith(dir)` is a bypass (sibling dirs sharing a name prefix). Use `path.relative(dir, abs)` and require the result to be non-empty, not `..`-prefixed, and not absolute — or compare against `dir + path.sep`. Also reject `..` in the raw input up front.

## What remains

9 of 140 findings closed. Open per the INDEX (suggested order): Wave 2 (atomicity & write races — closes 3 criticals), Wave 3 (silent-failure safety gates), Wave 4 (shared-singleton concurrency — closes 3 criticals), Wave 5 (UE5 codegen correctness), Wave 7 (determinism / timestamps / stale closures). All 18 criticals: 5 closed, 13 open.
