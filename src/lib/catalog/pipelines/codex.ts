import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Codex pipeline (catalogId: 'codex').
 *
 * Represents an in-game encyclopedia entry unlocked by player progression.
 * Each entry enriches the post-Sundering lore, surfacing history, factions,
 * zones, and characters through earned discovery rather than front-loaded
 * exposition. Entries are spoiler-gated: a codex entry may only reveal
 * information consistent with unlocks already reached by the player
 * (canon game-lore-canon).
 *
 * Target entity: "The Sundering" (codex-sundering) — the foundational lore
 * entry describing the catastrophic magical event that shattered the old world
 * and gave rise to the post-Sundering setting. It cross-references the Ashen
 * Order faction, the Ashen Forest zone, and Captain Vael — all entities the
 * player encounters through normal early-game progression.
 *
 * Wiring: UARPGCodexComponent on the PlayerController (or a UARPGWorldStateComponent
 * save) holds the set of unlocked codex entry ids. Entries are read from
 * DT_Codex; an entry becomes visible once the corresponding unlock tag is granted.
 * The codex UI reads `State.Codex.Unlocked.<EntryId>` gameplay tags to filter
 * which entries are displayed. Spoiler fields are stripped server-side for entries
 * whose spoiler tag has not yet been granted.
 *
 * Top-level cross-catalog links:
 *   factions::faction-ashen-order    — faction cross-referenced by the lore body
 *   zone-map::zone-z-ashen           — zone cross-referenced (Ashen Forest, id z-ashen, seeded via seed-zone-map)
 *   characters::char-captain-vael    — character cross-referenced as a post-Sundering survivor
 *   icon-sets::iconset-abilities     — shared icon presentation library
 */
