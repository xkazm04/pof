---
date: 2026-05-24
status: draft
sub_project: Environment — Audio asset pipeline (improvements folder 05, game.md §7)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/game.md   # §7 audio (deferred sub-project)
  - docs/improvements/05-environment/pof-app.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-24-env-test-hardening.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-24-env-lighting-smoke-check.md
---

# Environment — Audio Asset Pipeline (folder-05 §7)

## Context

Folder-05 §7 was deliberately deferred. The UE project already has
`ARPGSoundManager`, `ARPGAmbientSoundActor`, `AnimNotify_FootstepEffect`
generated, and the PoF app has a substantial `audio` content module (Scene
Painter, Event Catalog, Code Gen, Auto Gen, Soundscapes) — but it is entirely
*system-codegen*: it generates C++ that **references** sound assets and assumes
they exist. **Zero `.wav` files exist in the project.** When the slice runs,
nothing is heard. This sub-project closes the gap: a license-aware audio-asset
generation, library, preview, and UE-import pipeline that ships at least one
real in-game sound (footsteps in the arena) end-to-end.

### Research baseline (verified)

- **ElevenLabs** offers a text-to-sound-effects API (duration + looping
  control, commercially licensed via API), a text-to-speech API
  (commercially licensed), and a music API (requires an *additional* game/
  film license — a real licensing gotcha for a commercial title).
- **Open-source landscape:** for a *commercial* game, license-clean OSS is
  mostly TTS — **Kokoro (Apache-2.0)** is #1 on the TTS Arena (Jan 2026,
  82M params) and **Fish Speech (Apache-2.0)** does voice cloning. SFX/music
  OSS (Stable Audio Open under the Stability Community License;
  MusicGen/AudioGen weights under CC-BY-NC) are **non-commercial** — fine for
  experimentation, not for shipping. ElevenLabs' SFX/ambient commercial
  license is therefore the pragmatic first provider.

### What exists (verified)

- `src/components/modules/content/audio/`: `AudioView` with tabs for
  Overview, Roadmap, Scene Painter, Event Catalog, Soundscapes, Settings,
  Code Gen, Auto Gen. All system-codegen — no asset generation, no library,
  no in-app playback.
- `src/lib/leonardo.ts` + `src/app/api/leonardo/route.ts`: the established
  external-generation-API pattern (provider client + route + module panel).
  Scenario is the 3D analogue.
- `src/lib/scatter-db.ts`, `src/lib/procgen-db.ts`: the established
  app-managed SQLite persistence + result-route pattern (~/.pof/pof.db).
- `src/lib/cli-task.ts` `TaskFactory.procgenDungeon` / `scatterBiome`: the
  established UE-dispatch pattern with `@@CALLBACK` → result route.

## Goals

1. Operator can generate SFX / ambient audio assets in PoF via a *provider
   abstraction* (ElevenLabs first), persisted in an in-app library.
2. The library organises assets as **named sets** keyed to game audio
   events (e.g. `footstep-stone`) so a set carries N variations for runtime
   randomisation, with editable metadata (eventKey, surface, loopable).
3. The library plays/auditions sets in-browser (HTML5 `<audio>`);
   regeneration + per-asset metadata edits are first-class.
4. One proving set (`footstep-stone`) is imported into the UE project as
   `USoundWave`s + a randomising `USoundCue`, wired to
   `AnimNotify_FootstepEffect` so the arena actually makes a footstep sound
   when the player moves.
5. License-awareness is a first-class UI concern: every kind/provider
   exposes a `commercialLicense` flag (`'yes'` / `'extra-license'` /
   `'non-commercial'`), surfaced in the generate UI.
6. The provider abstraction makes adding OSS providers (Kokoro for TTS,
   AudioGen for non-commercial SFX experiments) a one-file change.

## Non-goals

