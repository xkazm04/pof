import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Factions / Reputation pipeline (catalogId: 'factions').
 *
 * Models group affiliations with a 6-tier standing ladder (Hated → Exalted),
 * concrete rep thresholds and decay, action→rep deltas, and a linear discount
 * reward curve (0 → 20%) that satisfies canon `vendor-laws`.
 *
 * The seeded starter entity is faction-ashen-order "The Ashen Order" — a
 * militant order in the post-Sundering dark-fantasy setting (canon game-setting).
 *
 * Wiring: UARPGFactionSubsystem holds per-player repPoints per factionId,
 * evaluates thresholds on change, and broadcasts a RepTierChanged delegate.
 * Vendors query GetRepTier(factionId, playerId) to apply the linear discount;
 * quests grant rep via GE_QuestRep_<factionId> (SetByCaller magnitude).
 * The subsystem reads FARPGFactionRow from DT_Factions (seeded via
 * seed_factions.py) and per-player rep from DT_FactionReputation.
 */
registerCatalogPipeline({
  catalogId: 'factions',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a militant order operating in the post-Sundering dark-fantasy world — ` +
            `a disciplined brotherhood of ash-marked soldiers who hold the Ember Frontier against ` +
            `the encroaching corruption. They are neither saviors nor tyrants: their hierarchy is ` +
            `meritocratic, their discipline is ruthless, and their favors are earned through deeds ` +
            `rather than gold. In PoF's faction system the player begins Neutral with ${e.name} and ` +
            `progresses (or regresses) across six standing tiers — Hated, Unfriendly, Neutral, ` +
            `Friendly, Honored, Revered, Exalted — by completing quests, defeating designated ` +
            `enemies, trading, or committing hostile acts against Order members. Standing gates ` +
            `access to exclusive vendor stock and determines the discount tier applied by Wandering ` +
            `Merchant (vendor-wandering-merchant) per canon vendor-laws. Captain Vael ` +
            `(char-captain-vael) serves as the faction's primary quest-giver and rank arbiter; ` +
            `his dialogue shifts with the player's standing tier. The faction's heraldry — a ` +
            `stylized ash-ring sigil — appears on armor rewards, faction-gated doors, and the HUD ` +
            `reputation tracker. Reputation decays passively at 10 points/day below Honored to ` +
            `prevent indefinite coasting on old deeds without active engagement.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Standing & Rep Tiers ───────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Standing & Rep Tiers',
      view: {
        kind: 'table',
        field: 'tiers',
        columns: [{ key: 'tier' }, { key: 'minPoints' }, { key: 'maxPoints' }, { key: 'decayPerDay' }],
      },
      produce: () => ({
        data: {
          tiers: [
            // Six tiers: negative (hostile) through positive (exalted).
            // Points range: −10000 (floor, deep Hated) to +10000 (Exalted cap).
            // Tier boundaries chosen so each positive tier is a genuine effort gate
            // at ~60–80 average quests (balanced vs. canon proj-balance tier ≈100 target).
            {
              tier: 'Hated',
              minPoints: -10000,
              maxPoints: -3001,
              label: 'The Order attacks on sight. All services and gates closed.',
              decayPerDay: 0,
            },
            {
              tier: 'Unfriendly',
              minPoints: -3000,
              maxPoints: -1,
              label: 'Hostile dialogue; no rewards; vendor discount −5% (surcharge).',
              decayPerDay: 0,
            },
            {
              tier: 'Neutral',
              minPoints: 0,
              maxPoints: 2999,
              label: 'Default start. Basic services available at 0% discount.',
              decayPerDay: 0,
            },
            {
              tier: 'Friendly',
              minPoints: 3000,
              maxPoints: 5999,
              label: 'Warm greeting; 5% vendor discount; minor consumable reward package.',
              decayPerDay: 0,
            },
            {
              tier: 'Honored',
              minPoints: 6000,
              maxPoints: 8999,
              label: '10% discount; access to Honored-tier gear stock (item-6 Sunfire Amulet pool).',
              decayPerDay: 0,
            },
            {
              tier: 'Revered',
              minPoints: 9000,
              maxPoints: 11999,
              label: '15% discount; unique faction armor cosmetic unlocked; decay begins below Honored.',
              decayPerDay: 10,
            },
            {
              tier: 'Exalted',
              minPoints: 12000,
              maxPoints: 15000,
              label: 'Max tier. 20% discount; Ashen Order title; faction-gated endgame area access.',
              decayPerDay: 10,
            },
          ],
          decayRules: {
            decayThresholdTier: 'Honored',
            decayNote:
              'Passive decay of 10 rep points/day applies when the player is at or above Revered. ' +
              'Decay halts when active play occurs (any rep-granting action resets the daily decay timer). ' +
              'Decay cannot drop the player below Honored (9000 points) — the floor is the threshold boundary. ' +
              'Below Honored there is no passive decay; gains/losses are purely action-driven.',
            thresholdNote:
              'Thresholds are inclusive: a player at exactly 3000 points is Friendly. ' +
              'Tier transitions broadcast a RepTierChanged delegate (UARPGFactionSubsystem) ' +
              'so NPCs, vendors, and UI react immediately on the same frame.',
          },
          wiringContract: {
            grantedBy:
              'UARPGFactionSubsystem::EvaluateTier(factionId, repPoints) computes the tier ' +
              'by scanning FARPGFactionRow.tierThresholds from DT_Factions keyed by entity slug',
            activatedBy:
              'Called automatically on every rep-points change via OnRepPointsChanged delegate; ' +
              'also called at session start to restore saved standing from DT_FactionReputation',
            dependencies: ['currencies (currency-gold — Friendly-tier reward package)'],
            verification:
              'L2: FARPGFactionRow declared in Source/PoF/ + DT_Factions seeded via seed_factions.py; ' +
              'UARPGFactionSubsystem::EvaluateTier compiled; ' +
              'L3: VSFactionRepTest — rep at 3000 returns Friendly, at 12000 returns Exalted in PIE',
          },
        },
      }),
      accept: minCount('tiers', '≥6 standing tiers declared', 6),
      staticChecks: () => [
        cppSymbolExists('UARPGFactionSubsystem', 'Faction subsystem present in UE Source'),
        cppSymbolExists('FARPGFactionRow', 'Faction row struct present in UE Source'),
      ],
    },

    // ── 3. Action → Reputation ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Action → Reputation',
      view: {
        kind: 'table',
        field: 'actionDeltas',
        columns: [{ key: 'action' }, { key: 'delta' }, { key: 'cooldown' }],
      },
      produce: () => ({
        data: {
          actionDeltas: [
            // Positive sources — quest completions are the primary faucet.
            // Completing a faction quest grants 250–500 rep (main quests grant more).
            // Kill-based rep is the secondary faucet (10–50 per kill), intentionally
            // slower than quests so standing cannot be gamed by grinding trash.
            { action: 'Complete main faction quest', delta: +500, cooldown: 'once per quest', category: 'gain' },
            { action: 'Complete side/patrol quest', delta: +250, cooldown: 'once per quest', category: 'gain' },
            { action: 'Kill Corruption-aligned enemy (tagged)', delta: +25, cooldown: 'none (per kill)', category: 'gain' },
            { action: 'Kill rare/elite Corruption enemy', delta: +50, cooldown: 'none (per kill)', category: 'gain' },
            { action: 'Deliver supply cache to Order outpost', delta: +150, cooldown: '8-hour reset per cache', category: 'gain' },
            { action: 'Win arena sparring match (NPC opponent)', delta: +75, cooldown: '24-hour daily cap', category: 'gain' },
            { action: 'Purchase item from Wandering Merchant', delta: +10, cooldown: 'per transaction', category: 'gain' },
            // Negative sources — punishments must be steep enough to matter.
            { action: 'Attack or kill an Order NPC member', delta: -1000, cooldown: 'per incident', category: 'loss' },
            { action: 'Betray an Order quest (fail by choice)', delta: -500, cooldown: 'once per quest', category: 'loss' },
            { action: 'Steal from an Order cache or chest', delta: -200, cooldown: 'per incident', category: 'loss' },
            { action: 'Assist a Corruption-aligned faction (hostile act)', delta: -300, cooldown: 'per act', category: 'loss' },
          ],
          repNote:
            'Quests are the primary faucet: a single main quest (+500) represents ~2% progress ' +
            'toward Friendly from Neutral (3000 pts required). Full Exalted requires ' +
            'approximately 24 main quests or ~48 side quests from Neutral — a mid-to-late-game ' +
            'investment, never automatic. Kill-based rep provides a trickle (+25 per tagged kill) ' +
            'supplementing quest play; cannot solo-grind to Exalted (would take ~480 kills). ' +
            'Hostile acts are punishing: killing one NPC member (−1000) erases ~4 side quests ' +
            'of effort, creating genuine tension around the Ashen Order questline betrayal choice. ' +
            'Per canon game-pillars: power is earned, not gifted.',
          wiringContract: {
            grantedBy:
              'UARPGFactionSubsystem::AddRepPoints(factionId, delta, playerId) — called by ' +
              'quest reward GEs (GE_QuestRep_Factions with SetByCaller magnitude), ' +
              'kill credit callbacks (bound to OnEnemyKilled delegate), and trade transaction callbacks',
            activatedBy:
              'Quest completion → UARPGQuestSubsystem broadcasts QuestCompleted → ' +
              'AddRepPoints(faction-ashen-order, delta); ' +
              'OnEnemyKilled(enemyActor) → tag check → AddRepPoints if Corruption-tagged',
            dependencies: [],
            verification:
              'L2: UARPGFactionSubsystem::AddRepPoints compiled + EvaluateTier called post-add; ' +
              'L3: VSFactionRepTest — completing a mock quest event awards expected delta in PIE',
          },
        },
      }),
      accept: minCount('actionDeltas', '≥8 action→rep deltas declared', 8),
    },

    // ── 4. Tier Rewards ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Tier Rewards',
      view: {
        kind: 'table',
        field: 'tierRewards',
        columns: [{ key: 'tier' }, { key: 'reward' }, { key: 'discount' }],
      },
      produce: () => ({
        data: {
          tierRewards: [
            {
              tier: 'Neutral',
              discount: 0,
              reward: 'Basic services; no bonus rewards.',
              unlocks: [],
            },
            {
              tier: 'Friendly',
              discount: 5,
              reward: '5% vendor discount; Friendly-tier consumable package (3× Minor Healing Potion equivalent in currency-gold value).',
              unlocks: ['vendor-discount-5pct'],
            },
            {
              tier: 'Honored',
              discount: 10,
              reward: '10% discount; Honored stock unlocked (item-6 Sunfire Amulet pool accessible from vendor-wandering-merchant).',
              unlocks: ['vendor-discount-10pct', 'vendor-stock-honored'],
            },
            {
              tier: 'Revered',
              discount: 15,
              reward: '15% discount; Ashen Order heraldry cosmetic armor overlay unlocked.',
              unlocks: ['vendor-discount-15pct', 'cosmetic-ashen-armor-overlay'],
            },
            {
              tier: 'Exalted',
              discount: 20,
              reward: '20% discount (ceiling per vendor-laws); "Sword of the Ashen Order" title; faction-gated endgame arena unlocked.',
              unlocks: ['vendor-discount-20pct', 'title-sword-of-ashen-order', 'arena-ashen-crucible'],
            },
          ],
          discountFormula:
            'discountPct = (repTierIndex - neutralTierIndex) × 5 where neutralTierIndex=2, ' +
            'Friendly=3, Honored=4, Revered=5, Exalted=6. ' +
            'Linear: 0% at Neutral, 5% at Friendly, 10% at Honored, 15% at Revered, 20% at Exalted. ' +
            'Matches canon vendor-laws: linear off repTier, no custom curves, ceiling 20%. ' +
            'Discount applies to the buy price from vendor-wandering-merchant only (not repair, not buyback). ' +
            'Hostile tiers (Unfriendly) apply a −5% surcharge (negative discount in the same formula). ' +
            'Hated tier: access denied entirely.',
          wiringContract: {
            grantedBy:
              'UARPGFactionSubsystem::GetRepTier(factionId, playerId) returns the repTierIndex; ' +
              'UARPGVendorComponent.ComputeFinalPrice queries GetRepTier and looks up discountTiers[tier]',
            activatedBy:
              'Player tier-up broadcasts RepTierChanged(factionId, newTier) — ' +
              'UARPGVendorComponent subscribes and refreshes its cached discountPct on this event; ' +
              'award packages granted via GE_FactionTierUp_<tier> instant modifier on the buy-confirm path',
            dependencies: [
              'currencies (currency-gold — Friendly tier reward package value in DT_Currencies)',
              'items (item-6 Sunfire Amulet — Honored tier stock unlocked via vendor-wandering-merchant)',
              'vendors (vendor-wandering-merchant — discount consumer)',
            ],
            verification:
              'L2: GE_FactionTierUp_Friendly / Honored / Revered / Exalted compiled; ' +
              'DT_Factions seed row for faction-ashen-order with discount lookup compiled; ' +
              'L3: VSFactionRepTest — at Exalted, vendor price is exactly 20% below Neutral price in PIE',
          },
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'tier-reward-currency' },
            { catalogId: 'items', entityId: 'item-6', role: 'honored-tier-stock' },
            { catalogId: 'vendors', entityId: 'vendor-wandering-merchant', role: 'discount-consumer' },
          ],
        },
        links: [
          { catalogId: 'currencies', entityId: 'currency-gold', role: 'tier-reward-currency' },
          { catalogId: 'items', entityId: 'item-6', role: 'honored-tier-stock' },
          { catalogId: 'vendors', entityId: 'vendor-wandering-merchant', role: 'discount-consumer' },
        ],
      }),
      accept: minCount('tierRewards', '≥4 tier reward rows defined', 4),
    },

    // ── 5. NPC Members ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'NPC Members',
      view: { kind: 'manifest', field: 'members' },
      produce: () => ({
        data: {
          members: [
            {
              role: 'Rank Arbiter & Quest-Giver',
              npcId: 'char-captain-vael',
              name: 'Captain Vael',
              standingInteraction:
                'Dialogue line set keyed to repTier — ' +
                'Neutral: "Prove yourself, outsider."; ' +
                'Friendly: "Good to see you again, soldier."; ' +
                'Honored: "The Order recognizes your deeds."; ' +
                'Revered: "We few, we hold the line."; ' +
                'Exalted: "Sword of the Ashen Order — a rare honor."; ' +
                'Unfriendly: "Watch yourself."; ' +
                'Hated: *attacks on sight — no dialogue node loaded*.',
              questsOffered: [
                'Ember Frontier Patrol (main, +500 rep)',
                'Supply Runner (side, +250 rep)',
                'Crucible Sparring (repeatable, +75/day)',
              ],
              onHostileActPenalty:
                'Killing Captain Vael sets a permanent HOSTILE_FLAG on faction-ashen-order; ' +
                'rep hard-floored at −10000 (Hated); flag persists across saves.',
            },
            {
              role: 'Flavor Members (non-interactable)',
              npcId: 'npc-ashen-sentry-a',
              name: 'Ashen Order Sentry (generic)',
              standingInteraction:
                'Generic patrol NPC; guards faction-gated doors. Attacks at Hated. ' +
                'Not individually named — represented by a shared BP_AshenSentry actor class.',
              questsOffered: [],
              onHostileActPenalty: '−1000 rep per kill (same rule as any Order NPC member).',
            },
          ],
          membersNote:
            'Only char-captain-vael is a fully-resolvable named NPC (seeded in seed-characters.ts). ' +
            'Generic sentries are design-flavor — represented by a shared NPC actor BP, not individual catalog entries. ' +
            'Additional named officers may be added as the faction grows (pending characters catalog seed).',
          wiringContract: {
            grantedBy:
              'Each NPC member actor (AARPGNPCActor + UARPGDialogComponent) reads ' +
              'UARPGFactionSubsystem::GetRepTier(faction-ashen-order, playerId) on TalkTo/approach to select the dialogue node; ' +
              'hostile threshold triggers AARPGNPCActor::SetHostile(true) on the same delegate',
            activatedBy:
              'Player enters TalkTo range → DialogComponent.BeginDialog → GetRepTier → pick DialogSet[repTier]; ' +
              'RepTierChanged(Hated) event → broadcast to all Order NPC actors in the level → SetHostile(true)',
            dependencies: ['characters (char-captain-vael — primary quest-giver NPC)'],
            verification:
              'L2: AARPGNPCActor + UARPGDialogComponent + UARPGFactionSubsystem::GetRepTier compiled; ' +
              'char-captain-vael seeded in seed-characters.ts; ' +
              'L3: VSFactionRepTest — NPC dialogue node switches on rep tier change in PIE',
          },
          links: [{ catalogId: 'characters', entityId: 'char-captain-vael', role: 'faction-leader' }],
        },
        links: [{ catalogId: 'characters', entityId: 'char-captain-vael', role: 'faction-leader' }],
      }),
      accept: minCount('members', '≥1 NPC member declared', 1),
      staticChecks: (e) => [
        seedRowPresent('seed_factions.py', slug(e.name), 'Faction row seeded for this entity'),
      ],
    },

    // ── 6. Greeting & Disposition Hooks ───────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Greeting & Disposition Hooks',
      view: {
        kind: 'table',
        field: 'greetingHooks',
        columns: [{ key: 'tier' }, { key: 'dialogKey' }, { key: 'disposition' }],
      },
      produce: () => ({
        data: {
          greetingHooks: [
            { tier: 'Hated', dialogKey: 'FACTION_GREET_HATED', disposition: 'hostile', npcBehavior: 'attacks on sight; TalkTo blocked; dialogue node null' },
            { tier: 'Unfriendly', dialogKey: 'FACTION_GREET_UNFRIENDLY', disposition: 'cold', npcBehavior: 'terse refusal dialogue; vendor surcharge applied; no quests offered' },
            { tier: 'Neutral', dialogKey: 'FACTION_GREET_NEUTRAL', disposition: 'neutral', npcBehavior: 'baseline dialogue; quests available; no discount' },
            { tier: 'Friendly', dialogKey: 'FACTION_GREET_FRIENDLY', disposition: 'warm', npcBehavior: 'warm greeting; 5% discount displayed in vendor header' },
            { tier: 'Honored', dialogKey: 'FACTION_GREET_HONORED', disposition: 'honored', npcBehavior: 'honored rank greeting; Honored stock visible in vendor shop' },
            { tier: 'Revered', dialogKey: 'FACTION_GREET_REVERED', disposition: 'revered', npcBehavior: 'revered address; heraldry cosmetic available in vendor cosmetics tab' },
            { tier: 'Exalted', dialogKey: 'FACTION_GREET_EXALTED', disposition: 'exalted', npcBehavior: 'Exalted title address; 20% discount; Ashen Crucible gate opens on approach' },
          ],
          hookNote:
            'Greeting keys are resolved by UARPGDialogComponent.SelectGreeting(repTier) at TalkTo entry. ' +
            'The dialog key maps to a StringTable row (ST_FactionDialogue) — localized per §9 below. ' +
            'Disposition is a conceptual label; the actual behavior is a branch in the NPC\'s BT or the dialog component ' +
            '(e.g. bIsHostile flag on the NPC actor for Hated; vendor discount param for Friendly+). ' +
            'All Ashen Order NPCs share the same tier-indexed greeting set, read from the same faction row.',
          wiringContract: {
            grantedBy:
              'UARPGDialogComponent.SelectGreeting reads UARPGFactionSubsystem::GetRepTier ' +
              'and returns the matching FARPGDialogueSet row from DT_FactionDialogue',
            activatedBy:
              'Player enters TalkTo trigger volume → UARPGDialogComponent.BeginDialog → SelectGreeting(repTier)',
            dependencies: [],
            verification:
              'L2: FARPGDialogueSet + UARPGDialogComponent::SelectGreeting compiled; ' +
              'DT_FactionDialogue seeded with 7-tier rows for faction-ashen-order; ' +
              'L3: VSFactionRepTest — dialogue key matches expected tier on TalkTo event in PIE',
          },
        },
      }),
      accept: minCount('greetingHooks', '≥5 greeting hooks declared', 5),
    },

    // ── 7. Standing UI ────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Standing UI',
      view: {
        kind: 'table',
        field: 'standingUi',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }],
      },
      produce: () => ({
        data: {
          standingUi: {
            // canon proj-hud-binding: widget + display-format + HUD anchor declared
            widget: 'WBP_FactionRepBar',
            format: '{factionName} — {tierLabel} ({repPoints} / {tierMax})',
            anchor: 'bottom_right',
            hudBinding: {
              widgetClass: 'WBP_FactionRepBar',
              displayFormat: '{factionName} — {tierLabel} ({repPoints} / {tierMax})',
              hudAnchor: 'bottom_right',
            },
            tierChangeToast:
              'On RepTierChanged event: WBP_FactionTierToast slides in from bottom-right ' +
              '(3-second duration) with tier-color fill and the new tier label. ' +
              'Toast widget is WBP_FactionTierToast; anchor: bottom_right_toast_stack.',
            repBarColor:
              'Fills green for positive tiers (Friendly→Exalted), neutral grey for Neutral, ' +
              'red for hostile tiers (Unfriendly→Hated). ' +
              'Color uses CSS variables via SEVERITY_TOKENS — no hardcoded hex (coding conventions).',
            vendorHeaderLine:
              'In WBP_VendorShop header: "Discount: {discountPct}%" shown next to currency-gold wallet. ' +
              'Reads from UARPGVendorComponent.cachedDiscountPct which is refreshed on RepTierChanged.',
          },
        },
      }),
      accept: fieldsPopulated('standingUi', 'widget + format + anchor declared', ['widget', 'format', 'anchor']),
    },

    // ── 8. Heraldry Icon ──────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Heraldry Icon',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_Sigil`,
          `/Game/UI/Icons/T_${slug(e.name)}_Emblem_Friendly`,
          `/Game/UI/Icons/T_${slug(e.name)}_Emblem_Honored`,
          `/Game/UI/Icons/T_${slug(e.name)}_Emblem_Exalted`,
        ],
      }),
      accept: selected('selected', 'A faction heraldry icon is selected'),
    },

    // ── 9. Localization ───────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({
        data: {
          keys: [
            'FACTION_GREET_HATED',
            'FACTION_GREET_UNFRIENDLY',
            'FACTION_GREET_NEUTRAL',
            'FACTION_GREET_FRIENDLY',
            'FACTION_GREET_HONORED',
            'FACTION_GREET_REVERED',
            'FACTION_GREET_EXALTED',
            'FACTION_TIER_LABEL_HATED',
            'FACTION_TIER_LABEL_UNFRIENDLY',
            'FACTION_TIER_LABEL_NEUTRAL',
            'FACTION_TIER_LABEL_FRIENDLY',
            'FACTION_TIER_LABEL_HONORED',
            'FACTION_TIER_LABEL_REVERED',
            'FACTION_TIER_LABEL_EXALTED',
            'FACTION_TIER_UP_TOAST',
            'FACTION_TIER_DOWN_TOAST',
            'FACTION_REP_BAR_LABEL',
          ],
        },
      }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },

    // ── 10. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'AddRepPoints(faction-ashen-order, +3000) from Neutral → tier becomes Friendly',
            'AddRepPoints accumulating to 12000 → tier becomes Exalted',
            'Vendor discount at Exalted = 20% below Neutral price',
            'Vendor discount at Friendly = 5% below Neutral price',
            'AddRepPoints(−1000) from Friendly → net 2000 → tier drops to Neutral',
            'Tier at −10000 → Hated; TalkTo returns null dialogue node',
            'Passive decay at 10 pts/day from Revered does not drop below Honored floor',
            'RepTierChanged delegate broadcasts on every tier boundary crossing',
            'NPC greeting dialog key matches expected tier mapping',
          ],
        },
      }),
      accept: runtimeDeferred('VSFactionRepTest', 'Faction rep tier transitions verified in PIE'),
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_Factions :: ${s}`,
          `DT_FactionReputation :: ${s}`,
          `DT_FactionDialogue :: ${s}`,
          `T_${s}_Sigil`,
          `WBP_FactionRepBar`,
          `WBP_FactionTierToast`,
          `BP_FactionSubsystem_${s}`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'UARPGFactionSubsystem (a World Subsystem on UGameInstance) reads FARPGFactionRow ' +
                'from DT_Factions keyed by entity slug; per-player rep stored in DT_FactionReputation; ' +
                'dialogue set in DT_FactionDialogue; icon atlas via icon-sets (iconset-abilities family)',
              activatedBy:
                'Subsystem initializes on world load (UGameInstanceSubsystem::Initialize) and ' +
                'restores player rep from DT_FactionReputation; ' +
                'UARPGFactionSubsystem::AddRepPoints called on quest-complete / kill / trade events; ' +
                'EvaluateTier called post-add → RepTierChanged broadcast',
              dependencies: [
                'currencies (currency-gold in DT_Currencies — Friendly reward package)',
                'items (item-6 Sunfire Amulet — Honored tier stock)',
                'vendors (vendor-wandering-merchant — discount consumer)',
                'characters (char-captain-vael — seeded in seed-characters.ts)',
                'icon-sets (iconset-abilities — heraldry icon atlas family)',
              ],
              verification:
                'L2: UARPGFactionSubsystem.cpp + FARPGFactionRow + FARPGFactionReputationRow in Source/PoF/ compiled; ' +
                'seed_factions.py seeds entity slug row in DT_Factions + DT_FactionReputation; ' +
                'char-captain-vael row in seed-characters.ts; ' +
                'L3: VSFactionRepTest — full tier-transition loop in PIE with discount verification',
            },
          },
          ueAssets: assets.map((a) => `/Game/Factions/${a}`),
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'tier-reward-currency' },
            { catalogId: 'items', entityId: 'item-6', role: 'honored-tier-stock' },
            { catalogId: 'vendors', entityId: 'vendor-wandering-merchant', role: 'discount-consumer' },
            { catalogId: 'characters', entityId: 'char-captain-vael', role: 'faction-leader' },
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'heraldry-icon-family' },
          ],
        };
      },
      accept: minCount('assets', '≥5 UE assets packaged', 5),
      staticChecks: (e) => [
        cppSymbolExists('UARPGFactionSubsystem', 'Faction subsystem in Source/'),
        cppSymbolExists('FARPGFactionRow', 'Faction row struct in Source/'),
        cppSymbolExists('FARPGFactionReputationRow', 'Faction reputation row struct in Source/'),
        seedRowPresent('seed_factions.py', slug(e.name), 'Faction row seeded in Content/Python'),
      ],
    },
  ],
});