registerCatalogPipeline({
  catalogId: 'codex',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the founding lore entry of the codex — the account of the magical ` +
            `catastrophe that unmade the old world and left the post-Sundering era in its wake. ` +
            `It is not a chronicle written by a neutral scholar; it is a contested record assembled ` +
            `from fragmented Order dispatches, survivor testimonies, and half-burned census rolls ` +
            `salvaged from the Ashen Forest outpost archives. No two survivors agree on the exact ` +
            `sequence, and that unreliability is intentional: the Sundering is still politically ` +
            `charged — the Ashen Order holds that unregulated practitioners caused it; independent ` +
            `mages dispute this. ` +
            `In gameplay terms the entry is the player's first codex unlock, granted after completing ` +
            `the Ashen Forest zone's introductory quest sequence. It cross-references three ` +
            `entities the player has already met by that point: the Ashen Order faction, the Ashen ` +
            `Forest zone, and Captain Vael — the most visible Ashen Order officer the player ` +
            `encounters. Tone: weathered, terse archival prose — a soldier's record of a disaster, ` +
            `not a bard's recounting of a legend. No magic is described as wondrous; every cost ` +
            `is tallied.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Lore Body ─────────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Lore Body',
      view: { kind: 'prose', field: 'loreBody', emptyText: 'No lore body yet' },
      produce: () => ({
        data: {
          loreBody:
            `THE SUNDERING — CONSOLIDATED ACCOUNT (Ashen Order Archivist's Draft, Year 0 Post-Sundering)\n\n` +
            `What the survivors call the Sundering lasted less than a night. What it left behind has ` +
            `not finished burning.\n\n` +
            `The event's proximate cause remains contested. The Order's formal position: a conclave of ` +
            `unregistered practitioners attempted a continent-scale binding — an act of hubris the ` +
            `Order had warned against for three decades. The binding unravelled catastrophically, ` +
            `releasing a resonance cascade that collapsed the leyline lattice supporting organised ` +
            `magical infrastructure across the known world. Within six hours, every permanent ward, ` +
            `summoned construct, and enchantment-sustained structure within approximately four hundred ` +
            `leagues failed simultaneously. The Ashen Forest is the most visible scar: where the ` +
            `resonance pulse was densest, the canopy ignited and the soil crystallised into the ` +
            `grey-black slag now characteristic of the zone.\n\n` +
            `Independent accounts dispute the Order's framing. Several testimonies collected by ` +
            `Order field agent Vael (then a junior lieutenant, now Captain) describe the resonance ` +
            `cascade originating from an Order facility, not an unregistered site. Those testimonies ` +
            `were classified. Vael has not spoken publicly on their content.\n\n` +
            `The cost in the first year: approximately sixty percent of the pre-Sundering population ` +
            `of the affected region. Not from the cascade itself — most died in the two seasons that ` +
            `followed, when crops failed and trade collapsed. The Order's current mission — patrol, ` +
            `salvage, and enforcement of the new magical-use prohibitions — is the direct institutional ` +
            `response. Whether that response is penance or consolidation of power depends on who you ask.\n\n` +
            `Cross-references: Ashen Order (faction — primary institutional respondent); ` +
            `Ashen Forest (zone — the visible ground-zero scar); Captain Vael (character — ` +
            `field agent during the event, now zone commander).`,
          loreBodyNote:
            'Prose is written in-world as an archivist draft — unreliable-narrator framing is ' +
            'intentional (contested cause, classified testimony). Faithful to post-Sundering setting ' +
            '(canon game-setting: post-Sundering dark fantasy, militant factions, magic is dangerous ' +
            'and costly). Vael is named as a participant — consistent with his established character ' +
            '(dialog-trees: weathered, precise, suspicious). No magic presented as wondrous.',
        },
      }),
      accept: minLength('loreBody', 'Lore body ≥ 400 characters', 400),
    },

    // ── 3. Cross-References ───────────────────────────────────────────────────
    // KEY STEP — archetype: 'graph', view: graph, accept: graphValid
    // The cross-reference graph models the semantic relationships between this
    // codex entry and the other catalog entities it references. This is NOT a
    // narrative flowchart — it is a knowledge graph: the Sundering entry is the
    // root node; edges represent "references" and "mentioned-in" relationships;
    // terminal nodes are entities whose own codex entries (or catalog rows) are
    // the leaves of this particular reference cluster. graphValid enforces:
    //   - no dangling edges
    //   - all nodes reachable from the root (codex-sundering)
    //   - ≥1 terminal node
    {
      archetype: 'graph',
      label: 'Cross-References',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({
        data: {
          graph: {
            nodes: [
              // ── Root: this codex entry ────────────────────────────────────
              {
                id: 'codex-sundering',
                label: 'The Sundering [root — this entry]',
              },
              // ── Faction ───────────────────────────────────────────────────
              {
                id: 'faction-ashen-order',
                label: 'The Ashen Order — primary institutional respondent; holds disputed account of cause',
              },
              // ── Zone ──────────────────────────────────────────────────────
              {
                id: 'zone-z-ashen',
                label: 'Ashen Forest — ground-zero scar zone; resonance pulse epicentre',
              },
              // ── Character ─────────────────────────────────────────────────
              {
                id: 'char-captain-vael',
                label: 'Captain Vael — field agent during the Sundering; classified testimony holder',
              },
              // ── Derived concept nodes (non-catalog, intra-entry links) ────
              {
                id: 'concept-resonance-cascade',
                label: 'Resonance Cascade — proximate mechanism; collapsed leyline lattice',
              },
              {
                id: 'concept-classified-testimony',
                label: 'Classified Testimony — Vael field reports; disputed by Order\'s official account',
                // Terminal: further references lead outside this entry's scope — no outgoing edges
                terminal: true,
              },
              {
                id: 'concept-magical-use-prohibition',
                label: 'Magical-Use Prohibition — Order enforcement mandate post-Sundering',
                terminal: true,
              },
            ],
            edges: [
              // Root references main catalog entities
              { from: 'codex-sundering', to: 'faction-ashen-order',         label: 'references — primary respondent faction' },
              { from: 'codex-sundering', to: 'zone-z-ashen',                label: 'references — ground-zero zone' },
              { from: 'codex-sundering', to: 'char-captain-vael',           label: 'references — participant / classified testimony holder' },
              { from: 'codex-sundering', to: 'concept-resonance-cascade',   label: 'explains — the physical mechanism' },

              // Cascade connects to zone and faction (cascade caused the zone scar; faction responded)
              { from: 'concept-resonance-cascade', to: 'zone-z-ashen',      label: 'caused — resonance epicentre' },
              { from: 'concept-resonance-cascade', to: 'faction-ashen-order', label: 'triggered — Order emergency mandate' },

              // Vael connects to classified testimony and to the Ashen Order (he is an Order officer)
              { from: 'char-captain-vael',     to: 'concept-classified-testimony', label: 'holds — disputed field reports' },
              { from: 'char-captain-vael',     to: 'faction-ashen-order',          label: 'member-of — junior lieutenant at time of Sundering' },

              // Faction connects to prohibition (it enforces it) and to classified testimony (it classified the reports)
              { from: 'faction-ashen-order',   to: 'concept-magical-use-prohibition', label: 'enforces — post-Sundering mandate' },
              { from: 'faction-ashen-order',   to: 'concept-classified-testimony',    label: 'classified — Vael field reports' },

              // Zone connects to classified testimony (the Ashen Forest outpost held the archived records)
              { from: 'zone-z-ashen',          to: 'concept-classified-testimony',    label: 'archives-at — outpost salvage records' },
            ],
            note:
              'Cross-reference knowledge graph: 7 nodes, 11 edges, all reachable from codex-sundering[0]. ' +
              '2 terminal nodes: concept-classified-testimony + concept-magical-use-prohibition (leaf concepts). ' +
              'Catalog entity nodes (faction-ashen-order, zone-z-ashen, char-captain-vael) are not terminal — ' +
              'they carry outgoing edges to derived concepts. ' +
              'graphValid: reachable + has terminals. ' +
              'Wiring: cross-catalog links on this step declare the three resolvable catalog entity ids; ' +
              'concept nodes are intra-entry semantic nodes, not catalog rows.',
          },
          wiringContract: {
            grantedBy:
              'UARPGCodexComponent on the PlayerController maintains a TSet<FName> of unlocked entry ids. ' +
              'The cross-reference graph is read by the in-game Codex UI to render a "Related Entries" ' +
              'panel linking the player to adjacent codex entries and world entities.',
            activatedBy:
              'Player unlocks codex-sundering (State.Codex.Unlocked.codex-sundering tag granted) → ' +
              'UARPGCodexComponent exposes the cross-reference links in the Codex UI. ' +
              'Catalog-entity links (faction/zone/character) resolve to their respective catalog UI panels.',
            dependencies: [
              'factions (faction-ashen-order — cross-referenced faction entity)',
              'zone-map (zone-z-ashen — cross-referenced zone entity, seeded via seed-zone-map)',
              'characters (char-captain-vael — cross-referenced character entity)',
            ],
            verification:
              'L0: graphValid — all 7 nodes reachable from root, 2 terminal nodes present, no dangling edges; ' +
              'L3: VSCodexUnlockTest — codex-sundering entry unlocks at its trigger + cross-ref links resolve in PIE (deferred)',
          },
        },
        links: [
          { catalogId: 'factions',    entityId: 'faction-ashen-order', role: 'cross-reference' },
          { catalogId: 'zone-map',    entityId: 'zone-z-ashen',        role: 'cross-reference' },
          { catalogId: 'characters',  entityId: 'char-captain-vael',   role: 'cross-reference' },
        ],
      }),
      accept: graphValid('graph', 'Cross-refs reachable + terminal'),
    },

    // ── 4. Unlock Rules ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Unlock Rules',
      view: {
        kind: 'table',
        field: 'unlockRules',
        columns: [{ key: 'trigger' }, { key: 'tagGranted' }, { key: 'condition' }],
      },
      produce: () => ({
        data: {
          unlockRules: {
            primary: {
              trigger:
                'Player completes the first quest in the Ashen Forest zone that requires speaking ' +
                'to Captain Vael (quest-ember-pact stage 1 accepted OR any Ashen Forest zone ' +
                'completion tag set — whichever fires first in the critical path).',
              tagGranted: 'State.Codex.Unlocked.codex-sundering',
              condition:
                'NOT State.Codex.Unlocked.codex-sundering (idempotent guard — re-entry does not re-trigger). ' +
                'Tag is applied via GE_Codex_Unlock_Sundering (SetByCaller 1.0 on a binary attribute) + ' +
                'the UARPGCodexComponent saves the entry id to the persistent TSet on the save-game object.',
              ueWiring:
                'GE_Codex_Unlock_Sundering is a GameplayEffect with tag container grant: ' +
                'State.Codex.Unlocked.codex-sundering. Applied by AARPGQuestComponent on ' +
                'quest-ember-pact stage 1 complete OR by zone-trigger volume in the Ashen Forest ' +
                'on first full entry (player body enters the streaming cell).',
            },
            fallback: {
              trigger:
                'Player enters the Ashen Forest zone streaming cell for the first time ' +
                '(zone transition trigger volume).',
              tagGranted: 'State.Codex.Unlocked.codex-sundering',
              condition:
                'NOT State.Codex.Unlocked.codex-sundering. Fallback ensures the entry unlocks ' +
                'even if quest-ember-pact is bypassed (e.g. player explores freely).',
              ueWiring:
                'ATriggerVolume in the Ashen Forest level applies GE_Codex_Unlock_Sundering on Overlap ' +
                'with the player character\'s capsule component.',
            },
            wiringContract: {
              grantedBy:
                'GE_Codex_Unlock_Sundering (GameplayEffect) — applied on quest-ember-pact stage 1 ' +
                'completion (primary) OR on Ashen Forest zone entry trigger (fallback). ' +
                'Both paths are idempotent (NOT-already-unlocked guard).',
              activatedBy:
                'AARPGQuestComponent.OnStageComplete(quest-ember-pact, stage 1) → ' +
                'ApplyGameplayEffectToSelf(GE_Codex_Unlock_Sundering); ' +
                'OR ATriggerVolume.OnActorBeginOverlap(PlayerCharacter) → ' +
                'ApplyGameplayEffectToTarget(GE_Codex_Unlock_Sundering).',
              dependencies: [
                'quests (quest-ember-pact — primary unlock trigger on stage 1)',
                'zone-map (zone-z-ashen — fallback trigger volume placement)',
              ],
              verification:
                'L2: GE_Codex_Unlock_Sundering compiled + tag registered in GameplayTagsList.ini; ' +
                'seed_codex.py seeds DT_Codex row "codex-sundering"; ' +
                'L3: VSCodexUnlockTest — entry unlocks via quest path AND via zone entry; ' +
                're-entry does not duplicate (deferred)',
            },
          },
        },
      }),
      accept: fieldsPopulated('unlockRules', 'primary + fallback unlock rules defined', [
        'primary',
        'fallback',
      ]),
    },

    // ── 5. Spoiler Tagging ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Spoiler Tagging',
      view: {
        kind: 'table',
        field: 'spoilerRules',
        columns: [{ key: 'field' }, { key: 'spoilerTag' }, { key: 'gateCondition' }],
      },
      produce: () => ({
        data: {
          spoilerRules: {
            classifiedTestimonyField: {
              field: 'loreBody — paragraph referencing classified Vael testimony + Order facility origin dispute',
              spoilerTag: 'State.Codex.Spoiler.codex-sundering.ClassifiedTestimony',
              gateCondition:
                'Revealed only after quest-ember-pact reaches stage 3 OR player obtains the ' +
                '"Vael Field Report" key item — whichever fires first. Prior to that unlock, ' +
                'the classified testimony paragraph is replaced with a redaction notice: ' +
                '"[CLASSIFIED — Ashen Order FIELD DISPATCH — Access Restricted]".',
              ueWiring:
                'The Codex UI reads State.Codex.Spoiler.codex-sundering.ClassifiedTestimony from ' +
                'UARPGCodexComponent; if absent, the classified paragraph is replaced with the ' +
                'redaction string at render time — never stripped from the DT_Codex row itself. ' +
                'GE_Codex_Spoiler_Sundering_ClassifiedTestimony applies the tag on quest-ember-pact ' +
                'stage 3 completion (or key-item grant event).',
            },
            orderFacilityOriginField: {
              field: 'loreBody — implication that the cascade originated at an Order facility',
              spoilerTag: 'State.Codex.Spoiler.codex-sundering.ClassifiedTestimony',
              gateCondition:
                'Same gate as classifiedTestimonyField — both reveals are tied to the same unlock ' +
                'because they are politically linked: revealing the facility origin without the ' +
                'testimony context would be misleading. Both are gated together under the single ' +
                'State.Codex.Spoiler.codex-sundering.ClassifiedTestimony tag.',
              ueWiring: 'Same GE as classifiedTestimonyField — single tag gates both paragraphs.',
            },
            loreBodyBaseNote:
              'The base lore body (cause contested but Order framing presented, no explicit facility ' +
              'accusation) is safe to show from the moment the entry is unlocked — it matches what ' +
              'the player can infer from Vael\'s guarded demeanour in dialog-trees. ' +
              'Only the classified testimony and the explicit facility-origin implication are spoiler-gated.',
            wiringContract: {
              grantedBy:
                'GE_Codex_Spoiler_Sundering_ClassifiedTestimony — applied on quest-ember-pact stage 3 ' +
                'OR "Vael Field Report" key-item grant event.',
              activatedBy:
                'AARPGQuestComponent.OnStageComplete(quest-ember-pact, stage 3) → ' +
                'ApplyGameplayEffectToSelf(GE_Codex_Spoiler_Sundering_ClassifiedTestimony); ' +
                'OR AARPGItemComponent.OnKeyItemGranted("item-vael-field-report") → same GE.',
              dependencies: [
                'quests (quest-ember-pact — stage 3 progression)',
              ],
              verification:
                'L2: GE_Codex_Spoiler_Sundering_ClassifiedTestimony compiled; tag registered; ' +
                'L3: VSCodexUnlockTest — spoiler paragraph absent before stage 3, present after (deferred)',
            },
          },
        },
      }),
      accept: fieldsPopulated('spoilerRules', 'spoiler fields + gate conditions defined', [
        'classifiedTestimonyField',
        'orderFacilityOriginField',
      ]),
    },

    // ── 6. Illustration ───────────────────────────────────────────────────────
    // Universal Icon step — gallery L1, linked to icon-sets::iconset-abilities.
    {
      archetype: 'gallery',
      label: 'Illustration',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-source' },
        ],
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_CodexIllustration`,
          `/Game/UI/Icons/T_${slug(e.name)}_CodexIcon`,
        ],
      }),
      accept: selected('selected', 'A codex illustration is selected'),
    },

    // ── 7. Audio Sting ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Audio Sting',
      view: {
        kind: 'table',
        field: 'audioSting',
        columns: [{ key: 'event' }, { key: 'asset' }, { key: 'description' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          audioSting: {
            unlockSting: {
              event: 'Codex entry unlocked (State.Codex.Unlocked.codex-sundering tag granted)',
              asset: `SC_Codex_Unlock_${slug(e.name)}`,
              description:
                'A brief (1.5–2.5 s) tonal sting: single struck low brass chord with a slow ' +
                'decay, underneath a short crackling texture (ash settling, not fire — the ' +
                'Sundering is over; what remains is the scar). No triumph; no dread; just weight. ' +
                'Level: −12 dBFS peak, −18 dBFS average. SFX category (not music — not looped). ' +
                'Played once on unlock; not on subsequent codex-open actions.',
              ueWiring:
                'UARPGCodexComponent calls UAudioComponent::PlaySoundAtLocation with ' +
                `SC_Codex_Unlock_${slug(e.name)} at player location when ` +
                'State.Codex.Unlocked.codex-sundering is first applied. ' +
                'Sound asset class: SC_ (SoundCue per proj-naming); ' +
                'SFX mix bus; no spatial attenuation (UI-layer, 2D).',
            },
            spoilerRevealSting: {
              event: 'Spoiler paragraph revealed (State.Codex.Spoiler.codex-sundering.ClassifiedTestimony granted)',
              asset: `SC_Codex_SpoilerReveal_${slug(e.name)}`,
              description:
                'A very short (0.6–1.0 s) high-tension chord stab: muted string tremolo, single ' +
                'hit, then silence. Signals that a previously redacted section has become readable. ' +
                'Level: −14 dBFS peak. SFX category, 2D, plays once.',
              ueWiring:
                'Same trigger pattern as unlockSting but on GE_Codex_Spoiler_Sundering_ClassifiedTestimony grant.',
            },
            wiringContract: {
              grantedBy: `SC_Codex_Unlock_${slug(e.name)} + SC_Codex_SpoilerReveal_${slug(e.name)} — SoundCue assets in /Game/Audio/Codex/`,
              activatedBy: 'UARPGCodexComponent fires PlaySoundAtLocation on the respective tag-grant events.',
              dependencies: [],
              verification:
                `L2: SC_Codex_Unlock_${slug(e.name)} + SC_Codex_SpoilerReveal_${slug(e.name)} assets present; ` +
                'L3: VSCodexUnlockTest — sting plays on unlock, spoiler sting plays on spoiler reveal (deferred)',
            },
          },
        },
        ueAssets: [
          `/Game/Audio/Codex/SC_Codex_Unlock_${slug(e.name)}`,
          `/Game/Audio/Codex/SC_Codex_SpoilerReveal_${slug(e.name)}`,
        ],
      }),
      accept: fieldsPopulated('audioSting', 'unlock sting + spoiler sting defined', [
        'unlockSting',
        'spoilerRevealSting',
      ]),
    },

    // ── 8. Accessibility ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'a11yChecks' },
      produce: () => ({
        data: {
          a11yChecks: [
            'Codex entry text is rendered in a scalable font (UI font-size setting, 14–24 pt range)',
            'Redaction notice is visually distinct (colour + icon, not color alone) for colorblind-safe diff',
            'Spoiler-gated paragraphs replaced with a legible text notice — not invisible/blank',
            'Illustration alt-text ("T_TheSundering_CodexIllustration: Ashen Forest scar vista, post-Sundering") present for screen readers',
            'Audio sting has a user-facing on/off toggle in the UI SFX settings (separate from gameplay SFX)',
            'Cross-reference links in the Related Entries panel are keyboard and controller navigable',
            'No timed UI elements — the codex can be read at any pace',
            'AA contrast minimum on entry text and header against the dark codex panel background (canon art-icon-a11y)',
          ],
        },
      }),
      accept: minCount('a11yChecks', '≥1 accessibility check listed', 1),
    },

    // ── 9. Localization ───────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'locKeys' },
      produce: (e: LabEntity) => ({
        data: {
          locKeys: [
            `CODEX_${slug(e.name).toUpperCase()}_TITLE`,
            `CODEX_${slug(e.name).toUpperCase()}_BRIEF`,
            `CODEX_${slug(e.name).toUpperCase()}_LOREBODY`,
            `CODEX_${slug(e.name).toUpperCase()}_LOREBODY_CLASSIFIED_REDACTION`,
            `CODEX_${slug(e.name).toUpperCase()}_LOREBODY_CLASSIFIED_FULL`,
            `CODEX_${slug(e.name).toUpperCase()}_CROSSREF_LABEL_FACTION`,
            `CODEX_${slug(e.name).toUpperCase()}_CROSSREF_LABEL_ZONE`,
            `CODEX_${slug(e.name).toUpperCase()}_CROSSREF_LABEL_CHARACTER`,
            `CODEX_${slug(e.name).toUpperCase()}_UNLOCK_NOTIFICATION`,
          ],
          locNotes:
            'All keys follow CODEX_<ENTRY>_<FIELD> convention. Authored in ' +
            `Content/Localization/Codex/${slug(e.name)}.csv. ` +
            'LOREBODY_CLASSIFIED_REDACTION is the redaction notice shown before spoiler unlock; ' +
            'LOREBODY_CLASSIFIED_FULL is the revealed text after unlock. ' +
            'Non-English translations must preserve the in-world unreliable-narrator voice ' +
            '(archival register, terse). CROSSREF labels are short (≤30 chars) for panel display.',
        },
      }),
      accept: minCount('locKeys', '≥1 localization key defined', 1),
    },

    // ── 10. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'codex-sundering entry NOT visible before quest-ember-pact stage 1 or Ashen Forest zone entry',
            'codex-sundering entry visible after quest-ember-pact stage 1 accepted (primary unlock path)',
            'codex-sundering entry visible after Ashen Forest zone entry trigger (fallback unlock path)',
            'State.Codex.Unlocked.codex-sundering tag applied exactly once (idempotent — re-trigger does not duplicate)',
            'classified testimony paragraph ABSENT (shows redaction notice) before quest-ember-pact stage 3',
            'classified testimony paragraph PRESENT after quest-ember-pact stage 3',
            'cross-reference links (faction / zone / character) navigate to their respective catalog panels in PIE',
            'audio sting plays on first unlock; does not replay on subsequent codex opens',
            'spoiler sting plays on classified testimony reveal',
            'no spoiler leak — codex entry content in DT_Codex does not expose classified fields without tag',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSCodexUnlockTest',
        'Entry unlocks at its trigger + no spoiler leak in PIE',
      ),
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    // Wiring contract per arpg-wiring-contract canon.
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_Codex :: ${s}`,
          `GE_Codex_Unlock_${s}`,
          `GE_Codex_Spoiler_${s}_ClassifiedTestimony`,
          `T_${s}_CodexIllustration`,
          `T_${s}_CodexIcon`,
          `SC_Codex_Unlock_${s}`,
          `SC_Codex_SpoilerReveal_${s}`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `UARPGCodexComponent on the PlayerController reads FARPGCodexRow from DT_Codex ` +
                `keyed by entity id ("${e.id}"). GE_Codex_Unlock_${s} grants ` +
                `State.Codex.Unlocked.${e.id} on application. ` +
                `GE_Codex_Spoiler_${s}_ClassifiedTestimony grants the classified-testimony spoiler tag. ` +
                `Both GEs are authored in /Game/GAS/Codex/ and referenced by the quest + zone trigger systems.`,
              activatedBy:
                `(Primary) AARPGQuestComponent.OnStageComplete(quest-ember-pact, stage 1) → ` +
                `ApplyGameplayEffectToSelf(GE_Codex_Unlock_${s}); ` +
                `(Fallback) ATriggerVolume in z-ashen level.OnActorBeginOverlap(Player) → same GE. ` +
                `(Spoiler) AARPGQuestComponent.OnStageComplete(quest-ember-pact, stage 3) → ` +
                `ApplyGameplayEffectToSelf(GE_Codex_Spoiler_${s}_ClassifiedTestimony). ` +
                `UARPGCodexComponent persists both unlocked entry ids and spoiler tag set to save-game on grant.`,
              dependencies: [
                'factions (faction-ashen-order — cross-referenced in codex entry + Related Entries panel)',
                'zone-map (zone-z-ashen — cross-referenced zone; fallback trigger volume in this level)',
                'characters (char-captain-vael — cross-referenced character)',
                'quests (quest-ember-pact — primary unlock trigger + spoiler reveal trigger)',
                'icon-sets (iconset-abilities — source icon family for illustration)',
              ],
              verification:
                `L2: FARPGCodexRow in Source/PoF/ + DT_Codex seeded via seed_codex.py + ` +
                `GE_Codex_Unlock_${s} + GE_Codex_Spoiler_${s}_ClassifiedTestimony compiled; ` +
                `T_${s}_CodexIllustration + T_${s}_CodexIcon in /Game/UI/Icons/; ` +
                `SC_Codex_Unlock_${s} + SC_Codex_SpoilerReveal_${s} in /Game/Audio/Codex/; ` +
                `L3: VSCodexUnlockTest — unlock paths confirmed, spoiler gate respected, ' +
                'cross-refs navigable in PIE (deferred)`,
            },
          },
          ueAssets: [
            `/Game/Codex/DT_Codex`,
            `/Game/GAS/Codex/GE_Codex_Unlock_${s}`,
            `/Game/GAS/Codex/GE_Codex_Spoiler_${s}_ClassifiedTestimony`,
            `/Game/UI/Icons/T_${s}_CodexIllustration`,
            `/Game/UI/Icons/T_${s}_CodexIcon`,
            `/Game/Audio/Codex/SC_Codex_Unlock_${s}`,
            `/Game/Audio/Codex/SC_Codex_SpoilerReveal_${s}`,
          ],
        };
      },
      accept: minCount('assets', '≥3 UE codex assets packaged', 3),
    },
  ],
});
