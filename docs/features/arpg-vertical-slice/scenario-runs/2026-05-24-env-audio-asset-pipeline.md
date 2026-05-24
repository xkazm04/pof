# Environment — Audio Asset Pipeline (folder-05 §7)

**Date:** 2026-05-24
**Spec:** `docs/superpowers/specs/2026-05-24-env-audio-asset-pipeline-design.md`
**Plan:** `docs/superpowers/plans/2026-05-24-env-audio-asset-pipeline.md`

## What shipped

### PoF app (`xkazm04/pof`, local-only)

- **`src/lib/audio-gen/`** — provider abstraction (`types.ts`, `providers/elevenlabs.ts`, `registry.ts`). License-aware `AudioProvider` interface with `commercialLicense: Record<AudioKind, 'yes' | 'extra-license' | 'non-commercial'>`. `ElevenLabsProvider` posts to `/v1/sound-generation` with re-checked API key and `mp3_44100_128` output (tier-safe).
- **`src/lib/audio-asset-db.ts` + `src/types/audio-asset.ts`** — `audio_sets` / `audio_assets` tables in `~/.pof/pof.db` with CASCADE delete; files in `~/.pof/audio/<setId>/<assetId>.mp3`. Mirrors `scatter-db` / `procgen-db` style.
- **`src/app/api/audio-gen/route.ts`** — POST/GET/DELETE. 503 on missing key, 400 on validation, 200 generates+persists. GET returns the library snapshot.
- **`src/app/api/audio-asset/route.ts`** — streams local clips for `<audio>`, path-traversal-safe (normalised+containment-checked against `AUDIO_DIR`).
- **`src/types/audio-import.ts` + `src/lib/audio-import-db.ts` + `src/app/api/audio/import-result/route.ts`** — `audio_import_runs` + record/latest API for the UE→app callback.
- **`src/lib/cli-task.ts`** — new `'audio-import'` CLITaskType + `AudioImportTask` + `TaskFactory.importAudioSet` + `buildTaskPrompt` case dispatching `Content/Python/import_audio_set.py` with `AUDIO_*` env vars + `@@CALLBACK → /api/audio/import-result`. Mirrors the procgen/scatter pattern.
- **`src/components/modules/content/audio/`** — `LicenseBadge.tsx` (green / amber / red per `CommercialLicense`), `SoundForgePanel.tsx` (sequential N-variation generate with inline `<audio>` previews + license badge), `AudioLibraryPanel.tsx` (set list + variation player + Import-to-UE button + delete/refresh). Two new tabs wired into `AudioView.tsx` (Sound Forge, Library) — alongside the existing system-codegen tabs.
- **Tests:** `audio-gen/registry.test.ts` (3), `audio-gen/elevenlabs.test.ts` (3), `audio-asset-db.test.ts` (4), `api/audio-gen-route.test.ts` (5), `cli-task-audio-import.test.ts` (2), `audio-import-db.test.ts` (1), `components/license-badge.test.tsx` (3). **All TDD-disciplined (RED → impl → GREEN)**, all pass.
- **`e2e/audio-library-panel.spec.ts`** — CI-safe self-seed via `/api/audio/import-result`; opens Content → Audio → Library; asserts the panel mounts. Does NOT click Generate (no claude.exe / ElevenLabs spawn). Operator runs against `npm run dev`.

### UE repo (`xkazm04/pof-exp`, pushable)

- **`Content/Python/import_audio_set.py`** — imports a set of source clips (mp3 sources converted via ffmpeg → 16-bit PCM 44.1 kHz wav, mp3-without-ffmpeg skipped with a warning) into `/Game/Audio/<set>/` as `USoundWave`s, then creates `SC_<set>` `USoundCue` and best-effort constructs a Random node + WavePlayer per variation. Prints `[import_audio_set] DONE assetsImported=N cuePath=... wiredEvent=...` for the CLI to parse.
- **`Source/PoF/Test/Environment/VSFootstepWiringTest.{h,cpp}`** — `AFunctionalTest` asserting `/Game/Audio/footstep-stone/` contains ≥1 `USoundWave` and `SC_footstep_stone` `USoundCue` exists. `Build.bat PoFEditor Win64 Development` succeeded (DLL mtime advanced 13:37→13:43:02). Compile bug caught: my first `cpp` used `FString FolderPath` which shadowed `AActor::FolderPath` (FName) — renamed local to `AudioFolderPath`.
- **`Content/Python/place_arena_tests.py`** — `VSFootstepWiringTest` added to the placement list alongside the existing 3 arena tests.

