# GTAI: Uprising - Steamworks integration standard

Status: research standard, 2026-11-02. Scope: in-game Steamworks (achievements first, then stats, Cloud, Input, Rich Presence, overlay, Deck), GodotSteam on Godot 4.7.2, the platform layer, and CI without Steam.

Claim marking: **[V S#]** = verified against the cited primary source on 2026-11-02 (source list at the end). **[I]** = inference or engineering judgement, not stated by a source; treat as a hypothesis to test. Rules use RFC wording (MUST / SHOULD).

## 0. Findings that change the brief

1. **Bulk import exists, but it is CSV plus PNG files uploaded in the partner site, not an API.** The achievement editor has a Bulk Import/Export tab: definitions CSV, localization CSV, set-localization CSV, and PNG icons named `<API_NAME>_ACHIEVED.png` / `<API_NAME>_UNACHIEVED.png`. Nothing saves until a human clicks "Save imported data", and changes go live only from the Publish tab. [V S2]
2. **No Web API defines achievements or stats.** The partner Web API for `ISteamUserStats` has seven methods (global percentages, global stats, current players, player achievements, schema read, user stats read, `SetUserStatsForGame`). None creates a definition. `SetUserStatsForGame` needs the publisher key and "MUST be called from a secure server". [V S4]
3. **Icons are 256x256 PNG (min 64x64, JPG accepted), not 64x64.** Achieved icons colourful, unachieved greyscale; the editor can generate the grey one. [V S2]
4. **"Hidden" is now called "Spoiler".** Name and description stay hidden until unlocked or revealed, and spoilers do not appear in the store-page achievement panel. [V S2]
5. **Achievement names and icons must be all-ages appropriate.** Our game is profane by design, so the content lint in Rule A6 is mandatory. [V S1]
6. **`RequestCurrentStats` is deprecated.** Steam loads stats before launch (SDK 1.61+); GodotSteam removed `requestCurrentStats` and `current_stats_received` in 4.12. [V S3, S22]
7. **`IsSteamRunningOnSteamDeck` is deprecated as of SDK 1.65 and removed from GodotSteam 4.21.** Use `isRunningOnSteamHardware()`. [V S10, S24]
8. **GodotSteam now lives on Codeberg** (`codeberg.org/godotsteam/godotsteam`), current 4.23.2 (2026-10-20), Steamworks SDK 1.65, MIT. A pre-compiled 4.7.2 variant and a GDExtension for Godot 4.4+ both exist. [V S15]
9. **The spike has zero Steam integration and zero signals/events.** All gameplay hooks are direct calls inside a 4267-line `main.gd`; see section 6. [V grep of `gtai-spike/evolve/project`]

## 1. GodotSteam on Godot 4.7.x

### 1.1 Facts

| Item | Value | Source |
|---|---|---|
| Current release | 4.23.2 (2026-10-20); previous 4.23.1 (10-07), 4.23 (10-05), 4.22.1 (09-04), 4.22 (08-22) | [V S15] |
| Steamworks SDK | 1.65 (needs GodotSteam 4.21+) | [V S15] |
| Licence | MIT (GodotSteam). The Steamworks SDK itself is Valve-licensed and redistributed under the Steamworks agreement. | [V S15] / [I] for SDK terms |
| Distribution forms | GDExtension (`vX-gde` tags, "works on any Godot 4.4 and up"), pre-compiled editor + templates (`vX` tags, variants include **4.7.2** and 4.5.2), self-compile as module or GDExtension | [V S15] |
| Godot 4.7 break | "Godot 4.7 changed `callable_method_pointer.h` to `callable_mp.h` which will break backwards compatibility" - this concerns the module build path | [V S15] |
| GodotSteam's stated preference | Pre-compiled bundles "most stable and battle-tested" (said mainly of Godot 3); on Godot 4 the plug-in and pre-compiled are "pretty much on par". Do not mix the two. | [V S26] |
| Export with GDExtension | Use Godot's regular templates, NOT GodotSteam templates ("will cause a lot of issues") | [V S18] |
| Ship list | game exe + pck, `godotsteam.dll` / `libgodotsteam.so`, plus `steam_api64.dll` (Win) or `libsteam_api.so` (Linux). Do NOT ship `steam_appid.txt`. | [V S18] |
| GDExtension caveat | Edit `.godot/extension_list.cfg` or the log shows harmless errors | [V S19] |
| API drift | 4.23.2 removed `set_auto_init()` and `set_embed_callbacks()`; the call signature changed to `steamInitEx(app_id, embed_callbacks)` | [V S15, S16] |

### 1.2 Decision: GDExtension build, pinned

Rule **G1 (MUST)**: use the GodotSteam **GDExtension** release (`v4.23.2-gde` or newer) with stock Godot 4.7.2 editor and export templates. Pin the exact tag in `third_party/godotsteam/VERSION` and vendor the binaries (or a checksum-verified fetch script) so CI is reproducible. [I]
Why: our game already ships a native GDExtension (`citysim`, C++), so the repo already has a stock-template plus extensions toolchain; a custom editor/template build would add a second toolchain to a solo project [I]. GodotSteam documents GDE as "on par" for Godot 4 [V S26], and the 4.7 `callable_mp` break targets the module path, whereas a GDExtension binds through the stable extension API [I - confirm by loading the 4.23.2-gde binary in 4.7.2 before relying on it].

Rule **G2 (SHOULD)**: keep the pre-compiled 4.7.2 variant as the fallback if the GDE misbehaves on 4.7.2 (overlay, init order). Never mix both in one tree. [V S26]

Rule **G3 (MAY)**: write a custom thin GDExtension over the Steamworks flat C API only if (a) GodotSteam lags a Godot minor by more than one release, or (b) we use fewer than about 15 calls (init, callbacks, achievements/stats, cloud, overlay signal, hardware type). Cost: we then own Input glyph plumbing, callbacks marshalling, and every SDK bump. [I]

### 1.3 Setup recipe (Godot 4.7.2 + GodotSteam GDE 4.23.x)

1. Download `godotsteam` GDE release; copy `addons/godotsteam/` (contains `godotsteam.gdextension` and the per-platform libs) into `res://addons/`. Copy Valve's `steam_api64.dll` (Win) next to the exe at export. [V S18]
2. Dev app id: until our own app id exists, use **480 (Spacewar)** for plumbing smoke tests only; its achievement schema is Spacewar's, not ours [I]. Put `steam_appid.txt` (just the number) next to the Godot editor binary or project root for editor runs; **never ship it**, and `restartAppIfNecessary` returns false whenever the file exists. [V S16, S23]
3. Project Settings > Steam > Initialization: app id; leave **auto-init off** and **embed callbacks off**. We init explicitly (Rule G4). An earlier doc warned that auto-init plus embed callbacks crashed the editor, fixed in 4.16. [V S16]
4. Autoload `Platform` (section 7) with `process_mode = PROCESS_MODE_ALWAYS`. It calls `Steam.run_callbacks()` every `_process`; callbacks stop if this node can be paused. [V S16, S20]
5. Init (inside `SteamBackend.start()`):
   ```gdscript
   var r: Dictionary = Steam.steamInitEx(app_id, false)   # status: 0 ok, 1 fail, 2 no Steam client, 3 client out of date
   if r["status"] > Steam.STEAM_API_INIT_RESULT_OK: ...   # fall back to NullBackend, keep r["verbal"] in the log
   ```
   [V S16]. In shipping Steam builds call `Steam.restartAppIfNecessary(APP_ID)` BEFORE `steamInitEx` and quit if it returns true. [V S23]
6. Init MUST happen before the rendering device is created for the overlay to hook [V S11: "call SteamAPI_Init prior to initializing the OpenGL/D3D device"]. In Godot the renderer is created before autoloads run [I], so test the overlay explicitly (Rule O1); if it fails, set `SteamAppId`/`SteamGameId` via GodotSteam's project setting (which sets the env vars) and, if still dead, switch the Windows driver from `d3d12` to `vulkan`. The GodotSteam stats tutorial warns the overlay "may not appear in some Godot 4.x Vulkan setups". [V S16, S17]
7. Export: Windows x86_64, `binary_format/embed_pck=true`, stock template. Add `godotsteam.windows.*.dll` and `steam_api64.dll` to the preset's custom-file list. [V S18] for file list, [I] for preset mechanics.

### 1.4 Proton / Linux / Deck

- Deck path decision: ship the **Windows build and let Proton run it**; add a native Linux build later only if Proton shows a blocker. Valve runs non-Linux games through Proton and badges them on the result; only blocking bugs or Proton-specific performance problems give "Unsupported". [V S8] Rationale: our native C++ sim then needs one platform build, not two [I].
- What can break (all [I] unless noted): Godot `d3d12` driver under Proton (goes through vkd3d-proton, riskier than Vulkan); overlay hooks; Steam API init ordering. ProtonDB users report achievements failing under some Proton versions, anecdotal only [V reports, not measurements]. **Test on a real Deck** (or Steam Deck dev kit) before Early Access; there is no emulation substitute [I].
- Linux native, if ever built: needs `libgodotsteam.so` + `libsteam_api.so` from the SDK `redistributable_bin/linux64`; GDE `.gdextension` entries per platform. [V S18]
- Windows-ARM64 note: this dev machine is ARM64 [V fleet memory 2026-10-22]. The Steamworks `steam_api64.dll` is x64; an ARM64 Godot process cannot load it [I]. Run the **x64** Godot editor/export under emulation when testing Steam, or test on the x86_64 Ryzen box used for the city-scale gate.

Rule **G4 (MUST)**: the game boots and plays with Steam absent (client not running, init status 1/2/3, non-Steam build): `Platform` degrades to `NullBackend` and logs the reason. Absent degrades; a *malformed* state (wrong app id format, SDK version mismatch) fails loudly at boot in dev/CI. [V S19 pattern; V registry `optional-dependency-degradation`: "absent degrades, malformed fails fast"]

## 2. Achievements in depth

### 2.1 What a definition contains (partner site)

| Field | Where set | Notes | Source |
|---|---|---|---|
| API Name | definitions CSV / editor | unique, required, e.g. `ACH_WIN_ONE_GAME`; charset/length not documented; case-sensitive in localization CSV | [V S2] |
| Display Name, Description | localization CSV (two rows per achievement: `name`, `description`; one column per language) | localizable; no length limits documented | [V S2] |
| Icons achieved/unachieved | bulk PNG upload, filename-matched | 256x256 PNG recommended, min 64x64, square, JPG accepted; unachieved greyscale | [V S2] |
| Set By | `permission` column: `Client`, `GameServer`, `OfficialGameServer` | we use `Client` | [V S2] |
| Visibility | `spoiler` column | Visible or Spoiler | [V S2] |
| Optional status | `archived` column | Archived stays visible to those who unlocked it; archived still counts toward the limit | [V S2] |
| Progress stat | `progress_stat_name`, `progress_stat_min`, `progress_stat_max` | stat must already exist ("To create new stats, edit your stats first"); integer stat needs integer range | [V S2] |
| Set | `setid` | Sets are beta; base set always first; developer-only sets visible/unlockable only by developers | [V S2] |
| Limits | 5,000 achievements per app (100 until the app is vetted); 40 sets | | [V S1, S2] |

Localization: the editor language selector and the Bulk tab control which languages exist; missing text is flagged; Steam returns text for the requested language. Steam API language codes (31) are `arabic, bulgarian, schinese, tchinese, czech, danish, dutch, english, finnish, french, german, greek, hungarian, indonesian, italian, japanese, koreana, malay, norwegian, polish, portuguese, brazilian, romanian, russian, spanish, latam, swedish, thai, turkish, ukrainian, vietnamese`. [V S2, S13] Every achievement needs a name in each configured language plus an icon before the "Steam Achievements" feature can be enabled. [V S2]

### 2.2 Stats

Types: **INT** (32-bit), **FLOAT**, **AVGRATE** (moving average via `UpdateAvgRateStat`, with a Window property whose unit must match `dSessionLength`). Properties: Min, Max, Max Change, Increment Only, default. A store that breaks a constraint is rejected and values are reverted. [V S3, S5, plus search summary of S1] Stats are created on the Stats Configuration page; the bulk tab documents only achievement definitions, localization and set localization, so **stat creation is manual** [V S2, S5; absence of a stats import is an inference from reading both pages].

Progress achievements: bind a stat plus range in the definition; show the pop-up with `IndicateAchievementProgress(name, cur, max)`, which does not set progress and returns false when already unlocked or `cur >= max`. Unlock when the stat reaches max. [V S1, S3]

### 2.3 Runtime flow (current SDK)

1. Init OK -> stats and achievements are already loaded (SDK 1.61+); no `RequestCurrentStats`, no wait for `current_stats_received`. [V S3, S17]
2. Read: `getAchievement(name)` returns `{ret, achieved}`; `ret == false` means the API name is unknown or unpublished. [V S22]
3. Unlock: `setAchievement(name)` (in-memory, cheap, idempotent; returns true only if the name exists and is published) then `storeStats()` (uploads, shows the overlay toast). Callbacks `user_stats_stored` and one `user_achievement_stored` per unlock. [V S3, S17, S22]
4. Stats: `setStatInt/Float` are absolute values (not deltas), in-memory until `storeStats`. Increment-only stats return false when lowered. [V S3, S17]
5. `StoreStats` "can be rate limited. Call frequency should be on the order of minutes, rather than seconds"; call it at major state changes (end of round, map change). If it fails nothing is sent and you may retry. Steam attempts a store at exit when changes are pending. `k_EResultInvalidParam` means the server rejected some stats and sent back corrected values. [V S3]
6. Offline / multi-machine: Steam caches progress and merges achievements across machines automatically; do not keep a separate local save as the authority. [V S1] Steam client not running: no unlock is possible; that is the `NullBackend` case (section 7). Exact offline-mode store semantics are not documented in the pages read [V gap] - test it in Steam offline mode on a dev account.
7. Test tooling: `steam.exe -console`, then `achievement_clear <appid> <name>` and `reset_all_stats <appid>`; `resetAllStats(true)` in code wipes stats and achievements for the logged-in account only. [V S1, S3] Before release the Community pages do not show earned achievements, so the game MUST output unlock state itself (debug overlay/log). [V S1]
8. Dev vs released app: achievements must be defined AND **published** to be visible to the API even for an unreleased app ("The game doesn't need to be released, but unpublished items cause errors"). Developer-only sets give a safe place to test new achievements. [V S2, S17]

### 2.4 Rules (runtime)

- **R1 (MUST)** Never call `requestCurrentStats` or wait for `current_stats_received`; treat init-OK as stats-ready. [V S3, S22]
- **R2 (MUST)** `setAchievement` is the only unlock primitive, always through `Platform.unlock(id)` which is idempotent and checks `getAchievement` first to avoid redundant toasts. [V S3; I for wrapper]
- **R3 (MUST)** Coalesce `storeStats`: unlock path flushes after a short debounce (about 2 s) so a multi-unlock moment produces one store; stat-only changes flush at checkpoints (mission end, soul upgrade purchase, save, quit) with a hard minimum interval of 60 s. Never store per kill, per frame, per damage tick. [V S3 for the "minutes" guidance; I for the numbers; ~40 achievements means the unlock path is naturally rare]
- **R4 (MUST)** On `user_stats_stored` with a failure result, keep the pending flag and retry at the next checkpoint; do not spin. [V S3]
- **R5 (MUST)** Run `run_callbacks()` from an always-process autoload. [V S16]
- **R6 (SHOULD)** Use `setStatInt` continuously (cheap) so quitting stores them; `storeStats` on quit and on `NOTIFICATION_WM_CLOSE_REQUEST`. [V S1 best practice]
- **R7 (SHOULD)** Prefer fewer, derived stats; store a base and derive the rest (e.g. do not store both kills and non-kills). Set tight Min/Max and Max Change because users can tamper. [V S1]
- **R8 (MUST NOT)** Anti-patterns: unlock/store from per-frame code, from `_physics_process`, or per kill; calling `storeStats` per `setStatInt`; computing progress from UI state; treating a missing toast as a failed unlock (the toast can fail in some Vulkan setups while the unlock is recorded). [V S3, S17]
- **R9 (SHOULD)** Cheat posture: single-player Steam achievements are not tamper-proof; do not gate gameplay rewards on them, do not build server-side validation. `SetUserStatsForGame` requires a publisher key on a secure server and must never ship in a client. [V S4]
- **R10 (SHOULD)** Version stat: keep a `STAT_SCHEMA_VERSION` stat and call `resetAllStats` for all-user wipes only through a deliberate version check, as Valve describes. [V S1]

## 3. Achievement design for a satirical action game

Sources agree on a few durable principles; numbers below are our proposal [I], marked where a source backs the principle.

- **Plan them with the design, derive from content.** [V S29: "forethought, not an afterthought"]
- **Do not leave the list at progression-only; keep challenge achievements to a small handful; progression tied to meaningful beats, not "started the game".** [V S28]
- **Avoid spam; group by themed blocks.** [V S28]
- **Grind only when it overlaps what players do anyway; luck-gated "holy crap" moments should be easy or fully player-controlled; award the highest difficulty cleared.** [V S27]
- **Missables: do not let a save-file accident lose one; let players go back, or reconsider the achievement.** [V S27]
- **Measurement achievements (how well) give feedback; descriptive/clever names drive conversation; hardest ones stay scarce.** [V S29, S30]
- **Secrets are valued as discoveries but must be spoiler-aware.** [V S28; S27 argues secret criteria are poor design, so give secrets a hint in the description]
- **Wording is a design surface:** names that celebrate ("Lifesaver") beat names that punish. [V S29]

Proposal for GTAI (about 5 hours) [I]:

| Block | Count | Visibility | Target global unlock % (tune with `GetAchievementAchievedPercent` post-launch [V S1]) |
|---|---|---|---|
| Story beats (acts, bosses, finale) | 10-12 | **Spoiler** for twist-bearing ones (Act 3 betrayal, Pentagon) | 40-90% falling by act |
| Soul mastery (one verb each, plus all four in one fight) | 8-10 | Visible | 10-50% |
| Absurd / satire (profanity toggle gag, ram a mascot, 5 humans' worth of paperwork) | 8-10 | mix; at most half Spoiler | 2-25% |
| Mastery / challenge (no-hit boss, speed, one-soul run) | 3-4 | Visible | 1-5% |
| Meta (all missions; all souls maxed) | 1-2 | Visible | under 3% |
| **Total** | **30-38** | | |

All story achievements MUST be non-missable (replay by mission select, a hub-workshop, or New Game+; a missable list item is a design defect). Absurd ones SHOULD be reachable in free roam, not mission-locked.

Tone guardrails: names and icons all-ages [V S1] - the profane tone lives in the in-game voices, not in the Steam surface. Parody boundary from `pitch.md` §9: no real likeness, voice, slogan or logo of any real person or product in names or icons. [V pitch.md]

## 4. Achievement pipeline spec

### 4.1 Source of truth

`games/gtai/achievements/achievements.json` (repo, reviewed like code). One file, JSON for Node and Godot parity. Chosen over a Godot `.tres` because the generator and CI run in Node without the engine [I].

```jsonc
{
  "schema": "gtai.achievements/1",
  "languages": ["english"],                       // Steam API codes; grow later, generator reports missing text per code
  "stats": {
    "STAT_ROBOTS_STAMPED": {"type": "INT",   "min": 0, "max": 100000, "maxChange": 50, "incrementOnly": true, "default": 0},
    "STAT_PEDS_RAMMED":    {"type": "INT",   "min": 0, "max": 100000, "maxChange": 50, "incrementOnly": true, "default": 0},
    "STAT_MISSIONS_PASSED":{"type": "INT",   "min": 0, "max": 100,    "maxChange": 1,  "incrementOnly": true, "default": 0}
  },
  "achievements": [ /* see 4.2 */ ]
}
```

Per-achievement fields:

| Field | Type | Rule |
|---|---|---|
| `id` | `ACH_[A-Z0-9_]{3,44}` | the Steam API name; immutable once published (rename = new achievement; delete removes it for all players [V S2]) |
| `block` | story / soul / absurd / mastery / meta | drives count and rarity lint |
| `name`, `desc` | `{lang: text}` | `english` required; other languages optional until shipping; no profanity, no real brands |
| `hidden` | bool | becomes the `spoiler` column |
| `stat` | `{name, goal}` or null | becomes progress binding when `goal` is a stat range; INT only |
| `trigger` | object, see below | tracked in game by `AchievementTracker`, not by Steam |
| `missable` | bool | MUST be false for `story` |
| `icon` | brief object | motif, palette key, notes; generator makes the prompt |
| `source` | content ref | e.g. `mission:garage_run`, `entity:hauler`; generator checks it exists in `entities.json` / `canon.json` |

Trigger grammar (deliberately tiny, no scripting):

```jsonc
{"on": "robot_killed",                    // a GameEvents signal name (section 6)
 "where": {"death_kind": "stamped", "by": "player"},   // equality / in / gte on event fields
 "do": {"stat_inc": ["STAT_ROBOTS_STAMPED", 1]},       // or {"flag": "name"}, or {"unlock": true}
 "unlock_when": {"stat_gte": ["STAT_ROBOTS_STAMPED", 25]}}   // or {"flag_all": [...]}, or implied by do.unlock
```

### 4.2 Sample entries (tone: satirical, ink-and-riso look)

```jsonc
[
 {"id":"ACH_STORY_LAID_OFF","block":"story","hidden":false,
  "name":{"english":"Consider Yourself Laid Off"},
  "desc":{"english":"Take out the suit in the first payphone job. Severance not included."},
  "trigger":{"on":"mission_target_down","where":{"mission":"payphone_suit"},"do":{"unlock":true}},
  "missable":false,"source":"mission:payphone_suit",
  "icon":{"motif":"cardboard box with a tie sticking out","palette":"riso_red"}},

 {"id":"ACH_STORY_PER_MY_LAST_FAX","block":"story","hidden":true,
  "name":{"english":"Per My Last Fax"},
  "desc":{"english":"Learn who has been sending the paperwork."},
  "trigger":{"on":"story_flag_set","where":{"flag":"don_fax_betrayal"},"do":{"unlock":true}},
  "missable":false,"source":"entity:don-fax",
  "icon":{"motif":"fax page curling out of a machine, stamped CONFIDENTIAL","palette":"riso_blue"}},

 {"id":"ACH_SOUL_HAULER_FLATTEN_25","block":"soul","hidden":false,
  "name":{"english":"Gentle Giant"},
  "desc":{"english":"Stamp 25 robots flat with the Hauler. He apologises each time."},
  "stat":{"name":"STAT_ROBOTS_STAMPED","goal":25},
  "trigger":{"on":"robot_killed","where":{"death_kind":"stamped","by":"player"},"do":{"stat_inc":["STAT_ROBOTS_STAMPED",1]},"unlock_when":{"stat_gte":["STAT_ROBOTS_STAMPED",25]}},
  "missable":false,"source":"entity:hauler",
  "icon":{"motif":"flattened robot silhouette under a tank tread, tiny heart","palette":"riso_teal_souls"}},

 {"id":"ACH_SOUL_FOUR_VOICES_ONE_FIGHT","block":"soul","hidden":false,
  "name":{"english":"Quiet In Here"},
  "desc":{"english":"Wear all four souls inside a single boss fight. They will not stop talking."},
  "trigger":{"on":"soul_swapped","where":{"distinct_forms_in_encounter":{"gte":4}},"do":{"unlock":true}},
  "missable":false,"source":"entity:souls",
  "icon":{"motif":"one robot head, four overlapping speech bubbles","palette":"riso_teal_souls"}},

 {"id":"ACH_ABSURD_PROFANITY_SORRY","block":"absurd","hidden":true,
  "name":{"english":"ON (Sorry)"},
  "desc":{"english":"Try to turn the language down. Several times. Be persistent."},
  "trigger":{"on":"setting_toggle_attempted","where":{"setting":"profanity"},"do":{"stat_inc":["STAT_PROFANITY_TOGGLES",1]},"unlock_when":{"stat_gte":["STAT_PROFANITY_TOGGLES",5]}},
  "missable":false,"source":"pitch:6-tone",
  "icon":{"motif":"toggle switch stuck halfway, tiny bandage","palette":"riso_red"}},

 {"id":"ACH_ABSURD_HIT_AND_RUNBOT","block":"absurd","hidden":false,
  "name":{"english":"Jaywalking Is a Choice"},
  "desc":{"english":"Run over 20 pedestrians before the first act ends. They saw it coming; they were looking at phones."},
  "stat":{"name":"STAT_PEDS_RAMMED","goal":20},
  "trigger":{"on":"ped_killed","where":{"how":"car","in_act":1},"do":{"stat_inc":["STAT_PEDS_RAMMED",1]},"unlock_when":{"stat_gte":["STAT_PEDS_RAMMED",20]}},
  "missable":true,"source":"entity:peds",
  "icon":{"motif":"crosswalk with a single skid mark","palette":"riso_red"}},

 {"id":"ACH_MASTERY_NO_HIT_KING","block":"mastery","hidden":false,
  "name":{"english":"Untouched Scrap"},
  "desc":{"english":"Beat King without taking damage."},
  "trigger":{"on":"boss_defeated","where":{"boss":"king","damage_taken":{"eq":0}},"do":{"unlock":true}},
  "missable":true,"source":"entity:king",
  "icon":{"motif":"crown with a clean dent-free robot shadow","palette":"riso_gold"}},

 {"id":"ACH_META_RIVET_RETIRES","block":"meta","hidden":true,
  "name":{"english":"Humanity: Recycled"},
  "desc":{"english":"Finish the game."},
  "trigger":{"on":"game_completed","where":{},"do":{"unlock":true}},
  "missable":false,"source":"pitch:finale",
  "icon":{"motif":"blue recycling arrows around a small silhouette of a building","palette":"riso_blue"}}
]
```

(`missable:true` examples above are allowed only for `absurd`/`mastery`, and the generator requires a one-line "how to retry" note in the free-roam or mission-select design before accepting them. Names above are working titles; the owner owns tone.)

### 4.3 Generator (`tools/achievements/gen.mjs`)

Inputs: `achievements.json`, `games/gtai/entities.json`, `canon.json`, `events.json` (the signal catalogue, section 6), icon source PNGs. Order of work:

1. **Validate (fail the build, never degrade):** unique ids; id regex; `english` text present; no duplicate names; `story` entries `missable:false`; trigger `on` exists in `events.json` AND an emit site exists in code (grep `GameEvents.<name>.emit` in `*.gd`) - a trigger with no emitter is a dead achievement (the wiring-contract failure: real on disk, unreachable in play) [V registry `wiring-contract-doctrine`]; every `stat` referenced exists in `stats`; every stat-bound achievement has `goal` equal to its progress max; counts and block mix within the section 3 bands (warn, not fail); all-ages lint (profanity wordlist, real-brand wordlist) on `name`, `desc`, icon brief; `source` resolves in canon.
2. **Emit Steam files** into `build/steam/`:
   - `definitions.csv`: `api_name,setid,permission,spoiler,archived,progress_stat_name,progress_stat_min,progress_stat_max` [V S2 column list].
   - `localization.csv`: two rows per achievement (`name`, `description`) with one column per Steam language code [V S2].
   - `icons/<ID>_ACHIEVED.png` and `<ID>_UNACHIEVED.png`, 256x256 PNG [V S2].
   - `STATS_TO_CREATE.md`: one table row per stat for the manual Stats Configuration entry.
   - `UPLOAD_CHECKLIST.md`: the manual steps in 4.4.
   - Before the first real run, **export the templates from the partner site and diff headers** against the generator's output; the generator reads header text from the exported files rather than hard-coding it [I; S2 says header notes are ignored on upload].
3. **Emit runtime files:** `src/platform/achievements/ach_ids.gd` (generated `class_name AchIds` with `const` per id and per stat, so typos are compile-time errors) and `achievements_runtime.json` (triggers + stat bindings only, no text; display text comes from Steam via `getAchievementAndUnlockTime`/localised attributes or from game i18n for non-Steam builds). Generated files carry a "DO NOT EDIT" header and a content hash; CI regenerates and fails on drift. [I]
4. **Icon pipeline:** briefs become image prompts in the Trivet D1 Riso look (GTAI-approved image generation; production-asset policy per fleet-memory 2026-11-02 [V fleet memory]). Spec for every brief: square 1:1, 256x256 final, one subject centred with a safe margin, no embedded text (text localises), no gore, palette from `palette` key. Derive **unachieved** deterministically: Rec.709 luminance to grey, contrast compressed, no colour; acceptance requires the grey version to remain distinguishable (the 64x64 downscale must keep a minimum edge density and each icon's perceptual hash must differ from every other by a threshold). [V S2 greyscale convention; I for the derivation and thresholds] Steam's editor can also generate grey icons, so derivation is belt-and-braces, not a dependency.

### 4.4 Automation verdict

| Step | Automatable? | Verdict |
|---|---|---|
| Author definitions, text, ids, spoiler flags, progress bindings | Yes | Generated from `achievements.json` [V S2] |
| Produce the definitions CSV, localization CSV, set CSV | Yes | Plain files [V S2] |
| Produce icons (256 PNG, achieved + grey) | Yes | Image gen + deterministic grey derivation [I] |
| Upload them to Steam | **No API** | Partner-site Bulk Import tab: drag CSVs and PNGs, review errors, **Save imported data**. Human, about 5 minutes. [V S2, S4] |
| Create stats (INT/FLOAT/AVGRATE, min/max/max change/increment-only) | **No documented import** | Manual on Stats Configuration; generator prints the table. Keep stats to a handful. [V S5; absence = I] |
| Add languages | Manual | Language selector or Bulk tab setting [V S2] |
| Publish to the draft/live configuration | Manual | Publish tab in Edit Steamworks Settings [V S2] |
| Enable "Steam Achievements" supported feature on the store page | Manual | [V S2] |
| Delete an achievement | Never casually | Removes it for everyone, even unlockers; archive instead [V S2] |
| Drive the partner site with browser automation | Technically possible, not recommended | Login, Steam Guard and a UI with no stability contract; the manual step is small [I] |
| Read back to verify | Yes, via Web API | `GetSchemaForGame` (publisher key) lists published stats/achievements; CI can diff it against `achievements.json` after a manual publish [V S4 lists the method; I for the CI use] |

Net: about 90% of the labour is generated; a single human upload-and-publish pass remains, and verification is automatable.

### 4.5 Runtime binding: event bus + tracker + local mirror

```
gameplay code --emit--> GameEvents (autoload, typed signals)
                          |
                  AchievementTracker (autoload)   <- achievements_runtime.json
                    - evaluates where/do/unlock_when
                    - owns stat counters (authoritative in-memory copy)
                          |
                    Platform.unlock(id) / Platform.set_stat(name, v) / Platform.flush()
                          |
           SteamBackend | NullBackend (writes local mirror)
```

- **E1 (MUST)** Gameplay emits domain events only (`robot_killed`, `soul_swapped`, `mission_passed`...). It never calls Steam, `Platform`, or the tracker directly. [I; consistent with the repo's typed event bus convention in the app, `src/lib/event-bus.ts`]
- **E2 (MUST)** Events carry a payload dictionary with stable keys that triggers reference (`by`, `death_kind`, `mission`...). Event names and payload keys live in `events.json`, validated against the emit sites. [I]
- **E3 (MUST)** The tracker is deterministic and engine-free in its core (plain GDScript class, no scene tree), so it is unit-testable headless and replayable from a recorded event log. [I]
- **E4 (MUST)** Local mirror: `user://achievements_mirror.json` stores `{unlocked: {id: unixtime}, stats: {...}, pending: [ids not yet confirmed by Steam]}`. In Steam builds it is an **outbox/journal**, not the authority: at startup reconcile (union of Steam-unlocked and mirror-unlocked; unlock the difference in Steam), clear `pending` on `user_achievement_stored`. In Null builds it is the store and powers an in-game achievement list. The mirror MUST NOT be inside Auto-Cloud paths (Steam is the cross-device authority). [V S1 for "Steam merges"; I for the journal design]
- **E5 (SHOULD)** Run-scoped conditions (e.g. "no damage taken in this boss fight", "four forms in one encounter") are computed by the tracker from events (`encounter_started/ended`, `damage_taken`), never by sampling game nodes.
- **E6 (MUST NOT)** Unlock from UI thread handlers or per frame; unlock happens in the event dispatch, which is one call per domain event. [V S3 for cost model]

## 5. Steam Cloud, Input, Rich Presence, overlay, Deck

### 5.1 Steam Cloud

Facts: Auto-Cloud needs no code; you list file groups in Steamworks; Steam syncs before and after each session and uploads changed files after the session. Roots include `WinAppDataRoaming`, `WinAppDataLocal`, `WinSavedGames`, `WinMyDocuments`, `LinuxXdgDataHome`, `LinuxHome`, `SteamCloudDocuments`, `App Install Directory`; subdirectories may use `{64BitSteamID}`. Quotas are per user per game (byte quota and file count, set on the Cloud Settings page). `FileWrite` caps at 100 MiB, path max 260 chars, names must be valid on all OSes. The API route (`ISteamRemoteStorage`) gives per-file control; `SetSyncPlatforms` restricts platforms; the dynamic-sync callback (`local_file_changed`) lets a running game react to changes (e.g. Deck resume). Steam offers a conflict dialog at launch when local and cloud differ; the dialog chooses between whole saves by timestamp. [V S6, S7, S21, S35]

- **C1 (SHOULD)** Use **Auto-Cloud**, not the API. Our save is a plain file; the API only adds merge work and corruption risk. [I; V S21 notes the API needs your own merge]
- **C2 (MUST)** Save path: set a stable custom user dir (`application/config/use_custom_user_dir`) so the path is deterministic, and print `OS.get_user_data_dir()` in the log. Godot's default `user://` on Windows is under `%APPDATA%` (Roaming) [I - confirm in Godot docs], so the Auto-Cloud root is `WinAppDataRoaming` plus the app dir. Under Proton the same Windows path resolves inside the Proton prefix; Steam applies Windows roots there [I - **verify on a real Deck**; S6 does not mention Proton].
- **C3 (MUST)** Keep the cloud file set small and stable: one `save_N.json`/`.sav` per slot plus `settings.json`; never put the mirror, caches, screenshots, or logs in the cloud group. Save atomically (write temp, fsync, rename). Versioned save header with `save_seq` (monotonic) and `schema` for forward/back compatibility.
- **C4 (SHOULD)** Conflicts are Steam's dialog; give saves a visible in-game "last played, playtime, mission" so the dialog's timestamps are corroborated by the title screen. [I; V S35 players are told to check timestamps]
- **C5 (SHOULD)** Save on key moments, not only on exit: Steam sends no suspend callback on Deck. [V S21]

### 5.2 Steam Input and glyphs

Facts: Deck Verified requires that on-screen glyphs match the active input (Deck, Steam Controller, Xbox...), no mouse/keyboard glyphs when not active, the default configuration reaches all content without changing in-game settings, and text entry opens the Steam on-screen keyboard or a controller-usable in-game input. Valve recommends the Steam Input API for glyphs. [V S8] `ISteamInput` provides `GetGlyphPNGForActionOrigin` / `GetGlyphSVGForActionOrigin` (not the legacy glyph call), `GetInputTypeForHandle`, action sets, `GetControllerForGamepadIndex` (0 = not a Steam Input device). [V S9] GodotSteam tutorial: needs `inputInit`, `enableDeviceCallbacks`, `runFrame` each frame in an always-process autoload; action names must match Godot's input map; glyphs occasionally load wrong until refreshed. [V S20] Godot 4.5+ uses SDL3 for joypads [V search result of godotengine.org 4.5 beta 2]; a third-party glyph module documents that identifying which pad maps to which Steam handle needs engine support. [V S33]

- **I1 (SHOULD, phase 1)** Hybrid: keep Godot `InputMap` actions as the single input path (Steam's gamepad emulation presents an XInput pad); add Steam only to **identify the device type** (`getInputTypeForHandle` via the active Steam Input handle where one exists) and select a **static glyph atlas** per type (Deck, Xbox, PlayStation, Switch, Keyboard/Mouse). Glyph switch follows the *last used* device (`InputEvent` class), with a fixed 0.5 s hysteresis. [I]
- **I2 (MAY, phase 2)** Native Steam Input actions via an IGA manifest and `getGlyphPNGForActionOrigin`, only if gyro or per-player binding UX demands it. [V S9, S20; I for the staging]
- **I3 (MUST)** Every text field (e.g. save naming, if any) calls `showFloatingGamepadTextInput` when a controller is the active device; handle `floating_gamepad_text_input_dismissed`. [V S8, S24]
- **I4 (MUST)** Deck legibility: smallest on-screen text at least 9 px at 1280x800 (12 px recommended); our viewport is 1280x720 and `stretch=canvas_items` per the spike, so HUD fonts must be authored against that floor. [V S8; spike `project.godot`]
- **I5 (MUST)** Default controller layout reaches all content (menus, workshop, soul swap on d-pad, mission select) without touching in-game settings. The spike already maps `form1..4` to d-pad. [V S8; spike `main.gd:331`]

### 5.3 Rich Presence

- **P1 (SHOULD)** Set `steam_display` to a localized token (`#InMission`, `#FreeRoam`, `#BossFight`) plus a few raw keys (`mission`, `act`, `soul`); provide the localization token file in Steamworks. Keys and values have limits and `setRichPresence` returns false past them (check the return). Update on state changes only, never per frame. Test on `steamcommunity.com/dev/testrichpresence`. [V S12, S25]
- **P2 (MUST NOT)** Put spoilers (boss names, the betrayal) in Rich Presence; friends see it. [I]

### 5.4 Overlay, Big Picture, Deck APIs

- **O1 (MUST)** Test the overlay in a release export with the real app id (Shift+Tab) on both Windows and Deck before any build goes to review; this is the single most likely integration failure with a custom-renderer engine. [V S11, S17; I for priority]
- **O2 (MUST)** Pause the simulation on `overlay_toggled(toggled=true)`; resume on false. The game must also pause on focus loss. [V S11, S25]
- **O3 (SHOULD)** Never poll `isOverlayEnabled()` at start; it returns false for a few seconds while the overlay starts. [V S10]
- **O4 (MUST)** Detect hardware with `Steam.isRunningOnSteamHardware()` (enum: Deck, Machine, Frame), not the removed `isSteamRunningOnSteamDeck()`. Use it to default UI scale, glyph set and quality preset. [V S10, S24] Deck's performance floor: 30 fps at 800p default settings. [V S8]
- **O5 (SHOULD)** Big Picture: `isSteamInBigPictureMode()` only returns true for the "game" app type launched via Steam; treat it as a hint for gamepad-first menus, not for gating features. [V S10, S24]
- **O6 (MUST)** No launcher, no "unsupported device" dialog, no mandatory mouse step on first boot. [V S8]

## 6. Grounding: the spike has no Steam and no events

`C:\Users\kazda\kiro\gtai-spike\evolve\project`: `grep -il steam` over `.gd/.cfg/.godot/.json/.md/.cpp/.h/.toml` returns nothing; no autoloads in `project.godot`; export preset is Windows Desktop with embedded pck only. **There is not a single `signal` declaration or `.emit(` in any of its 9 GDScript files (7201 lines; `main.gd` = 4267).** Everything is direct calls and state flags. [V grep]

Where an event bus would hook (file:line in `game/` of the spike; line numbers as of this read):

| Candidate event | Single chokepoint | Notes |
|---|---|---|
| `robot_killed {victim.kind, by, weapon, death_kind}` | `main.gd:789` `_damage()`, the death branch `if r.hp <= 0` at about `:813-823` (`r.dead = true` at `:815`) | the one kill chokepoint for guns, melee, bombs, burn, ram; `death_kind` is `shot/blown/burned/stamped` (`robot.gd:74`; set at `arsenal.gd:226`, `arsenal.gd:370`, `moves.gd:120`) |
| stamped-finisher | `moves.gd:119-120` | sets `death_kind = "stamped"` after lethal `_damage` |
| `ped_killed {how}` | `main.gd:2274` `_kill_ped()`; `ped_kills` counter `:2122`/`:2280` | `how` = car/fire/explosion; car hits at `main.gd:2262` `_car_hits()` |
| car ram | `main.gd:3511` `_car_ram()`, counter at `:3534`; player-in-car kill at `main.gd:1666` | |
| `soul_swapped {form}` | `main.gd:2453` `_swap_form()`; input `main.gd:699`; `robot.gd:605` `set_form()`; names `robot.gd:587` (`RIVET HAULER GEARBOX SENTRY MOP`) | Hauler ram contact kills at `main.gd:2503` (`_ram_contacts`) |
| `car_entered / car_exited` | `main.gd:1641` / `:1648` | |
| `wanted_changed {level}` | assignments at `main.gd:828`, `:841`, `:1841`, `:1884`, `:3380`, `:3436`, `:3489`, `:3637` (`var wanted` at `:1605`) | eight write sites: wrap in a setter |
| `cash_changed` | `var cash` `main.gd:1604`; writes at `:840`, `:3488`, `:3638` | |
| mission state | `main.gd:3364` `_ms_go(state, objective)`; passed at `:3487-3490`; target down `:3631` `_mission_kill()`; finish `:3837` `_finish_mission()` | `_ms_go` is the state-transition chokepoint |
| round/boss duel result | `main.gd:833-845` (round winner, `score[]`, `match_over`) | King duel; per-boss `boss_defeated` should hang here |
| bomb thrown | `moves.gd:181` `throw_bomb()` | |
| weapon fired / melee / kick | `main.gd:701` `_try_fire`, `:785` `_try_melee`, `moves.gd:143` kick, `moves.gd:162-166` slam | high frequency: stat-only, never store |
| `wave_cleared` | `main.gd:3304` `_finish_wave()` | |

Gaps for the achievement design [V grep; I for the fix]: no player damage-taken aggregator for "no-hit" runs (`_damage` receives it but nothing records it); no encounter start/end markers; no act index; no story flags (the Act 3 betrayal does not exist yet); no settings screen, so the profanity-toggle gag has no emit site; no notion of New Game+ or mission select. These are content/design work items, not blockers.

Recommended first code change (not done here; research only): introduce `GameEvents` autoload with the table above as typed signals and replace the eight `wanted =` writes with a setter that emits.

## 7. Platform layer design

```
res://src/platform/
  platform.gd                 # autoload "Platform": picks backend, owns lifecycle, exposes facade
  backends/
    platform_backend.gd       # abstract: the interface below
    null_backend.gd           # offline: local mirror, logs, returns success
    steam_backend.gd          # GodotSteam calls only here
    fake_backend.gd           # tests: records calls, scripted failures
  achievements/
    achievement_tracker.gd    # engine-free core
    ach_ids.gd                # GENERATED
    achievements_runtime.json # GENERATED
```

Interface (every method returns synchronously; async results arrive as signals):

| Method / signal | Contract |
|---|---|
| `start() -> Dictionary` | `{ok, backend, reason}`; never throws; picks Steam when `OS.has_feature("steam")` and init is OK |
| `shutdown()` | flush then shut down |
| `is_online() -> bool` | Steam client connected |
| `unlock(id) -> void` | idempotent; queued if offline; flushed per R3 |
| `set_stat(name, value)`, `inc_stat(name, d)`, `get_stat(name)` | in-memory; flush coalesced |
| `flush(reason)` | `storeStats` with min-interval guard |
| `signal achievement_confirmed(id)`, `signal store_failed(reason)` | from `user_achievement_stored` / `user_stats_stored` |
| `rich_presence(token, kv)` | no-op in Null |
| `hardware() -> StringName` | `&"deck" / &"machine" / &"pc"` |
| `signal overlay_toggled(open)` | Null never fires |
| `text_input_request(rect)` | Steam keyboard or in-game fallback |
| `glyph_family() -> StringName` | `xbox / playstation / deck / switch / kbm` |
| `cloud_enabled() -> bool` | informational; Auto-Cloud needs no API |

Rules:

- **L1 (MUST)** `steam_backend.gd` is the only file that mentions `Steam.` APIs. A lint (grep in CI) fails the build if `Steam.` appears outside `res://src/platform/backends/`. [V S19 recommends "keep Steam-specific code in one place"; I for the CI lint]
- **L2 (MUST)** Backend selection by export feature tag (`steam`) plus runtime init result; a build without the `steam` tag does not even load the GodotSteam extension (ship list differs; GDE `.gdextension` file is only in the Steam export's include filter). [V S18, S19; I for the include-filter mechanics]
- **L3 (SHOULD)** Later stores (GOG, itch, Epic) become new backends behind the same interface; `unlock/set_stat` names are generic. [I]
- **L4 (MUST)** `NullBackend` is not a stub that returns true and forgets: it persists the mirror (E4) and is the shipping behaviour for "Steam not running", so an offline player's unlocks are replayed into Steam on the next Steam launch. [I; V registry "a fallback is named, not graceful"]
- **L5 (SHOULD)** Log the active backend and the init `verbal` string at boot and show the backend in the debug overlay; a build running Null when Steam was expected is a visible defect. [V registry "the week in fallback mode"; I]

## 8. Testing in CI without Steam

- **T1 (MUST)** CI never needs the Steam client. Unit tests run against `FakeBackend`; headless run via the Godot binary with `--headless`, an import pass first (`godot --headless --import .`), and a test runner (gdUnit4 via `MikeSchulze/gdUnit4-action`, or Vest). Some input-dependent tests need a virtual display (`xvfb-run`, `--audio-driver Dummy`). [V S32 for commands; reports of headless input problems are anecdotal]
- **T2 (MUST)** Generator tests in Node: schema validation, id regex, emitter-wiring check (every trigger event has an emit site), CSV shape against the exported template headers, icon spec check (256x256, PNG, grey derivation differs from colour).
- **T3 (MUST)** Tracker replay tests: golden event logs (JSON lines recorded from the spike's `--missiontest` style scripted runs) produce exact unlock sets. The spike already has scripted, fixed-timestep self-tests that print structured lines (`[soul]`, `[chase]`, `[gtai] mission done`) which can feed this. [V spike `main.gd` prints; I]
- **T4 (SHOULD)** Contract test: `NullBackend` and `FakeBackend` run the same behaviour suite as `SteamBackend` would; `SteamBackend` itself is covered by a manual "smoke checklist" (one button in a debug menu: init status, unlock a test achievement, store, read back) run against a dev-only set before each release candidate. [V S2 dev-only sets; I]
- **T5 (SHOULD)** Post-publish drift check: nightly/on-demand job calls `GetSchemaForGame` and diffs against `achievements.json` ids (needs publisher key in a secret store, never in the client). [V S4; I]
- **T6 (MUST NOT)** CI must not set `steam_appid.txt`, ship Steam binaries into test builds, or log the publisher key. [V S18]

## 9. Gap table (GTAI today vs this standard)

| # | Area | Current | Required | Size |
|---|---|---|---|---|
| 1 | Steam client integration | none | GodotSteam GDE + `Platform` autoload | M |
| 2 | Event bus | none (0 signals, direct calls) | `GameEvents` autoload; emit at the section 6 chokepoints | M |
| 3 | Achievement data/generator | none | `achievements.json` + `gen.mjs` + validation + CSV/icons + `ach_ids.gd` | M |
| 4 | Stat model | none | 3-6 Steam stats created by hand; tracker counters | S |
| 5 | Icons | none | brief to image gen to 256 PNG + grey derivation + gate | M |
| 6 | Settings screen (profanity gag) | none | settings scene + emit site | S |
| 7 | Encounter / act / story-flag model | none | needed for no-hit, in-act, betrayal triggers | M (design) |
| 8 | Wanted/cash setters | 8 and 3 raw write sites | setters that emit | S |
| 9 | Overlay pause | none | `overlay_toggled` pause + focus pause | S |
| 10 | Glyphs / Input type | keyboard + pad bindings only | glyph families + device-type detection | M |
| 11 | Cloud | none | Auto-Cloud group, custom user dir, save versioning | S |
| 12 | Deck readiness | untested | 1280x800 text floor, 30 fps default, keyboard, Proton test | M |
| 13 | Rich Presence | none | token file + 3-5 keys | S |
| 14 | CI | scripts only | headless unit/replay tests; generator tests | M |
| 15 | Renderer on Proton | `d3d12` driver on Windows | test d3d12 vs vulkan under Proton; pick per result | S |
| 16 | ARM64 dev box vs x64 `steam_api64.dll` | unverified | test via x64 editor/emulation or x86_64 box | S |

## 10. Open questions

1. Does the 4.23.2-gde binary load on stock 4.7.2 with D3D12 and show the overlay? (Verify before committing to G1.) The release notes could not be read; the "4.4 and up" claim is from the releases index only.
2. Final Steam API name charset and length limits are undocumented in the pages read; generator uses `[A-Z0-9_]` and 48 chars as a safe subset. Confirm against the exported template or a test publish.
3. Exact header row of the exported definitions/localization CSV; the generator must read it, not assume it.
4. Does the stats configuration offer any import path not documented on the pages read (hence "manual")?
5. Offline-mode behaviour of `storeStats`/unlock when Steam is in offline mode (documentation gap). Needs a dev-account test.
6. Is the Godot default `user://` root `WinAppDataRoaming` for our project, and does Steam apply that root inside the Proton prefix on Deck?
7. Steam Deck Verified: confirm the Valve review treats a Proton-only submission with `d3d12` as acceptable; no source seen either way.
8. Do we want achievement text to be translated at launch (31 Steam languages exist) or English-only first? The generator supports adding languages later; Steam requires every configured language to be complete.
9. Is New Game+ or mission select in scope? It decides whether `missable` is ever acceptable for story achievements.
10. Dev app id: when does the owner create the Steamworks app (a $100 fee, a 21-day wait before release, and a two-week public "coming soon" page [V S14])? Real-schema testing needs it.
11. Final soul names and the fourth soul are open in `pitch.md`; soul achievements must use stable ids that do not embed a working name (use `ACH_SOUL_<n>_...` and reference `source`).

## 11. Sources

Steamworks (verified 2026-11-02):
- S1 https://partner.steamgames.com/doc/features/achievements
- S2 https://partner.steamgames.com/doc/features/achievements/ach_guide
- S3 https://partner.steamgames.com/doc/api/ISteamUserStats
- S4 https://partner.steamgames.com/doc/webapi/ISteamUserStats
- S5 https://partner.steamgames.com/doc/features/achievements/stats_guide
- S6 https://partner.steamgames.com/doc/features/cloud
- S7 https://partner.steamgames.com/doc/api/ISteamRemoteStorage
- S8 https://partner.steamgames.com/doc/steamdeck/compat
- S9 https://partner.steamgames.com/doc/api/ISteamInput
- S10 https://partner.steamgames.com/doc/api/ISteamUtils
- S11 https://partner.steamgames.com/doc/features/overlay
- S12 https://partner.steamgames.com/doc/features/enhancedrichpresence
- S13 https://partner.steamgames.com/doc/store/localization/languages
- S14 https://partner.steamgames.com/doc/gettingstarted/onboarding

GodotSteam:
- S15 https://codeberg.org/godotsteam/godotsteam and https://codeberg.org/godotsteam/godotsteam/releases (current 4.23.2, SDK 1.65, MIT, 4.7.2 variant, GDE 4.4+; the releases page content was read through a summarising fetch)
- S16 https://godotsteam.com/tutorials/initializing/
- S17 https://godotsteam.com/tutorials/stats_achievements
- S18 https://godotsteam.com/tutorials/exporting_shipping/
- S19 https://godotsteam.com/tutorials/remove_steam/
- S20 https://godotsteam.com/tutorials/inputs/
- S21 https://godotsteam.com/tutorials/dynamic_cloud_sync/
- S22 https://godotsteam.com/classes/user_stats/
- S23 https://godotsteam.com/classes/main/
- S24 https://godotsteam.com/classes/utils/
- S25 https://godotsteam.com/classes/friends/
- S26 https://godotsteam.com/getting_started/introduction/

Design, testing, other:
- S27 https://www.gamedeveloper.com/design/achievement-design-101
- S28 https://docs.retroachievements.org/developer-docs/achievement-design.html
- S29 https://www.gamedeveloper.com/design/the-cake-is-not-a-lie-how-to-design-effective-achievements
- S30 https://www.gamedeveloper.com/design/unlocking-achievements-rewarding-skill-with-player-incentives (seen in search results only)
- S31 https://developer.android.com/games/pgs/achievements (standard vs incremental, hide spoilers; search result only)
- S32 https://github.com/MikeSchulze/gdUnit4-action and https://foxssake.github.io/vest/latest/user-guide/running-on-ci
- S33 https://eirteam-docs.readthedocs.io/en/latest/documentation/input_glyphs/input_glyphs_getting_started.html
- S35 https://store.steampowered.com/news/app/2076670/view/694276363007295878 (Cloud sync conflict on Deck/Linux, news post; search snippet)
- Registry: `software-engineering/backend-platform/resilience/optional-dependency-degradation`, `game-production/content-pipeline/wiring-contract-doctrine` (via ai-registry)
- Repo: `games/gtai/pitch.md` (§3-§9), `.claude/fleet-memory.md` (2026-10-22 ARM64; 2026-11-02 engine lock), spike `gtai-spike/evolve/project/game/*.gd`