- No music generation in this iteration (deferred; licensing-heavy).
- No NPC voice / TTS in this iteration (slice has no dialogue system yet).
- No batch generation of the full event catalog up front — we prove one
  set end-to-end first; the catalog expands incrementally.
- No in-app audio waveform editor; the Library plays whole clips.
- No automated "did it actually sound" check (audio is the lighting-
  luminance analogue under `-nullrhi`; we assert asset presence + wiring,
  not the sound itself).
- No replacement of the existing system-codegen audio surfaces (Scene
  Painter / Event Catalog / Code Gen / Auto Gen / Soundscapes); this adds
  to them.

## Decision record (from brainstorming)

1. **Provider strategy = Hybrid behind an abstraction** (over cloud-only /
   OSS-only). Matches "one solution or a combination"; mirrors how Leonardo
   and Scenario coexist for images.
2. **First use case = SFX + ambient loops** (over voice / music / all).
   Directly fills the §7 gap, plays to ElevenLabs' looping-SFX strength,
   reuses the existing AnimNotify / AmbientSoundActor scaffolding.
3. **Placement = extend the existing `audio` module** (over a new Asset
   Studio sub-module / standalone). Generation + management + the existing
   Event Catalog all live together; the provider abstraction is the only
   new lib package.
4. **Scope = thin end-to-end slice** (over library-only-defer-UE / broad
   catalog up front). Provider + route + DB + Sound Forge + Library + one
   imported set audible in the arena — the smallest demoable closure of
   §7.
5. **Assumed commercial intent** (game may ship commercially): license-
   awareness surfaced in UI; OSS SFX/music weights stay flagged
   non-commercial; ElevenLabs is the safe SFX provider; music deferred.

## Design

### Part 1 — Provider abstraction (`src/lib/audio-gen/`)

`types.ts`:
- `type AudioKind = 'sfx' | 'ambient' | 'music' | 'tts'`.
- `interface AudioGenRequest { kind: AudioKind; prompt: string;
  durationSeconds?: number; loop?: boolean; outputFormat?: 'wav' | 'mp3' }`.
- `interface AudioGenResult { bytes: Buffer; format: 'wav' | 'mp3';
  durationMs: number }`.
- `type CommercialLicense = 'yes' | 'extra-license' | 'non-commercial'`.
- `interface AudioProvider { id: string; label: string; capabilities:
  AudioKind[]; commercialLicense: Record<AudioKind, CommercialLicense>;
  generate(req: AudioGenRequest): Promise<AudioGenResult> }`.

`providers/elevenlabs.ts`:
- `ElevenLabsProvider` calls the ElevenLabs text-to-sound-effects endpoint
  (`POST /v1/sound-generation`) with `text`, `duration_seconds`, `loop`
  (for ambient), `output_format` — requesting `pcm_44100` (wav-compatible)
  first to dodge the mp3→wav conversion dependency; falls back to mp3 if a
  tier blocks PCM (then the §6 import script converts).