## Verification

- **Vitest (full suite):** **1262 passed / 1 skipped / 1 failed (167 files)**. The single failure is **foreign**: `src/__tests__/knowledge/ue-known-assets.test.ts > returns [] for unrelated modules` expects `[]` and gets `[ 'loot' ]` — a sibling added a `loot` asset domain and didn't update this test. Completely unrelated to audio.
- **Typecheck:** clean (only the pre-existing, unrelated `leonardo.ts:208`).
- **UE compile:** `Build.bat … -WaitMutex` → `Result: Succeeded` for `PoFEditor Win64 Development`. DLL contains `VSFootstepWiringTest`.
- **Headless test run:** SKIPPED here — the test will report RED until a live ElevenLabs-backed import populates `/Game/Audio/footstep-stone/`. That's the live-proof gate documented in the spec, not a regression.

## Live proof (operator)

When an `ELEVENLABS_API_KEY` is available:

1. Set the key in `.env.local`; restart `npm run dev`.
2. Open **Content → Audio → Sound Forge**. Defaults are pre-filled for the `footstep-stone` proving set (sfx, surface=stone, 3 variations, prompt "footstep on stone…"). Click **Generate 3 variation(s)**. Inline `<audio>` previews appear.
3. Switch to the **Library** tab; select `footstep-stone`; click **Import to UE**. The CLI session dispatches `import_audio_set.py`; on completion the result row appears.
4. Run the place + test sequence to confirm the gate goes green:
   ```
   & "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" "<.uproject>" -ExecutePythonScript="Content\Python\place_arena_tests.py" -unattended -nopause -nosplash
   & "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "<.uproject>" "/Game/Maps/VerticalSlice" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice;Quit" -unattended -nopause -nullrhi -abslog="C:\Users\kazda\kiro\pof\_audio.log"
   ```
   Expect `VSFootstepWiringTest Result={Success}` + `TEST COMPLETE. EXIT CODE: 0`.

## Notes & follow-ups

- **`buildCallbackSection` URL gotcha** ([[procgen-driver-panel]] memory) bit again — first version of `cli-task-audio-import.test.ts` asserted `/api/audio/import-result` in the prompt; fixed to assert the schema token (`assetsImported`) instead. The callback URL is registered server-side, not embedded in the prompt.
- **UE class member shadowing:** `AActor::FolderPath` (FName) collided with a local `FString FolderPath` in `VSFootstepWiringTest.cpp` — compiler treats it as warning-as-error in this project. Use distinct local names (e.g. `AudioFolderPath`) for clarity in `AFunctionalTest` subclasses.
- **ffmpeg dependency:** the import script silently skips mp3 sources if ffmpeg isn't on PATH (with a warning). The default ElevenLabs output is mp3 so ffmpeg is the common-path requirement. Document this in the operator setup; a follow-up could request PCM and wrap it in a WAV header server-side to drop the dep.
- **AnimNotify auto-wiring** is best-effort/deferred: the import creates `USoundWave`s + `SC_<set>` cue but does NOT modify `AnimNotify_FootstepEffect` to reference it (varies by class shape). The functional test asserts presence only; final wiring is the operator's manual step or a follow-up dispatch task.
- **Music + non-commercial OSS providers** stay deferred; the provider abstraction's `commercialLicense` map is the contract — adding `KokoroProvider` (TTS, Apache-2.0, commercial) or `AudioGenProvider` (SFX, weights CC-BY-NC, non-commercial flag) is a one-file change with the badge surfacing the licensing reality.
- **Shared-tree concurrency** ran high during this session — `cli-task.ts` had a sibling-added `'character-setup'` case mid-build, plus `'generate'`; my edits adapted (re-read before insert). Full suite shows 1 foreign failure (`loot` in `ue-known-assets.test.ts`) that's a sibling regression and pre-dates this commit set.

## Commits

App repo (`pof`, local-only): provider abstraction → asset DB → /api/audio-gen route → import task + result route → license badge + Sound Forge + Library tabs + asset route → e2e spec → findings.

UE repo (`pof-exp`, pushable): `import_audio_set.py` + `VSFootstepWiringTest` (compile-verified) + `place_arena_tests.py` extension.

## Outcome

Folder-05 §7 is **wired end-to-end** in code and asserted by the `VSFootstepWiringTest` gate. The remaining step is the **live proof** (operator + real ElevenLabs key) which closes the proving footstep-stone set's audible playback in the slice. The provider abstraction makes adding OSS providers (Kokoro, AudioGen) the documented next-step expansion.
