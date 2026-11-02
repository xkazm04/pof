# GTAI: Uprising - data, formats, compression, packaging and persistence (engineering standard)

Status: research draft for owner review, 2026-11-02. Engine: Godot 4.7.2 (GDScript + GDExtension C++), Steam (Windows, Deck via Proton or native Linux).
Scope: textures, audio, fonts, data tables, city chunks, saves, settings, localisation, export/PCK/SteamPipe, repo policy, import determinism.

How to read the tags (every claim carries one):
- **[V: src]** verified from a primary source (docs, Godot source at tag 4.7.2-stable, Steamworks docs); the source is listed in section 14.
- **[M]** measured by me on 2026-11-02 with the real Godot 4.7.2 binary from `gtai-spike/tools/godot`, on **scratch copies** (nothing in the spike projects was modified). Method in section 13; numbers are reproducible.
- **[S]** read from the spike projects (`evolve/project`, `cityscale/project`) or its evidence files.
- **[I]** inference or industry practice, not verified here. Treat as a hypothesis; the open questions (section 12) say how to settle it.
- **[4.7!]** version-sensitive: re-check on every Godot patch/minor upgrade.

Registry alignment (read before conflicting with these): `software-engineering/.../settings/techniques/config-backup-and-restore` (rotate, verify, atomic replace, malformed = stop not skip), `game-production/.../price-the-durable-save-on-the-device` (time the whole save sequence, keep it off the frame thread), `game-production/.../seed-determinism-contract` (store seed + generator version + parameters with generated output). The rules below follow them.

---

## 0. The ten rules that matter most

1. **T1** Import all 2D art **Lossless**; never Lossy (WebP) and never S3TC for sprites. Opt in to BC7 (BPTC high quality) only per class, after an A/B gate.
2. **S1** Saves are **JSON inside a small checked container** (magic, versions, SHA-256), never `.tres/.res`, never `str_to_var`/`ConfigFile`, never `*_with_objects`.
3. **S5** Save writes use **tmp + verify + rotate backups + rename**, and load falls back down the chain. Godot's Windows `DirAccess.rename` deletes the target first, so rename alone is not atomic.
4. **L3** `.po` files are **code-execution input on Godot 4.1.0-4.7.2** (unpatched as of 2026-10-26). Ship only our own PCK-resident, linted PO files; never load PO from user/mod folders.
5. **X1/X2** Ship a **separate PCK split by domain** (core, world, music, voice-per-language, loc), not one embedded 150 MB blob; SteamPipe re-sends everything after an insertion point.
6. **R1** Three-tier asset policy: masters outside git (with a provenance manifest), game-ready assets in git (LFS once the repo passes ~1 GB), imported/baked output never in git.
7. **I2** Add `.gitattributes` (`* text=auto eol=lf`, `*.import text eol=lf`) and set `core.autocrlf=input`; the CRLF `.import` churn is a missing file, not a Godot bug.
8. **D1/D2** Game data is **JSON with immutable string IDs, a JSON Schema and cross-reference lint in CI**; `.tres` only for editor-authored visual resources.
9. **C2** Chunks stay `var_to_bytes` of packed arrays (decode 10 us/chunk [M]) but gain a **header: magic, format version, float width, content hash, generator version**.
10. **L1/L2** Localisation by **stable symbolic IDs in per-locale gettext PO**, with pseudo-localisation in the e2e walk; joke profanity is an **overlay layer** (`KEY@joke`), not a locale.

---

## 1. Textures (2D import)

### Primer for a newcomer
A PNG on disk is *compressed for storage* but a GPU cannot draw from a PNG: the engine must expand it to raw pixels (4 bytes per pixel for RGBA) in video memory (VRAM). Godot's import step turns each PNG into a `.ctex` file under `.godot/imported/`. The **compress mode** decides what is stored and what sits in VRAM:

| Mode | Stored on disk as | In VRAM | Quality | Verdict for 2D |
|---|---|---|---|---|
| Lossless | WebP-lossless [M: `RIFF..WEBP` inside the ctex] | raw RGBA8 (RGB8 if fully opaque) | exact | default [V: importing_images] |
| Lossy | WebP-lossy | raw RGBA8 | smeared | VRAM same as Lossless [V], quality worse [M] |
| VRAM Compressed (S3TC / BPTC) | GPU block format | 0.5-1 byte/pixel (4-8x smaller) | lossy blocks | "avoid for 2D" [V]; BPTC high quality is the exception |
| VRAM Uncompressed | raw | raw | exact | float images only [V] |
| Basis Universal | transcodable blob | transcoded at load | worst | not for a PC-only title [V] |

"S3TC" = DXT1/DXT5 (BC1/BC3) and "BPTC" = BC7, the PC/Deck GPU block formats; ETC2/ASTC are the mobile equivalents [V]. Godot's "High Quality" switch picks BPTC instead of S3TC on desktop and only works in Forward+/Mobile renderers, not Compatibility [V]. A *mipmap* is a pre-shrunk copy chain (half, quarter...) used when a sprite is drawn smaller than its pixels; it costs +33% memory [V] but stops shimmer/grain when art is scaled down.

### Measured A/B on our own art (Godot 4.7.2, same PNG imported four ways) [M]
PSNR is measured against the source in dB (higher = closer; >=45 invisible, 35-40 visible on hard edges, <32 obviously degraded). Premultiplied compare, alpha-aware.

| Texture (size) | Lossless VRAM | Lossy (WebP q0.7) | S3TC (DXT) | BPTC high-quality |
|---|---|---|---|---|
| `roof_edge_tone` 1024x1024 opaque | 3072 KB, exact | 40.0 dB (maxerr 24), 3072 KB | 37.8 dB (maxerr 26), **512 KB** | **50.9 dB (maxerr 7)**, 1024 KB |
| `curb_straight` 1024x1024 | 3072 KB, exact | 35.1 dB | 35.7 dB, 512 KB | **52.6 dB**, 1024 KB |
| `building_long` 1312x672 RGBA | 3444 KB | 32.8 dB | 29.1 dB (maxerr 62), 861 KB | 40.9 dB (maxerr 23), 861 KB |
| `peds` atlas 2048x5504 RGBA | 44,032 KB | 30.3 dB | **27.0 dB (maxerr 136)**, 11,008 KB | 42.5 dB (maxerr 56), 11,008 KB |

Findings: Lossy saves **no** VRAM and loses 30-40 dB (it only shrinks the file, and Steam compresses downloads anyway). S3TC is visibly wrong on the sprite atlas. BC7 is 4x smaller than RGBA8 for 40-52 dB, good enough for big opaque ground/roof art, marginal for hard-edged atlas sprites. Block formats **pad dimensions up to a multiple of 4** (652x273 became 652x276, 194x83 became 196x84) [M], which silently shifts atlas region maths.