- Reads `ELEVENLABS_API_KEY` from `process.env` (re-checks each call, like
  `/api/verify/visual`'s `getClient` — avoids stale module-load capture).
- `commercialLicense`: `{ sfx: 'yes', ambient: 'yes', tts: 'yes', music:
  'extra-license' }`.

`registry.ts`:
- `AUDIO_PROVIDERS: Record<string, AudioProvider>` keyed by id.
- `getAudioProvider(id): AudioProvider | undefined`.
- Adding `KokoroProvider` (TTS) or `AudioGenProvider` (non-commercial SFX
  experiment) = one new file + one registry entry, no consumer change.

### Part 2 — API route (`src/app/api/audio-gen/route.ts`)

POST:
- Body: `{ provider, kind, prompt, durationSeconds?, loop?, setName?,
  setId?, eventKey?, surface? }`.
- Resolve provider via `getAudioProvider(provider)`; 503 on missing API
  key (same shape as `/api/verify/visual`); 400 on validation failures.
- Call `provider.generate(...)`; save the bytes under
  `~/.pof/audio/<setId>/<assetId>.<ext>` (managed app dir, like
  `~/.pof/pof.db`). If `setId` is absent and `setName` is given, upsert
  the set first.
- Record the asset via `audio-asset-db.ts`; return `apiSuccess({ asset,
  set })`.

GET:
- Returns `{ sets: AudioSet[], assets: AudioAsset[] }` for the Library
  tab. The Library calls this on mount + after each mutation.

DELETE `?assetId=` / `?setId=` for the manage flow.

### Part 3 — Persistence (`src/lib/audio-asset-db.ts` + `src/types/audio-asset.ts`)

`audio_sets` (mirrors `scatter_runs` / `procgen_runs` style):
- `id TEXT PRIMARY KEY, name TEXT, kind TEXT, eventKey TEXT NULL,
  surface TEXT NULL, loopable INTEGER, createdAt INTEGER`.

`audio_assets`:
- `id TEXT PRIMARY KEY, setId TEXT NOT NULL, filename TEXT, relPath TEXT,
  prompt TEXT, provider TEXT, durationMs INTEGER, format TEXT,
  createdAt INTEGER, FOREIGN KEY (setId) REFERENCES audio_sets(id)`.

Helpers: `upsertSet`, `listSets`, `getSet`, `deleteSet`, `addAsset`,
`listAssets(setId)`, `deleteAsset`. Files live in `~/.pof/audio/`,
independent of any UE project until imported. **Local files are kept** —
they are the deliverable, unlike Leonardo's download-then-delete. ElevenLabs
remote-history cleanup is optional polish for a follow-up
([[feedback_leonardo_cleanup]] analogue).

### Part 4 — "Sound Forge" tab (`SoundForgePanel.tsx`, in `audio/`)

Form fields: prompt (textarea), kind (sfx / ambient), duration slider
(0 = auto), loop toggle (enabled when kind = ambient), variation count
(1–6), provider dropdown (ElevenLabs initially; future entries auto-add),
target set (new with name + eventKey + surface, or existing). Generate
button dispatches the N variations **sequentially** to `/api/audio-gen` to
respect ElevenLabs rate limits (parallel batching is a follow-up if
generation feels slow); results show inline `<audio controls>` + "add to
set" + regenerate. A **license badge** sourced from
`provider.commercialLicense[kind]` colours `'yes'` green
(`STATUS_SUCCESS`), `'extra-license'` amber, `'non-commercial'` red
(`STATUS_ERROR`) and explains the implication in a one-line tooltip.

### Part 5 — "Library" tab (`AudioLibraryPanel.tsx`, in `audio/`)

Lists `audio_sets`; selecting a set shows its assets with `<audio>`
players (HTML5, no extra dep), editable metadata (eventKey / surface /
loopable), per-asset delete + regenerate, per-set delete, and an **"Import
to UE"** button per set that dispatches the §6 task. Sets read from
`/api/audio-gen` GET; mutations refetch.

### Part 6 — UE import dispatch (`TaskFactory.importAudioSet` +
`/api/audio/import-result`)

- New `CLITaskType: 'audio-import'`, new `AudioImportTask extends CLITask`
  (`setName`, `eventKey`, `surface`, `assets: { filename, srcAbsPath }[]`,
  `appOrigin`).
- `buildTaskPrompt` case (mirrors `procgenDungeon` / `scatterBiome`):
  emits a prompt telling Claude to run a UE Python script
  (`Content/Python/import_audio_set.py` — created on first dispatch, lives
  in the UE repo) that:
  1. For each source file: if `.mp3`, ffmpeg-convert to `.wav` (16-bit
     PCM 44.1 kHz). **ffmpeg is an optional dependency** — if absent, the
     task reports the skipped wavs and stops at the PCM-only sets (the
     §1 `output_format='pcm_44100'` preference makes ffmpeg unnecessary
     on the common path).
  2. Imports each wav into `/Game/Audio/<setName>/` as `USoundWave`.
  3. Builds `USoundCue` `SC_<setName>` with a `Random` node feeding the
     variation wave players.
  4. For the proving `footstep-stone` set: locates
     `AnimNotify_FootstepEffect` and assigns `SC_footstep_stone` as the
     surface = Stone cue.
  5. Reports `{ assetsImported: N, cuePath, wiredEvent }` via
     `@@CALLBACK` → `/api/audio/import-result`.
