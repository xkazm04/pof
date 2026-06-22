# Codex Pipeline

> Catalog ID `codex` · Category Quests & Narrative · `dialogue-quests` module · 11 steps · Tracks: logic, art-2d, test

**Purpose.** Authors an in-game encyclopedia entry unlocked by player progression — enriching the post-Sundering lore through earned discovery rather than front-loaded exposition. Entries are spoiler-gated: an entry only reveals information consistent with unlocks already reached (canon game-lore-canon). `UARPGCodexComponent` on the PlayerController holds the set of unlocked entry ids; entries are read from `DT_Codex` and become visible once the matching `State.Codex.Unlocked.<EntryId>` tag is granted. Spoiler fields are stripped/redacted server-side until their spoiler tag is granted.

## Target / starter entity
- **The Sundering** (`codex-sundering`) — The founding lore entry describing the catastrophic magical event that shattered the old world. A contested, unreliable-narrator archival record that cross-references the Ashen Order faction, the Ashen Forest zone (`z-ashen`), and Captain Vael — all entities the player meets through normal early-game progression.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength('brief', ≥300)` |
| 2 | Lore Body | schema | — | L0 · `minLength('loreBody', ≥400)` |
| 3 | Cross-References | graph | — | L0 · `graphValid('graph')` — reachable + terminal |
| 4 | Unlock Rules | rules | `GE_Codex_Unlock_Sundering` | L0 · `fieldsPopulated('unlockRules', [primary, fallback])` |
| 5 | Spoiler Tagging | rules | `GE_Codex_Spoiler_Sundering_ClassifiedTestimony` | L0 · `fieldsPopulated('spoilerRules', [classifiedTestimonyField, orderFacilityOriginField])` |
| 6 | Illustration | gallery | `T_<name>_CodexIllustration`, `T_<name>_CodexIcon` | L1 · `selected('selected')` |
| 7 | Audio Sting | rules | `SC_Codex_Unlock_<name>`, `SC_Codex_SpoilerReveal_<name>` | L0 · `fieldsPopulated('audioSting', [unlockSting, spoilerRevealSting])` |
| 8 | Accessibility | checklist | — | L0 · `minCount('a11yChecks', ≥1)` |
| 9 | Localization | checklist | — | L0 · `minCount('locKeys', ≥1)` |
| 10 | Test Gate | checklist | — | L3 · `runtimeDeferred('VSCodexUnlockTest')` |
| 11 | UE Packaging | manifest | `DT_Codex::<s>`, `GE_Codex_Unlock_<s>`, `GE_Codex_Spoiler_<s>_ClassifiedTestimony`, `T_<s>_CodexIllustration`, `T_<s>_CodexIcon`, `SC_Codex_Unlock_<s>`, `SC_Codex_SpoilerReveal_<s>` | L0 · `minCount('assets', ≥3)` |

## UE wiring
- **C++ symbols:** `UARPGCodexComponent` (PlayerController; maintains a `TSet<FName>` of unlocked entry ids, persists to save-game), `FARPGCodexRow`, `AARPGQuestComponent` (`OnStageComplete` drives unlock + spoiler), `ATriggerVolume` (fallback zone-entry unlock).
- **DataTables:** `DT_Codex` (row keyed by entity id; spoiler fields never stripped from the row — redacted at render time).
- **GameplayEffects / tags:** `GE_Codex_Unlock_<s>` grants `State.Codex.Unlocked.<id>`; `GE_Codex_Spoiler_<s>_ClassifiedTestimony` grants the classified-testimony spoiler tag (gates both the testimony paragraph and the Order-facility-origin implication under one tag).
- **Audio:** `SC_Codex_Unlock_<s>` / `SC_Codex_SpoilerReveal_<s>` SoundCues (2D SFX bus, `PlaySoundAtLocation` on the respective tag-grant events).
- **Seed script:** `seed_codex.py` (seeds the `DT_Codex` row).
- **Runtime test:** `VSCodexUnlockTest` (PIE — entry unlocks at its trigger, spoiler gate respected, cross-refs navigable, no spoiler leak).
- **Cross-catalog links:** factions (`faction-ashen-order`), zone-map (`zone-z-ashen`, seeded via seed-zone-map), characters (`char-captain-vael`), quests (`quest-ember-pact` primary unlock at stage 1 + spoiler reveal at stage 3), icon-sets (`iconset-abilities`). The cross-reference graph also carries non-catalog concept nodes (resonance-cascade, classified-testimony, magical-use-prohibition).

## Acceptance profile
Tiers used: **L0** (data — brief/lore-body/graph/unlock-rules/spoiler-rules/audio/a11y/loc/assets), **L1** (human selection — illustration gallery), **L3** (runtime-deferred — `VSCodexUnlockTest`). No L2 static checks or L4 visual gates. Config-complete means: brief ≥300 and lore body ≥400 chars, the cross-reference knowledge graph validates (7 nodes / 11 edges, all reachable from `codex-sundering[0]`, 2 terminal concept nodes), unlock/spoiler/audio fields populate, an illustration is selected, and ≥3 UE codex assets are packaged — unlock timing and no-spoiler-leak deferred to PIE.

## Status & notes
11 steps. Notable for using the `graph` archetype (step 3) as a **knowledge graph** — semantic "references"/"mentioned-in" edges over a root entry, not a narrative flowchart. The `schema`-archetype Lore Body (step 2) carries the longest prose floor (≥400). Spoiler-gating is the distinctive mechanism: classified content is redacted at render time, never removed from the DataTable row (canon game-lore-canon). Obeys post-Sundering setting canon (unreliable-narrator framing, magic is dangerous/costly) and art-icon-a11y. Bridge-driven runtime verification is deferred to `VSCodexUnlockTest`.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