### Rules
- **T1 MUST** import every 2D sprite, cutout part, decal, UI and print-shader input as **Lossless** (`compress/mode=0`). Why: no artefacts on the riso grain/halftone and hard ink edges; only mode with exact pixels [V: importing_images "Lossless ... without any kind of artifacting"; M above].
- **T2 MUST NOT** use Lossy as a default or for sprites. Why: same VRAM as Lossless, worse quality [M, V]. MAY be used for a huge static backdrop where disk (not VRAM) matters.
- **T3 SHOULD** allow `compress/mode=2` + `compress/high_quality=true` (BC7) as a **per-class opt-in** for large opaque ground/roof/road tiles and big atlases when VRAM profiling demands it. Gate: A/B at the highest on-screen zoom (64 px/m boss camera) with the print shader on, PSNR >= 40 dB, owner eyeball. Never S3TC for sprites [M]. Keep the preset's `texture_format/s3tc_bptc=true` and `etc2_astc=false` (cityscale already does) [S]. Whether the Deck's RDNA2 GPU decodes BC7 natively is expected but untested [I].
- **T4 MUST NOT** use Basis Universal. Why: lower quality than VRAM Compressed, slow to compress, only buys "one file for every GPU family" which Steam PC does not need [V: importing_images].
- **T5 SHOULD** decide texel density per class and cut at import time, not at runtime. Evidence: the city art is authored at **128 px/m** but drawn at 32 px/m on foot, 48 in a car, 64 at boss close-ups [S: `citydef.gd`, EVOLVE decision]. A tile at 64 px/m is 1/4 the VRAM (cityscale 142 MB of RGBA8 would be ~36 MB [I arithmetic]). The mipmap `limit` import option is documented as not implemented [V], so shrink the game-ready PNG in the pipeline (deterministic Lanczos, pinned tool version) instead of hoping the importer does it. Art-lead decision: it changes grain scale (open question Q2).
- **T6 MUST** keep mipmaps and node filter consistent. Mipmaps only help if the CanvasItem filter is a `*_WITH_MIPMAPS` mode. The project default (`rendering/textures/canvas_textures/default_texture_filter`) is Linear (1) [V: ProjectSettings default 1] and the enum order is Nearest, Linear, Linear-Mipmap, Nearest-Mipmap [V: `scene/main/viewport.h`], so cityscale's value `3` means **Nearest+Mipmaps** [S]. For world art that scales (ground, roofs, props at fractional zoom) use Linear-Mipmap; reserve Nearest for pixel fonts/UI [V: gui_using_fonts]. Turn mipmaps off for UI and 1:1 sheets. In 2D, enable mipmaps only "if the camera zooms out enough" [V].
- **T7 SHOULD** cap one texture at 4096 px per side and ~32 MB VRAM without a written exception, and leave >= 2 px (4 with mips) bleed between atlas cells; keep `fix_alpha_border=true` [V]. Why: allocation/upload hitches and BCn 4-px padding; the Deck GPU shares 16 GB LPDDR5 with the CPU and defaults to a 1 GB UMA frame-buffer carve-out (community guide) [I-V: pimylifeup]. Texture budget proposal (unmeasured, Q3): resident world textures <= 600 MB RGBA-equivalent, per-district <= 300 MB.
- **T8 MUST** load textures with `ResourceLoader.load_threaded_request` and prewarm shader variants on the loading screen. Evidence: 65 textures took 271 ms synchronously, shader first-use hitch up to ~200 ms in debug [S: cityscale evidence `warm`, GATE.md].
- **T9 SHOULD** set `[importer_defaults] texture` in `project.godot` (and only write per-file `.import` overrides that differ) and set `detect_3d/compress_to` to Disabled: every current `.import` has `detect_3d/compress_to=1`, which silently flips a texture to VRAM Compressed if it is ever used on a 3D node [V: importing_images "Detect 3D"; S].

---

## 2. Audio