- New `/api/audio/import-result/route.ts` POST/GET (mirrors
  `procgen-result` / `scatter-result`): records the run, exposes the
  latest for the Library UI.

### Part 7 — Verification

**Vitest** (mirrors the established test families):
- `src/__tests__/lib/audio-gen/elevenlabs.test.ts` — request shape
  (endpoint, body fields, output_format selection) + `commercialLicense`
  map.
- `src/__tests__/lib/audio-gen/registry.test.ts` — `AUDIO_PROVIDERS` keys
  + `getAudioProvider` lookup.
- `src/__tests__/api/audio-gen-route.test.ts` — 200 / 400 / 503 envelopes;
  no-key path; provider-validation failure path.
- `src/__tests__/lib/audio-asset-db.test.ts` — set + asset CRUD
  (in-memory DB, like `scatter-db.test.ts`).
- `src/__tests__/lib/cli-task-audio-import.test.ts` —
  `TaskFactory.importAudioSet` type + `buildTaskPrompt` contains the
  script invocation, `@@CALLBACK` token, and the expected schema fields.
- `src/__tests__/components/sound-forge-license-badge.test.tsx` — the
  badge renders the right copy + colour for each `CommercialLicense`
  value.

**E2E (Playwright, CI-safe, self-seeded — mirrors
`biome-scatter-panel.spec.ts` / `procgen-driver-panel.spec.ts`):**
- `e2e/audio-library-panel.spec.ts` — seeds one set via the route, opens
  the audio module, switches to the Library tab, asserts the set + asset
  count + an `<audio>` element with `src` are present. Does NOT click
  Generate (no real ElevenLabs spawn).

**Live / manual:**
- A real `ELEVENLABS_API_KEY` generates a `footstep-stone` set (3–4
  variations). Operator clicks "Import to UE" → the dispatched CLI runs
  the Python import → the slice's footstep notify fires
  `SC_footstep_stone` during a real-launch arena walk.