### Primer
Godot 4.7 imports **WAV, Ogg Vorbis and MP3** only; there is no Opus in core [V: importing_audio_samples lists three; godot-proposals #6440 still a proposal; third-party GDExtensions exist and need 4.4/4.5+]. Uncompressed WAV is cheap to play but huge; Ogg Vorbis is small but costs "significantly more" CPU per playing voice [V]. Godot's WAV importer offers **PCM, IMA-ADPCM and QOA** (QOA is a lossy ~5:1 codec, default since 4.3) [V; I for the 5:1 from the QOA spec]. Ogg/MP3 loops have only a **loop-begin offset**, no loop-end [V]; Ogg exposes `bpm`/`beat_count` so the loop end can be a beat, and `AudioStreamInteractive/Playlist` use it [V: class_audiostreamoggvorbis].

### Rules
- **A1 MUST** import short SFX and **barks (<= ~3 s)** as WAV with QOA. Evidence: the spike's 46 WAV (5.23 MB, ~62 s) become 1.08 MB `.sample` files (4.9x) with QOA already on (`compress/mode=2` on 46/46) [S, M]. Why: low CPU per overlapping voice, tiny RAM.
- **A2 MUST** ship music, ambience beds and narrative voice lines (> ~3 s) as **Ogg Vorbis**. Why: the docs' recommendation [V]; the current WAV loop is 1.51 MB per 17 s mono (88 KB/s), so one hour of music would be ~317 MB mono / ~635 MB stereo as WAV versus ~58 MB at 128 kbps Vorbis [S, I arithmetic].
- **A3 MUST NOT** depend on Opus or any third-party codec GDExtension for shipped voice until it is built and tested for Windows **and** Linux/Deck. Vorbis at 24-32 kbps mono is already ~3-4 KB/s per voiced line [I].
- **A4 SHOULD** import SFX/voice with `force/mono=true` (halves size [V]) unless they are authored stereo on purpose, and `edit/trim=true` (trims below -50 dB with a fade [V]); the spike has trim and mono off everywhere [S].
- **A5 MUST** author seamless music loops with explicit loop data (WAV/QOA loop points, or Ogg `loop_offset` + `bpm`/`beat_count`), then verify the seam by listening/measuring in the exported build [V for the limits; I for the encoder-padding risk on MP3].
- **A6 MUST** normalise **loudness offline per class**, not peak. Targets (inference from industry guidance): masters measured in LUFS (ITU BS.1770) with -1 dBTP ceiling; the Wwise/Sony guide gives -24 LUFS (+/-2) for console and **-18 LUFS for handheld/mobile** [V: audiokinetic], and the Deck is both docked and handheld, so pick -18 LUFS integrated for the mix and verify in a Deck capture; voice and barks within +/-1 LU of each other, SFX 3-6 LU below dialogue, music 9-12 LU under dialogue [I]. Keep per-sound `suggestedGainDb` sidecar metadata (the spike's `audio.json` already does this on RMS) but compute it from LUFS/true-peak, and apply it at play time so re-tuning needs no re-import [S].
- **A7 SHOULD** run barks through a voice-pool with `max_polyphony` caps, a Limiter on the voice bus, and music ducking by bus volume; the spike already has a voice pool and distance attenuation [S].
- **A8 MUST** put each language's voice into its own PCK (section 7) and mount only the selected language. Estimate for planning: ~4000 lines x 4 s x 3 KB/s ~ 48 MB per language, ~480 MB for ten [I].

---

## 3. Fonts

### Primer
A *dynamic* font is a TTF/OTF rasterised by the CPU at the needed size and cached as glyph bitmaps; an *MSDF* font renders from a signed-distance atlas so one cache serves any size, at the cost of weaker small-size hinting, no LCD subpixel, a higher per-glyph cost and failure on self-intersecting outlines [V: gui_using_fonts]. Godot's built-in default font covers only a subset of Latin-1, so other languages show blank glyphs unless you ship fonts [V: internationalizing_games].

### Rules
- **F1 MUST** use dynamic fonts for body/UI text (grayscale AA, light hinting) and MSDF only for display text that scales widely (titles, world-space labels, camera-zoomed signage). Pixel-looking fonts: subpixel positioning Disabled, filter Nearest, integer sizes [V].
- **F2 MUST** bundle the fonts for every shipped language and build an explicit fallback chain (display font -> Latin/Cyrillic/Greek text font -> per-language CJK font). Why: system fonts are not in the PCK, are Windows/macOS/Linux/mobile only, differ in metrics, and the Deck under Proton has an unknown font set [V: gui_using_fonts; I for Proton].
- **F3 SHOULD** subset CJK fonts to the codepoints that appear in the translations (a lint can extract them) and keep each CJK font in its language PCK [I]. Pre-render the glyph cache from the translations on the loading screen to avoid first-display stutter [V].
- **F4 MUST** add a glyph-coverage lint: every codepoint used by any string table exists in some font in that locale's chain [I]. **F5 MUST** record each font's licence (OFL) in the repo [I].

---

## 4. Game data tables

### Primer
Four ways to hold a table of items/weapons/missions: **JSON** (text, untyped), **CSV** (text, flat), **`.tres`** (Godot text resource, typed, with editor inspector) and **`.res`** (the same resource in binary). Godot itself ships exports as binary for speed [V: resources].

### Measured: 2000 rows x 12 fields, load time on the dev machine [M]
| Format | Size | Load time | Notes |
|---|---|---|---|
| JSON minified | 399 KB (pretty 533 KB) | 11.1 ms | untyped Dictionary; all numbers become **float** |
| `var_to_bytes` | 734 KB | 4.7 ms | opaque, not reviewable |
| `.res` (typed Resource) | 588 KB | 20.6 ms | binary; a build output |
| `.tres` (typed Resource) | 663 KB | **54.2 ms** | random `sub_resource` ids (`Resource_1swn2`), `load_steps`/ext_resource noise in diffs |

At 200 rows everything is 1-7 ms. Speed is **not** the deciding factor; authorability, review and safety are. JSON integers are parsed as floats and `9007199254740993` came back as `9007199254740992` [M], so never use a numeric id above 2^53 and always cast.

### Rules
- **D1 MUST** make **JSON the source of truth** for items, weapons, enemies, achievements, missions and dialogue structure: UTF-8, LF, sorted keys, one canonical formatter run by tooling. Why: AI agents and humans produce clean line diffs, and schemas can validate it. CSV MAY be used for a designer-edited flat balance sheet with no nesting [I].
- **D2 MUST** validate in CI: a JSON Schema per table, **referential integrity** (every item/loot/mission/dialogue/audio/icon/loc-key reference resolves), and unique immutable `snake_case` ids. Fail the build on violations; never skip a bad row silently (registry: malformed is a stop) [I].
- **D3 MUST** give every row a stable string `id`; saves and cross-references use ids, never array indices or numeric ids; a rename needs an alias map so old saves still load [I].
- **D4 SHOULD** keep dialogue *prose* out of the data tables: tables carry speaker, conditions, line IDs and audio refs; the words live in localisation (section 8) [I].
- **D5 MUST** keep `.tres` for editor-authored visual resources only (themes, SpriteFrames, particle setups) and **MUST NOT** hand-write or AI-write `.tres` for balance data; `.res` is a build artifact, never committed [M; I].
- **D6 MUST** load tables once at boot into typed objects (not repeated `Dictionary` poking), on a worker thread if a table exceeds ~2000 rows (a 2000-row JSON parse is ~11 ms = most of a 60 fps frame) [M].
- **D7 MUST** ship JSON via `include_filter` (or verify export content): the cityscale preset needs `include_filter="citydata/*.bin, assets/atlas/*.json, assets/chars/*/parts.json"` to get non-resource files into the PCK [S]; add the export audit (X5).
- The PoF quest pipeline's `gtai.quest/1` wire contract and economy tables should be the **authoring schema** for missions/economy, with this section's lint on top [S: recent commits `quest context loader stub`].

---

## 5. The city chunk format

### Primer
The city is cut into 128 m chunks (16 x 16 = 256 for 2 x 2 km). Each chunk file holds tile codes, a 128x128 collision cell map (16 KB), spawn densities and a draw list. Streaming means *instantiating* nearby chunks and freeing far ones; the bytes themselves are tiny.

### Measured on the spike's real chunks [M unless noted]
- 256 chunks, **8,030,856 B** total (31 KB each, ~702 draw commands); each chunk is a `var_to_bytes` Dictionary of `PackedByteArray`/`PackedInt32Array`/`PackedFloat32Array` (keys `cx cy tiles cells dens_ped dens_car tex xf`) with **no header, version or hash**.
- Decode all 256 with `bytes_to_var`: **2.6 ms total (10 us/chunk)**. The spike's worst full read+decode was **404 us** (file I/O dominates) [S].
- **Regenerating** with `gen.gd --seed=1` reproduces all 256 files byte-for-byte (identical combined SHA-256), so the generator is deterministic [M].
- Compression of the whole set: zstd **14.9%** (1.20 MB), gzip 14.3%, deflate 14.0%, FastLZ 25.8%. Reading + decompressing 256 chunks: zstd 34 ms, gzip 38, deflate 40, FastLZ 69 (all round-trip exact) [M via `FileAccess.open_compressed`].
- The whole 2 km city is 8 MB raw: it could stay resident; scale is not a data problem until collision/nav/interiors multiply it.

### Rules
- **C1 MUST** separate authoring from shipping format: author per district as JSON/scene (editable, diffable), **bake** to binary chunks with a deterministic tool; chunk binaries are build output, regenerated, not hand-edited. Record seed + generator version + parameters with the output (registry: seed-determinism-contract) [I].
- **C2 MUST** keep chunk payload as `var_to_bytes` of packed arrays (self-describing, 4-byte-padded [V: binary_serialization_api], decode ~10 us [M]) and **wrap it in a 32-byte header**: magic `GTCH`, `format_version` u16, float-width flag (single/double), chunk x/y, generator version, content SHA-256 (truncated). Why: the packed layout changes in double-precision builds [V], and a bare dictionary cannot be versioned or verified.
- **C3 MUST** decode with `bytes_to_var` (objects off); a `null` result (Godot logs `ERR_UNAUTHORIZED`) or a failed header/hash check means a corrupt chunk: log, skip, never instantiate. **MUST NOT** use `bytes_to_var_with_objects`/`store_var(full_objects=true)` for chunks [V, M].
- **C4 SHOULD NOT** compress chunks inside the PCK now: the PCK has no compression of its own (every entry flag is 0) [M], Steam compresses uploads [V], and zstd would save only 6.8 MB of install for +0.13 ms/chunk. If chunks grow beyond ~256 KB, MAY compress **per chunk** with `PackedByteArray.compress(ZSTD)` (keeps our header readable, avoids Godot-only `GCPF` files that `open_compressed` can read [V]); never compress across chunks (Valve: compression must be per-asset [V]).
- **C5 MUST** keep one file per chunk with stable names (`c_XX_YY.bin`); never renumber. Why: a change then localises to one entry [V: SteamPipe "keep changes localized"].
- **C6 MUST** read + decode on `WorkerThreadPool`, hand over via a mutex queue, and time-slice the main-thread activation (1.5 ms budget, one chunk at a time, pooled canvas items): proven at 0.6-0.85 ms/frame streaming cost [S: GATE.md]. Workers never touch the scene tree.
- **C7 MAY NOT need** memory mapping: Godot has no mmap file API (only a native GDExtension could) [I]; at 8 MB total it is irrelevant. Revisit only if baked data exceeds ~200 MB.
- **C8 MUST** add a chunk integrity test: bake twice, byte-compare; load every chunk in CI and assert header + hash; a golden hash list guards accidental generator drift.

---

## 6. Save games, settings

### Primer and the security issue
A save file is *input from outside your program*: players share them on forums, and Steam Cloud moves them between machines. Godot has several ways to read one and **they are not equally safe** [V + M on 4.7.2]:
- `load()`/`ResourceLoader.load()` of `.tres/.res/.scn`: embedded scripts run **when the file loads**, before you can look (Safe Resource Loader README); a plugin regex scanner exists but its author says it is bypassable [V].
- `ConfigFile.parse/load` and `str_to_var`/`var_to_str`: object parsing is **on by default**. I confirmed on 4.7.2 that `str_to_var('Object(RefCounted,"script":null)')` and a `ConfigFile` value with the same text **instantiate an object** [M]; Godot issue #80562 (open, "confirmed") covers this [V: forum thread]. With a `script` property that is arbitrary code.
- `bytes_to_var`, `FileAccess.get_var(false)`: objects off; an object payload returns `null` with `ERR_UNAUTHORIZED` [M]. `*_with_objects` and `store_var(full_objects=true)` re-enable it ("can potentially include code") [V: class_fileaccess].
- JSON: no code path at all [V: gdquest]. Costs: no native Vector2/Color, floats everywhere, big ints lose precision [M].
- **`InputEvent` is an Object**: the common "save the InputMap" snippet via ConfigFile/var_to_str is the same risk [I from M].

### Save-game spec sketch
**Location.** `application/config/use_custom_user_dir=true`, `custom_user_dir_name="<Studio>/GTAI Uprising"`. Windows `%APPDATA%\<Studio>\GTAI Uprising\`, Linux `~/.local/share/<Studio>/GTAI Uprising/`; default (no custom dir) is `%APPDATA%\Godot\app_userdata\<name>` [V: data_paths; M printed that path]. `user://` is guaranteed writable in exports [V].

```
user://
  profile/                       <- Steam Auto-Cloud synced (pattern: profile/**/*.sav, *.json)
    prefs.json                   language, subtitles, joke-profanity, difficulty, accessibility
    slot_1/ meta.json            tiny: chapter, playtime, hash of state, thumbnail ref  (shown in slot picker)
            state.sav            the big one (below)
            state.sav.bak        previous generation (kept by the writer)
    slot_2/, slot_3/, auto_a/, auto_b/   (autosave ping-pong)
  device/settings.json           NOT synced: video, audio mix, input bindings, gamepad
  logs/                          NOT synced
```
**Container (`state.sav`).** `magic "GTSV"` (4) | `container_version` u16 | `min_reader_version` u16 | `flags` u32 (bit0 = zstd) | `payload_len` u64 | `sha256[16]` of the payload as stored | payload = UTF-8 JSON, optionally `PackedByteArray.compress(ZSTD)` [M: API works]. Payload JSON starts with `{"save_version": N, "game_build": "...", "world": {"seed":..,"city_gen_version":..}, ...}` and uses `JSON.stringify(..., sort_keys=true, full_precision=true)` (default precision rounded `0.1+0.2` to `0.3` and pi to 14 digits [M]). World state is **sparse deltas** versus the generated chunk (destroyed props, ownership, mission flags), referencing data ids (D3). Budget: <= 256 KB per slot, <= 8 files per profile, < 5 MB total (Steam limits are set in Steamworks and the doc lists no defaults [V]).

**Write protocol** (S5): snapshot state on the main thread -> serialize + round-trip parse in a worker -> write `state.sav.tmp` -> flush/close -> re-read and verify length + sha256 -> `state.sav` -> `state.sav.bak` (rename; Windows removes the target first) -> `state.sav.tmp` -> `state.sav`. **Load:** try `.sav`; on any failure try `.bak`, then a valid `.tmp` newer than both; if all fail, **stop** and show "slot damaged, restore from backup?" (never silently reset). The Windows crash window (between the two renames) is covered by the load order.

**Migration.** Every payload has `save_version`; migrations are pure functions `v3->v4(dict)->dict` chained; fixture saves for every released version live in `tests/saves/vN.sav` and a test loads each to current; a newer-than-known save is refused (and never overwritten) with a clear message [gdquest: keep old schema; registry: migrations].

### Rules
- **S1 MUST** use JSON-in-container for saves; **MUST NOT** use `ResourceSaver/ResourceLoader`, `ConfigFile`, `str_to_var/var_to_str`, or any `*_with_objects` for anything under `user://` or Steam Cloud. Why: code execution from a shared or cloud-synced file [V, M]. `store_var/get_var` with objects off is acceptable only for internal caches.
- **S2 MUST** put `container_version` and `save_version` in every save; the reader checks both before parsing the payload.
- **S3 MUST** hash-verify what was read (SHA-256 via `HashingContext`) and treat mismatch as corruption, not as a default-fill [M: API present]. This is corruption detection, **not** anti-cheat or encryption; a single-player game does not need either [I].
- **S4 MUST** treat decode failures as a stop with a recovery offer (registry config-backup-and-restore); keep **>= 2 generations** (`.bak` and the previous autosave) [I].
- **S5 MUST** implement the write protocol above. Evidence for why plain `FileAccess.open(WRITE)` is not enough: `FileAccess::backup_save` (tmp-then-rename inside the engine) is only enabled in `editor_node.cpp`, not for exported games, and `DirAccess.rename` on Windows deletes the target before `MoveFileW` [V: Godot source at 4.7.2-stable]. The engine has no `fsync` (`flush()` is a buffer flush) [V: class_fileaccess; source grep], so durability against power loss is best-effort; a GDExtension fsync is MAY if testing shows loss on the Deck [I].
- **S6 SHOULD** run the encode + hash + write on a worker thread and measure the whole sequence on Deck hardware (the registry's price-the-durable-save technique) [I].
- **S7 MUST** keep each file small and split by change frequency (meta vs state vs prefs) and avoid machine-specific settings in the cloud tree [V: Steamworks cloud]. Per-Steam-user subfolders (`{64BitSteamID}`) are for shared PCs; the profile path should include the SteamID when Steam is initialised [V for the placeholder, I for adoption].
- **S8 MUST** use Auto-Cloud with `[Cross-Platform]` roots: Windows build -> Root `WinAppDataRoaming` subdir `<Studio>/GTAI Uprising`; native Linux -> `LinuxXdgDataHome` (same subdir) via a Root Override; patterns `profile/**/*.sav`, `profile/**/*.json` so `.tmp/.bak` never upload [V: Steamworks cloud]. The Steam docs do not mention Proton; a Windows build on the Deck writes inside the Proton prefix, which Steam maps back through the Windows root [I]. Test cloud conflict flow on a real Deck (Q4).
- **S9 MUST** test the cold path: truncated file, flipped byte, newer version, missing `.bak`, zero-length file, no write permission. **S10 MAY** store a 320x180 JPEG thumbnail beside `meta.json`.
- **P1 MUST** split settings: `device/settings.json` (video, audio, input; never synced) and `profile/prefs.json` (language, subtitles, difficulty, joke-profanity, accessibility; synced). **P2 MUST** load settings as JSON with a `version`, deep-merge over code defaults, clamp each value, ignore unknown keys; on parse failure rename to `settings.corrupt-<time>.json`, use defaults and tell the player. **P3 MUST NOT** use `ConfigFile` for settings (same object-parse path [M]); serialise bindings as plain data (`action`, kind, `physical_keycode`, joypad button/axis), never `InputEvent` objects [I]. **P4 SHOULD** write settings on change after a ~1 s debounce and on exit, with the same atomic protocol, never on a timer.

---

## 7. Export packaging, SteamPipe, patches

### Primer
A **PCK** is Godot's archive of the game's resources; the exe is the engine. "Embed PCK" glues the archive onto the exe. Steam delivers builds in **~1 MB chunks** and reuses chunks it already has; a change that shifts bytes forces new chunks for everything after it [V: Steamworks uploading].

### What a Godot 4.7.2 PCK looks like (parsed the cityscale export) [M]
Format v4, relative file base, **16-byte aligned** entries; **file data sorted by source path** (each source followed by its `.ctex` and `.import`), **directory (table of contents) at the end** with a per-file MD5, no compression (all flags 0), `project.binary` last. 498 entries, 34.78 MB: `.ctex` 25.3 MB, chunks 8.1 MB. Source PNGs are not in the PCK. Re-exporting the same tree gives identical bytes; two independent clean import+export runs produced identical bytes except **20 bytes in one converted scene** (`bench.scn`, 677 B) plus its MD5 entry [M].

### Fixed-1-MiB-chunk reuse proxy (not Steam's real algorithm, a pessimistic model) [M]
Base PCK vs variant, counting aligned 1 MiB chunks that are byte-identical: **add one 15 KB file that sorts early: 0/34 chunks reused**; grow a mid file by 100 B: 28/34 (82%); same-size edit of one chunk file: 32/34 (94%). Valve's own advice matches: localised changes, TOC at one end, no absolute-offset churn, per-asset compression only, 1-2 GB max per pack, "add new pack files for new content" [V]. Steam's real diff may recover some shifted data, so measure for real (Q5).

### Rules
- **X1 MUST** export with `binary_format/embed_pck=false` for Steam and ship `GTAI.exe` + separate PCKs + GDExtension libraries. Current exes are 144 MB (cityscale, of which 34.8 MB is the PCK) and 159.7 MB (evolve) [S, M]; embedding makes any content change rewrite the exe's trailing section and any signing step re-touch it [I]. Rule applies to both Windows and Linux builds.
- **X2 MUST** split content into PCKs by domain and change cadence: `core.pck` (scripts, shaders, UI, data tables), `world_<district>.pck` (district art + chunks), `music.pck`, `voice_<lang>.pck`, `loc.pck`, later `dlc_*.pck`. New content = new PCK; do not grow old ones [V]. Mount via `ProjectSettings.load_resource_pack()` in an autoload `_init()` so later scenes see them [V: exporting_pcks].
- **X3 MUST** keep source paths stable (a rename or reorder rewrites everything after it, since data is path-sorted [M]) and prefer same-size in-place edits for hotfix data. MAY name late-added files so they sort last [I].
- **X4 SHOULD** let Steam do the diffing: ship a freshly exported PCK each build (byte-stable export, section 9, I1) rather than Godot delta patches. Godot 4.7 does have `Export as Patch` + Base Packs + delta encoding (compression level 19), but base packs must match the shipped files exactly and re-export non-determinism "may break patching" [V: exporting_pcks 4.7 docs; the 4.4 docs have none of it, a third-party summary dates it to 4.6 dev5 [I]] [4.7!]. Keep patch PCKs as an emergency channel only.
- **X5 MUST** run an **export audit** after every export: parse the PCK directory (a 25-line script reading the v4 TOC) and assert: no source PNG/WAV, no dev folders (`_chars/`, evidence), all `include_filter` data present, size per top-level folder within budget, expected file count. This audit is the only reliable check that JSON/bin reached the build (D7).
- **X6 MUST NOT** enable PCK encryption by default. Needs custom-compiled export templates with the key baked into the binary, so it is only "effort, not a cryptographic barrier" [V: encrypting docs, search]; Valve says encryption carries the same delta-patching risks and is usually unnecessary [V]; an encrypted native-Linux build was reported failing on the Deck's Steam Linux Runtime in 4.6.2 [V: forum]. It protects against casual unpacking only, never secrets or licence keys.
- **X7 MUST** decide Windows+Proton versus a native Linux preset before art/audio lock (Q1): there is no Linux export preset and no Linux `.so` of the native sim yet [S]; Godot docs treat Steam Deck as the supported "console" through Linux templates [V: via godot-city-scale.md research].
- **X8 SHOULD** per-language voice/loc depots on Steam so players download only their language [I].

---

## 8. Localisation

### Primer
Godot looks up a string by **key** (`tr("KEY")`) in the current locale's translation. Sources can be CSV (one file, columns = languages, key in column 1) or gettext **PO** (one file per language, standard tooling). Godot 4.6+ CSV also understands `?plural` and `?context` columns [V: localization_using_spreadsheets]; PO has plurals (`msgid_plural`), context (`msgctxt`) and translator comments natively [V: localization_using_gettext].

### Measured [M]
20,000 messages: PO file 2.73 MB parses at runtime in **128 ms** per locale; a CSV-imported `.translation` (OptimizedTranslation, a compressed perfect-hash table) loads in **~0 ms** and is not enumerable. CSV import writes `tr.<locale>.translation` **next to the source** (hence the `*.translation` ignore rule [V: version_control_systems]).

### Rules
- **L1 MUST** use **stable symbolic IDs** (`M03_FIXER_GREET_02`), never English text as the key, for dialogue, barks and UI; English is just another locale file. Why: copy edits do not orphan translations and translators see IDs plus `#.` comments/`msgctxt` for speaker and scene [V for PO features; I for the policy].
- **L2 SHOULD** author in **PO per locale** for ~10 languages with outside translators: per-locale files merge cleanly, work with Weblate/Poedit, support plurals/fuzzy/comments [V]. CSV is acceptable for a first English/AI-generated sheet but every row carries every language, so edits collide [I]. Load **only the active locale's PO** at runtime (20k lines = 128 ms [M]) instead of registering all ten at boot [I]. Not settled: Q6.
- **L3 MUST** treat PO files as executable input on **Godot 4.1.0-4.7.2**: the `Plural-Forms` header is evaluated by the engine Expression evaluator on first plural lookup and can reach `bytes_to_var_with_objects()` to run attacker GDScript; unpatched on master/4.7.2 at 2026-10-26, PRs #123130 and #123857 not merged, CVE requested [V: oss-security] [4.7!]. So: only our reviewed PO ships, only from the PCK; **never** load PO from `user://`, workshop or mod folders; CI lint pins each file's `Plural-Forms` to a whitelist of exact GNU strings; vendor-delivered files are untrusted until linted; re-check at each Godot upgrade.
- **L4 MUST** run **pseudo-localisation** in the e2e walk: enable `double_vowels` (length), `expansion_ratio` 0.3-0.5, `replace_with_accents` (finds glyph gaps), `fake_bidi`, `skip_placeholders`, and a separate run with `override` (asterisks) to catch hardcoded text [V: pseudolocalization docs]. Evidence it is needed: `tr(` is used **0 times** and 8 hardcoded `.text =` assignments exist in the spike [S].
- **L5 MUST** use named placeholders and `format()`/`%s` with the lint comparing placeholder sets across locales; no string concatenation; `tr_n` for plurals (positive integers only) [V]; separate keys per speaker gender [I].
- **L6 MUST** model **joke profanity as an overlay layer, not a locale**: base key `KEY` is always the neutral line; the joke variant is `KEY@joke` per locale (same PO or `joke_<locale>.po`). A single helper `Loc.t(key)` returns `key@joke` when the pref is on and the entry exists, else `key`; voice uses the same rule (`voice/<lang>/<id>@joke.ogg`). Why: a missing variant can never blank a line, the overlay can be owned/reviewed separately, and a lint can assert every `@joke` has a base and identical placeholders; `msgctxt`/`?context` is for disambiguation and disables automatic Control translation [V: spreadsheets doc], so it is the wrong tool. Defaults per locale are a translator/owner decision; check Steam's content survey and store content descriptors for the final rating text [I] (Q7).
- **L7 MUST** set the fallback locale to `en`, and make debug builds render missing keys visibly (`!!KEY!!`), because Godot otherwise shows the raw key [I].
- **L8 SHOULD** budget +40% text width for UI containers and subtitle lengths [I].

---

## 9. Asset source of truth, repo policy, import determinism

### Primer
Three kinds of files: **masters** (raw AI generations, layered files, prompts), **game-ready** (the sized, cleaned PNG/WAV/OGG that Godot imports) and **imported/baked** (`.godot/`, `.ctex`, PCKs, chunk binaries). Only the middle kind is the game's source.

### Evidence from the spike
`evolve/project`: 955 tracked files (386 `.import`, 17 `.uid`), 340 PNG = 49.0 MB, **`.git` 102 MB after only 24 commits** (1,418 loose objects, no packs: regenerated PNGs do not delta), `.gitignore` is `.godot/` and `*.tmp` only, **no `.gitattributes`**, `core.autocrlf=true` [S, M]. Beside it: `gen/` 57 MB (AI outputs), `work/` 4.6 GB, `project-chars` 1.2 GB, `_chars/` 14 MB inside the project tree [S]. EVOLVE.md records 35 `.import` files shown modified with **only line-ending changes** [S].

### Rules
- **R1 MUST** apply the 3-tier policy: (1) masters outside git (object storage/NAS) with a committed manifest per asset: sha256, pixel size, generator/model, prompt hash, seed, date, accepted-by (registry generative-artifact-gating); (2) game-ready assets in git, **Git LFS once the repo exceeds ~1 GB or any file ~50 MB** (set up *before* committing, and `.import`/`.uid` stay in plain git) [V: version_control_systems for LFS mechanics and the sample `.gitattributes`; I for thresholds]; (3) `.godot/`, `*.translation`, exports, PCKs, baked chunks never in git.
- **R2 MUST** size the repo risk early: at ~144 KB per sprite [S: 49 MB / 340] a few thousand sprites is 0.4-0.7 GB per full revision and AI iteration churns 3x or more [I].
- **R3 MUST** keep PNG optimisation/downscale as a **pinned-version pipeline step** feeding game-ready files; never re-save PNGs by hand-run tools (random churn).
- **I1** Imports are deterministic where I measured: two clean independent imports of cityscale's 104 textures gave **identical `.ctex` bytes** (hash of hashes equal) and a same-tree re-export gave an identical PCK [M]. Cross-machine/OS/CPU equality is unmeasured (encoders may differ) [I]. **MUST** pin the exact Godot patch (4.7.2) in the repo and produce shipping builds on one pinned runner; **MUST** treat `.godot/imported` as cache.
- **I2 MUST** commit a `.gitattributes`: `* text=auto eol=lf`, explicit `eol=lf` for `*.import *.tscn *.tres *.gd *.gdshader *.cfg *.json *.po *.csv *.uid *.gdextension`, `binary` for images/audio/fonts/`*.res *.scn *.pck`; set global `core.autocrlf=input` [V: version_control_systems, which says Godot's generated metadata enforces LF]. Fix existing noise once with `git add --renormalize` in a **dedicated worktree commit** (never a bulk add in the shared checkout; see CLAUDE.md never-lose-work rules).
- **I3 SHOULD** let Godot own `.import` files: put shared defaults in `[importer_defaults]` and only commit `.import` files that differ or are new; a tool that writes `.import` itself must match Godot's key order and LF exactly (I wrote them by hand for my A/B and Godot accepted them) [M]. Move assets **in the editor** (or move the `.import` + `.uid` with them) so the `uid://` stays stable [I].
- **I4 MUST** add a CI gate "reimport clean": `godot --headless --import` then `git status --porcelain` must be empty, and a double-bake gate (C8) for chunks. Ignore `.godot/`, `*.translation`, `*.pck`, `build/`, `export_credentials.cfg` [V for the first two].

---

## 10. Format decision table (asset type -> shipping format)

| Asset | Format | Import / pack settings | Compression | Why |
|---|---|---|---|---|
| Characters, cutout parts, small sprites | PNG -> `.ctex` | Lossless, mips only if scaled < 1, Linear-Mipmap filter, atlas with 2-4 px bleed | none beyond lossless WebP | exact riso pixels [M] |
| Ground, road, roof tiles (large, opaque) | PNG -> `.ctex` | Lossless; opt-in BC7 (BPTC HQ) after A/B; author at 64-96 px/m | BC7 = 4x less VRAM, 40-52 dB [M] | largest VRAM lever [S] |
| Big atlases (peds 2048x5504) | PNG -> `.ctex` | Lossless; BC7 opt-in; split under 4096 | BC7 44 MB -> 11 MB, 42.5 dB [M] | VRAM, upload hitch |
| Decals/FX soft alpha | PNG -> `.ctex` | Lossless, `fix_alpha_border` on | none | alpha edges break under DXT [M] |
| HUD/UI | PNG -> `.ctex` | Lossless, no mips, Nearest or Linear at integer scale | none | crisp |
| Print-shader LUT/noise | PNG -> `.ctex` | Lossless, repeat as needed | none | shader input exactness |
| Fonts | TTF/OTF dynamic | MSDF only for titles/world labels; subset CJK | none | section 3 |
| SFX / barks (<= 3 s) | WAV | QOA, mono, trim on | ~5:1 QOA [M 4.9x] | cheap polyphony |
| Voice lines (> 3 s), ambience, music | Ogg Vorbis | loop offset / bpm / beat_count; per-language PCK | Vorbis q3-5 | size; docs rec. [V] |
| Game data tables | JSON (UTF-8, LF, sorted keys) + JSON Schema | shipped via include_filter; loaded once | none | AI/human diffs [M] |
| Editor-authored visual resources | `.tres` source, `.res` at export | Godot default | n/a | inspector authoring |
| Dialogue structure | JSON (ids only) | refs loc keys + audio ids | none | words live in PO |
| Strings | PO per locale (active only at runtime) | pseudoloc + lint in CI | none | tooling, plurals [V] |
| City chunk | header + `var_to_bytes` packed arrays | one file per 128 m chunk, stable names | none now; per-chunk zstd later | 10 us decode [M] |
| Save slot | container + JSON (+ zstd flag) | tmp/bak/rename protocol | optional zstd | safe + diffable |
| Settings/prefs | JSON, versioned | device vs profile split | none | no object parsing |
| Packs | separate PCKs by domain, no encryption | `embed_pck=false` | none (Steam compresses) | SteamPipe chunks [V] |

---

## 11. Gap table against the prototype (all numbers from the spike unless tagged)

| # | Area | Prototype today | Gap / risk | Rules |
|---|---|---|---|---|
| G1 | Texture memory | evolve: 340 PNG = 49.0 MB disk but **378 MB RGBA8 in VRAM** (421 MB with mips on 202); cityscale 104 PNG = 24.6 MB disk, **142 MB** VRAM; peds atlas 2048x5504 = **43 MB** | no budget, no VRAM class; robots sheets 1024x9344 x2 = 38 MB each (168 MB total) | T3, T5, T7 |
| G2 | Texel density | art 128 px/m, drawn at 32-64 | 2-4x linear oversampling (4-16x texels) | T5 |
| G3 | Compression | 340/340 `compress/mode=0` Lossless; no VRAM class | fine as default; no BC7 path or A/B gate | T1, T3 |
| G4 | Mipmaps/filter | `mipmaps/generate=true` on 202/340 but project default filter is Linear (no mips); only `district.gd` sets Linear-Mipmap; cityscale default filter = 3 = Nearest-Mipmap | ~43 MB wasted mips; possible shimmer/Nearest look unintended | T6 |
| G5 | NPOT/oversize | 252/340 NPOT, 11 textures > 2048 px a side | BCn padding, upload hitches | T7 |
| G6 | `detect_3d` | `compress_to=1` on every `.import` | silent flip to VRAM Compressed if used in 3D | T9 |
| G7 | Audio | 46 mono WAV, 5.23 MB, ~62 s, QOA on all; music = WAV 1.51 MB / 17 s; trim/mono off; levels by RMS in `audio.json` | no Ogg path, no LUFS/true-peak, no voice pipeline; 1 h music as WAV ~317 MB | A1-A8 |
| G8 | Fonts | 0 TTF/OTF; 2 font references; default font | Latin-1-subset default, no fallback chain, no glyph lint | F1-F5 |
| G9 | Data | 63 JSON (largest 31 KB) read by `JSON.parse_string(FileAccess.get_file_as_string(...))` | no schema, no id lint, no versions, numbers are floats; JSON only reaches the PCK via `include_filter` | D1-D7 |
| G10 | Chunks | 256 x 31 KB = 8.03 MB, bare `var_to_bytes`, no header/version/hash; generator byte-deterministic [M] | no versioning/integrity, no double-precision guard; chunk bake not a build step | C1-C8 |
| G11 | Saves | none (`user://` used 0 times) | whole subsystem + security stance new | S1-S10 |
| G12 | Settings | window size only | no split, no versioned JSON | P1-P4 |
| G13 | Localisation | `tr(` 0 uses; 8 hardcoded `.text =` | no IDs, no pseudoloc, no PO/lint, no profanity layer | L1-L8 |
| G14 | Export | single Windows preset, `embed_pck=true`, `all_resources`; exes 144-160 MB; cityscale 34.8 MB PCK; no Linux preset, no `.so`; no encryption (good) | one embedded blob, no domain split, no audit | X1-X8 |
| G15 | Repo | `.git` 102 MB / 24 commits, no `.gitattributes`, `autocrlf=true`, ignore list = `.godot/`, `*.tmp`; 35 `.import` files with CRLF-only noise [S EVOLVE.md] | churn + unbounded history growth | R1-R3, I2, I4 |
| G16 | Import determinism | not gated | I measured determinism on one machine only | I1, I4 |

---

## 12. Open questions (need owner/measurement)

- **Q1** Windows build under Proton or a native Linux build for the Deck? Decides cloud roots, the `.so` of the native sim, font/system-font behaviour and encryption issues. Needs a Deck test of both.
- **Q2** Art lead: is 64-96 px/m for ground/roofs acceptable for the riso grain at 64 px/m boss zoom? (T5 saves ~4x VRAM.)
- **Q3** Real texture budget: measure VRAM on a Deck for the full evolve+cityscale scene; the 600/300 MB numbers are placeholders.
- **Q4** Steam Auto-Cloud conflict UX and Proton prefix behaviour on the Deck; default quota in Steamworks (docs give none).
- **Q5** Run two real depot builds on a private app id and read SteamPipe's "bytes uploaded" to replace my fixed-chunk proxy; decide the PCK split from the result.
- **Q6** PO vs CSV: do translators/vendors need PO, or is an AI-authored CSV pipeline with 4.6+ plural/context columns enough? Also whether Godot patches the `.po` Plural-Forms hole in a 4.7.x/4.8 release.
- **Q7** Joke profanity: default state per locale, voice-over variants count, Steam content-survey wording, and whether the toggle is cloud-synced (spec says yes via `prefs.json`).
- **Q8** Riso as ink layers: separating each spot colour into single-channel masks (R8/RG8, BC4/BC5-compressible) composed by the print shader would cut VRAM 2-4x and match how riso prints; needs an art + shader prototype [I, speculative].
- **Q9** Does cross-machine import produce identical `.ctex`/PCK? Needs a second machine/CI runner.
- **Q10** The unexplained 4-byte nondeterminism in one exported scene (`bench.scn`) and whether it recurs in real scenes.
- **Q11** Does Godot's `script_export_mode` (binary tokens) matter for protecting game logic, and do we care (single-player, no secrets)? [I]

---

## 13. Method (how the [M] numbers were produced)
All on `Godot_v4.7.2-stable_win64_console.exe` from `gtai-spike/tools/godot`, scratch copies only: (a) A/B textures: eight PNGs imported four ways with hand-written `.import` files, decoded back with `Texture2D.get_image()` and compared in GDScript (premultiplied, 2-px stride); (b) PCK: `--export-pack` of a copy of `cityscale/project`, a ~25-line Node parser for the v4 directory, then 1 MiB chunk hashing of base vs three edited variants; (c) data tables: 200 and 2000 synthetic items saved as JSON/`.tres`/`.res`/`var_to_bytes`, 30 load repetitions; (d) security probes: `str_to_var`, `ConfigFile.parse`, `bytes_to_var[_with_objects]`, `get_var(false)`; (e) chunks: `FileAccess.open_compressed` in four modes over all 256 files, `gen.gd --seed=1` regenerated and compared by SHA-256; (f) 20k-entry PO vs CSV load. Machine: Ryzen-class dev box shared with other sessions, so treat absolute ms as order-of-magnitude. Scripts lived in the session scratchpad and are not committed.

## 14. Sources
Godot docs (latest = 4.7 docs unless noted):
- https://docs.godotengine.org/en/latest/tutorials/assets_pipeline/importing_images.html
- https://docs.godotengine.org/en/latest/tutorials/assets_pipeline/importing_audio_samples.html
- https://docs.godotengine.org/en/latest/classes/class_audiostreamoggvorbis.html
- https://docs.godotengine.org/en/latest/classes/class_fileaccess.html
- https://docs.godotengine.org/en/latest/classes/class_@globalscope.html
- https://docs.godotengine.org/en/latest/tutorials/io/saving_games.html
- https://docs.godotengine.org/en/latest/tutorials/io/data_paths.html
- https://docs.godotengine.org/en/latest/tutorials/io/binary_serialization_api.html
- https://docs.godotengine.org/en/latest/tutorials/scripting/resources.html
- https://docs.godotengine.org/en/latest/tutorials/ui/gui_using_fonts.html
- https://docs.godotengine.org/en/latest/tutorials/i18n/internationalizing_games.html
- https://docs.godotengine.org/en/latest/tutorials/i18n/localization_using_gettext.html
- https://docs.godotengine.org/en/latest/tutorials/i18n/localization_using_spreadsheets.html
- https://docs.godotengine.org/en/latest/tutorials/i18n/pseudolocalization.html
- https://docs.godotengine.org/en/latest/classes/class_translationdomain.html
- https://docs.godotengine.org/en/latest/tutorials/export/exporting_pcks.html and https://docs.godotengine.org/en/4.4/tutorials/export/exporting_pcks.html (no patch/delta section)
- https://docs.godotengine.org/en/stable/engine_details/development/compiling/compiling_with_script_encryption_key.html
- https://docs.godotengine.org/en/latest/tutorials/best_practices/version_control_systems.html
Godot source (tag 4.7.2-stable, `raw.githubusercontent.com/godotengine/godot/4.7.2-stable/...`): `drivers/windows/dir_access_windows.cpp` (rename removes target), `drivers/windows/file_access_windows.cpp`, `core/io/file_access.h` (`backup_save=false`), `editor/editor_node.cpp` (only caller of `set_backup_save`), `scene/main/viewport.h` (texture filter enum order); master: `doc/classes/ProjectSettings.xml` (default filter 1).
Security: https://www.gdquest.com/library/save_game_godot4 ; https://github.com/derkork/godot-safe-resource-loader ; https://github.com/godotengine/godot-proposals/issues/4925 ; https://forum.godotengine.org/t/does-this-configfile-scanner-prevent-arbitrary-code-execution/142353 (cites godot issue #80562) ; https://openwall.com/lists/oss-security/2026/10/26/19 (.po Plural-Forms RCE, 4.1.0-4.7.2).
Steam: https://partner.steamgames.com/doc/sdk/uploading (SteamPipe chunks, pack-file layout) ; https://partner.steamgames.com/doc/features/cloud (Auto-Cloud roots, quotas, Deck dynamic sync).
Other: https://audiokinetic.com/ko/blog/mastering-a-game-with-wwise-part1 (loudness targets) ; https://github.com/godotengine/godot-proposals/issues/6440 (Opus proposal) ; https://store.godotengine.org/asset/goatchurch/xiph-audio-streams/ ; https://github.com/DeeJayLSP/godot-qoa-module (QOA added in 4.3) ; https://gamefromscratch.com/godot-4-6-dev5-and-dev6-released/ (PCK delta, third-party) ; https://forum.godotengine.org/t/encrypted-linux-exports-do-not-run-with-linux-runtime-on-steam-deck/143959 ; https://pimylifeup.com/steam-deck-increase-vram/ (UMA carve-out, community guide) ; Steam Deck APU facts: https://gigazine.net/gsc_news/en/20230306-steam-deck-apu.
Spike evidence read: `gtai-spike/evolve/project/{project.godot,export_presets.cfg,assets/**/*.import,game/*.gd}`, `evolve/EVOLVE.md`, `cityscale/{GATE.md,project/export_presets.cfg,project/citydata,project/city/*.gd,evidence/rerun/*.json}`, `pof/games/gtai/research/godot-city-scale.md`.
Registry: `knowledge/software-engineering/operations/governance-and-records/settings/techniques/config-backup-and-restore.md`; `knowledge/game-production/couch-and-tv-play/couch-and-tv/fire-tv-device-realities/techniques/price-the-durable-save-on-the-device.md`; `knowledge/game-production/balance-validation/procedural-level-planning/techniques/seed-determinism-contract.md`; `.../content-pipeline/generative-artifact-gating/generative-artifact-gating.md`.