- **Headless audio is the lighting-luminance analogue** (`-nullrhi`
  doesn't render audio either) — the automated UE-side check is **asset
  presence + wiring**, not "did sound play." A small new
  `AVSFootstepWiringTest : AFunctionalTest` asserts
  `/Game/Audio/footstep-stone/` contains N `USoundWave`s,
  `SC_footstep_stone` `USoundCue` exists, and the
  `AnimNotify_FootstepEffect` for surface = Stone references it. Placed
  in `VerticalSlice.umap` alongside the existing arena tests.

### Part 8 — Cross-cutting

- App repo commits **local-only** ([[feedback_git_push]]); UE repo
  pushable ([[project_ue_git]]). The Python import script + any UE-side
  artifacts (the new functional test) go to `xkazm04/pof-exp`; the rest
  stays local in `xkazm04/pof`.
- Stage **by name** under heavy shared-tree concurrency
  ([[project_pof_app_shared_concurrency]]); files you edit may land in a
  sibling's `git add -A` sweep — verify your work landed at HEAD
  (`git diff --quiet`) before assuming you must commit.
- `ELEVENLABS_API_KEY` in `.env.local`. Re-check the key per request
  (no module-load capture, like `/api/verify/visual`'s `getClient`).
- Conventions: `@/` imports, `logger` (no raw console), `chart-colors`
  for the license badge (`STATUS_SUCCESS` / amber / `STATUS_ERROR`),
  `UI_TIMEOUTS` for any debouncing, `Result` for fallible operations,
  `apiSuccess`/`apiError` server-side + `apiFetch`/`tryApiFetch` client.
- **No broad process kill** ([[feedback_no_broad_process_kill]]) anywhere
  in the dispatch path. Audio import is the headless commandlet path; no
  editor window to taskkill. Kill only my own PIDs if needed.
- UE Python bool prefix gotcha ([[reference_ue_python_bool_prefix]])
  applies to any `USoundCue` / `USoundWave` properties accessed via
  `set_editor_property` — drop the leading `b` (e.g. `bLooping` →
  `looping`).

## Definition of done

1. `src/lib/audio-gen/` (types, `ElevenLabsProvider`, registry) + tests.
2. `/api/audio-gen` POST/GET/DELETE + tests; 503 on missing key.
3. `audio-asset-db.ts` + `~/.pof/audio/` storage + tests.
4. `SoundForgePanel.tsx` + `AudioLibraryPanel.tsx` integrated as two new
   tabs in `AudioView`; license badge renders.
5. `TaskFactory.importAudioSet` + `/api/audio/import-result` + tests.
6. `Content/Python/import_audio_set.py` (UE repo) + the Python proves the
   import path manually for a hand-placed wav.
7. E2E spec: Library tab renders a seeded set.
8. **Live proof:** ElevenLabs key generates a `footstep-stone` set;
   Import to UE runs end-to-end; `/Game/Audio/footstep-stone/` contains
   the waves + `SC_footstep_stone` cue + `AnimNotify_FootstepEffect`
   wired — verified by `AVSFootstepWiringTest` (asset-presence
   assertions).
9. Findings doc: `docs/features/arpg-vertical-slice/scenario-runs/
   2026-05-24-env-audio-asset-pipeline.md`; commits local (app) + UE (the
   Python script + the new functional test).

**Success criterion:** an operator can generate, audition, and import a
named set of SFX variations into the UE project from the PoF UI, and the
slice's footsteps audibly play during a real-launch arena walk — folder-05
§7 closed.

## Risks & mitigations

- **mp3 ↔ wav conversion dependency.** Mitigation: request `pcm_44100`
  from ElevenLabs first (yields wav-compatible bytes) so no ffmpeg is
  needed on the common path; only fall back to ffmpeg if a tier blocks
  PCM. If ffmpeg is absent, the import script reports the skipped wavs
  cleanly rather than failing opaquely.
- **No headless audio verification.** Mitigation: assert asset presence
  + wiring, not the sound itself (mirrors the
  [[reference_ue_functional_test_shared_world]] "actor presence" lesson
  and the lighting-smoke setup-invariant reframe).
- **ElevenLabs API cost during experimentation.** Mitigation: variation
  count clamped low (default 3, max 6); the Library is the cache
  (regenerate is opt-in, not on every mount); a small cost note in the
  Sound Forge UI using the published 200 credits/gen baseline.
- **Tier-restricted features (PCM output, looping).** Mitigation: probe
  the provider response and degrade (mp3 store + UE-side convert, or
  `loop=false` fallback with a clear UI note). Surfaced near the license
  badge as a "limitations" line if a feature is denied.
- **Shared-tree concurrency.** Mitigation: stage by name; re-read files
  before editing; verify landing rather than re-committing
  ([[project_pof_app_shared_concurrency]]).
- **Music + non-commercial OSS expansion creep.** Mitigation: the
  `commercialLicense` map per provider / kind is the contract; future
  providers are gated by it; music + non-commercial OSS land behind a
  flag explicitly acknowledged at the UI.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan (Tasks: provider/lib → route →
   DB → Sound Forge UI → Library UI → import-task + result route →
   `import_audio_set.py` + `AVSFootstepWiringTest` → e2e + live proof →
   findings).
4. Execute (TDD).
