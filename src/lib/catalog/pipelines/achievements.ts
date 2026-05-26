import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Achievements pipeline (catalogId: 'achievements').
 *
 * An achievement is a server-authoritative player accomplishment tracked across
 * sessions. Each achievement listens to one or more gameplay events on the server,
 * increments an integer progress counter, and unlocks when the counter reaches its
 * configured threshold. Unlock is idempotent (fires exactly once per entity-player
 * pair). Starter entity: "First Blood" (first enemy kill).
 *
 * Wiring: UARPGAchievementSubsystem lives on the GameState (server-only); it
 * processes gameplay events forwarded by the server's GAS, writes progress rows
 * to DT_Achievements, and RPC-notifies the owning PlayerController on unlock.
 * The PlayerController fires the HUD toast (proj-hud-binding) and grants the
 * reward via an Execute_GE (GE_Achievement_<Slug>) on the player's ASC.
 */
registerCatalogPipeline({
  catalogId: 'achievements',
  steps: [
    // ── 1. Concept Brief ─────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a server-tracked player accomplishment in PoF — the simplest entry in ` +
            `the achievement ladder and the one every new character earns within the first ` +
            `encounter. Its unlock condition is a single enemy kill (killCount ≥ 1) fired from a ` +
            `real gameplay event (GAS tag Event.Combat.EnemyKilled broadcast by ` +
            `AARPGEnemyCharacter::OnDeath). Progress is authoritative on the server only; the ` +
            `UARPGAchievementSubsystem on the GameState receives the event, increments the kill ` +
            `counter, and unlocks when threshold 1 is crossed. Unlock is idempotent — the ` +
            `subsystem guards against duplicate grants using a persistent world-state tag ` +
            `(Achievement.FirstBlood.Unlocked) written to the save file. On unlock the server ` +
            `RPC-notifies the PlayerController, which fires the HUD toast (WBP_AchievementToast, ` +
            `canvas slot AchievementToastAnchor, format "[icon] Achievement Unlocked: ${e.name}") ` +
            `and grants GE_Achievement_${slug(e.name)} on the player's ASC, awarding 100 gold ` +
            `(currency-gold) and one Minor Health Potion (item-7). Telemetry fires ` +
            `achievement_unlocked with the achievementId and sessionKillCount payload. ` +
            `The achievement is VISIBLE before unlock (players can see the objective) and maps to ` +
            `platform trophy/achievement ID ACH_FIRST_BLOOD (Steam + PSN + Xbox) worth 5 points ` +
            `(Steam) / Bronze (PSN). Its icon is sourced from the iconset-abilities family ` +
            `(a blood-droplet silhouette, 256px, rarity-framed Normal/white). ` +
            `Anti-cheat: the kill event is server-authoritative; clients cannot self-report progress.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Trigger & Progress ────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Trigger & Progress',
      view: {
        kind: 'table',
        field: 'triggerProgress',
        columns: [
          { key: 'gameplayEvent' },
          { key: 'progressMetric' },
          { key: 'threshold' },
          { key: 'guard' },
        ],
      },
      produce: () => ({
        data: {
          triggerProgress: {
            gameplayEvent:
              'Event.Combat.EnemyKilled — broadcast by AARPGEnemyCharacter::OnDeath via ' +
              'UAbilitySystemComponent::ExecuteGameplayCueLocal → UARPGAchievementSubsystem::OnEnemyKilled()',
            progressMetric: 'killCount (integer, server-side, persisted in FARPGAchievementSaveRow)',
            threshold: 1,
            incrementPerEvent: 1,
            guard:
              'Achievement.FirstBlood.Unlocked world-state tag checked BEFORE incrementing — ' +
              'if tag is present the event is a no-op (idempotent unlock; exactly one grant per player).',
            progressBarDisplay:
              'integer fraction: current/threshold shown on the achievement detail panel ' +
              '(e.g. "0 / 1 kills" → "1 / 1 kills" on unlock)',
            note:
              'Event.Combat.EnemyKilled is the canonical server-side kill event (fired after ' +
              'AARPGEnemyCharacter health reaches 0, AFTER loot drop, BEFORE actor destruction). ' +
              'The subsystem listens via a GameplayEvent delegate registered in BeginPlay. ' +
              'A kill by any damage source (melee, spell, DoT) counts — no source-type filter. ' +
              'The per-event increment is always 1; multi-kill effects do not grant double credit.',
            wiringContract: {
              grantedBy:
                'UARPGAchievementSubsystem::OnEnemyKilled() — registered on GameState in BeginPlay, ' +
                'server-only (HasAuthority() guard)',
              activatedBy:
                'AARPGEnemyCharacter::OnDeath → ExecuteGameplayCueLocal(Event.Combat.EnemyKilled) ' +
                '→ subsystem delegate fires',
              dependencies: [
                'bestiary (AARPGEnemyCharacter — broadcasts Event.Combat.EnemyKilled on death)',
                'characters (player UAbilitySystemComponent + UARPGGameplayTagComponent for guard tag)',
              ],
              verification:
                'L2: UARPGAchievementSubsystem declared in Source/PoF/ with OnEnemyKilled(); ' +
                'L3: VSAchievementTest — kill one enemy in PIE → killCount increments to 1 → unlock fires',
            },
          },
        },
      }),
      accept: fieldsPopulated(
        'triggerProgress',
        'gameplayEvent + progressMetric + threshold + guard defined',
        ['gameplayEvent', 'progressMetric', 'threshold', 'guard'],
      ),
      staticChecks: () => [
        cppSymbolExists('UARPGAchievementSubsystem', 'Achievement subsystem present in Source/PoF/'),
      ],
    },

    // ── 3. Hidden / Visible ──────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Hidden / Visible',
      view: {
        kind: 'table',
        field: 'visibility',
        columns: [{ key: 'state' }, { key: 'spoilerPolicy' }, { key: 'unlockReveal' }],
      },
      produce: () => ({
        data: {
          visibility: {
            state: 'visible',
            spoilerPolicy:
              'VISIBLE before unlock — the name, description, and progress counter are shown ' +
              'on the achievement list. No spoiler-gating is required because the unlock condition ' +
              '(kill one enemy) reveals nothing about the story.',
            hiddenCondition: 'n/a — this achievement is never hidden',
            unlockReveal: 'n/a — already visible; the unlock event just changes the status badge',
            hiddenExamples:
              'Hidden achievements (future) use state="hidden" until a prerequisite ' +
              'GameplayTag is set; the achievement list shows a "???" placeholder name with ' +
              '"Achievement locked — keep exploring." as the description until revealed.',
            note:
              'Per the arpg-wiring-contract canon: the visibility field is stored in ' +
              'FARPGAchievementRow.bIsHidden (bool); the HUD reads it via the subsystem. ' +
              'Hidden→revealed transitions fire a separate reveal RPC distinct from the unlock RPC.',
          },
        },
      }),
      accept: fieldsPopulated('visibility', 'state + spoilerPolicy + unlockReveal defined', [
        'state',
        'spoilerPolicy',
        'unlockReveal',
      ]),
    },

    // ── 4. Reward Binding ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Reward Binding',
      view: {
        kind: 'table',
        field: 'reward',
        columns: [{ key: 'gold' }, { key: 'item' }, { key: 'grantMechanism' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          reward: {
            gold: {
              catalogId: 'currencies',
              entityId: 'currency-gold',
              amount: 100,
              note: '100 gold (currency-gold) — a meaningful but not economy-breaking starter reward; ' +
                'sits within the proj-balance tier-100 ±10% power envelope for a level-1 milestone.',
            },
            item: {
              catalogId: 'items',
              entityId: 'item-7',
              name: 'Minor Health Potion',
              quantity: 1,
              note:
                'item-7 = Minor Health Potion (Consumable/Potion/Common, heals 50 HP base). ' +
                'One potion granted on first-kill unlock — a low-value but thematically fitting ' +
                '"survivor" reward for the post-Sundering tone. Does not break the economy.',
            },
            grantMechanism:
              'GE_Achievement_' + slug(e.name) + ' — an instant GameplayEffect applied by ' +
              'UARPGAchievementSubsystem to the player\'s ASC on the server after unlock is ' +
              'confirmed. GE executes UARPGCurrencyExecution (+100 gold via currency-gold attribute) ' +
              'and UARPGInventoryGrantExecution (+1 item-7 to player inventory). ' +
              'Both executions are idempotent (guard: Achievement.FirstBlood.Unlocked tag already set ' +
              'before GE is applied, so no double-grant on session reconnect).',
            wiringContract: {
              grantedBy:
                'UARPGAchievementSubsystem::GrantReward() → ' +
                'UAbilitySystemComponent::ApplyGameplayEffectToSelf(GE_Achievement_' + slug(e.name) + ')',
              activatedBy:
                'Subsystem unlock path — fires immediately after Achievement.FirstBlood.Unlocked tag is written',
              dependencies: [
                'currencies (currency-gold — UARPGCurrencyExecution modifies gold attribute)',
                'items (item-7 Minor Health Potion — UARPGInventoryGrantExecution adds to inventory)',
              ],
              verification:
                'L2: GE_Achievement_' + slug(e.name) + ' declared in Source/PoF/ (or Content/Abilities/); ' +
                'L3: VSAchievementTest — after unlock, player gold += 100 and inventory contains item-7',
            },
            links: [
              { catalogId: 'currencies', entityId: 'currency-gold', role: 'unlock-reward-gold' },
              { catalogId: 'items', entityId: 'item-7', role: 'unlock-reward-item' },
            ],
          },
          links: [
            { catalogId: 'currencies', entityId: 'currency-gold', role: 'unlock-reward-gold' },
            { catalogId: 'items', entityId: 'item-7', role: 'unlock-reward-item' },
          ],
        },
        links: [
          { catalogId: 'currencies', entityId: 'currency-gold', role: 'unlock-reward-gold' },
          { catalogId: 'items', entityId: 'item-7', role: 'unlock-reward-item' },
        ],
        ueAssets: [`/Game/Abilities/Achievements/GE_Achievement_${slug(e.name)}`],
      }),
      accept: minCount('links', '≥1 reward link (gold or item) declared', 1),
      staticChecks: (e) => [
        cppSymbolExists('UARPGAchievementSubsystem', 'Achievement subsystem grants reward via ASC'),
        seedRowPresent('seed_achievements.py', slug(e.name), 'Achievement row seeded in DT_Achievements'),
      ],
    },

    // ── 5. Platform Spec ─────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Platform Spec',
      view: {
        kind: 'table',
        field: 'platform',
        columns: [{ key: 'steam' }, { key: 'psn' }, { key: 'xbox' }],
      },
      produce: () => ({
        data: {
          platform: {
            canonicalId: 'ACH_FIRST_BLOOD',
            steam: {
              apiName: 'ACH_FIRST_BLOOD',
              points: 5,
              displayName: 'First Blood',
              description: 'Kill your first enemy.',
              hidden: false,
            },
            psn: {
              id: 'ACH_FIRST_BLOOD',
              trophyType: 'Bronze',
              label: 'First Blood',
              description: 'Defeat your first enemy in the Shattered Realms.',
              hidden: false,
            },
            xbox: {
              id: 'ACH_FIRST_BLOOD',
              gamerscore: 5,
              label: 'First Blood',
              description: 'Kill your first enemy.',
              hidden: false,
            },
            mappingNote:
              'All three platforms share the canonical id ACH_FIRST_BLOOD stored in ' +
              'FARPGAchievementRow.PlatformId (a FString). The Subsystem calls the platform ' +
              'achievement API (ISteamUserStats / PSN TrophySystem / XboxLive AchievementsService) ' +
              'after the in-game unlock is confirmed. Scores are equivalent across platforms: ' +
              '5 Steam points ≈ 5 Gamerscore ≈ Bronze trophy — the lightest possible tier ' +
              'for a universal "first action" accomplishment.',
            wiringContract: {
              grantedBy:
                'UARPGAchievementSubsystem::NotifyPlatform(PlatformId) called after in-game unlock ' +
                'writes the save row; delegates to UAchievementOnlineSubsystem (wraps OSS layer)',
              activatedBy:
                'In-game unlock confirmed → GrantReward() → NotifyPlatform("ACH_FIRST_BLOOD")',
              dependencies: [
                'Online Subsystem (Steam OSS, PSN, Xbox Live via UE5 UAchievementOnlineSubsystem)',
              ],
              verification:
                'L2: FARPGAchievementRow.PlatformId populated in DT_Achievements; ' +
                'UAchievementOnlineSubsystem compiled; ' +
                'L3: VSAchievementTest — platform WriteAchievement call fires in PIE with -DevMode OSS',
            },
          },
        },
      }),
      accept: fieldsPopulated('platform', 'steam + psn + xbox platform entries defined', [
        'steam',
        'psn',
        'xbox',
      ]),
    },

    // ── 6. Icon / Badge ──────────────────────────────────────────────────────
    // Universal icon step (AUTHORING.md §3). L1 gallery; links iconset-abilities.
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          selected: 0,
          iconDesignFlavor:
            'A blood droplet in a 3/4-view downward splash, 256px, rarity-framed Normal/white. ' +
            'Upper-left light per art-icons canon. Muted crimson on dark field — restrained (game-tone). ' +
            'Sourced from iconset-abilities (icon-sets::iconset-abilities) T_AbilityIcons_Atlas. ' +
            'At 32px the silhouette must still read as a droplet (art-icon-a11y: legible at 32px).',
          links: [
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'achievement-badge' },
          ],
        },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'achievement-badge' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_AchievementIcon`],
      }),
      accept: selected('selected', 'An achievement badge icon is selected'),
    },

    // ── 7. Unlock Toast ──────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Unlock Toast',
      view: {
        kind: 'table',
        field: 'toast',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'anchor' }, { key: 'duration' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          toast: {
            widget: 'WBP_AchievementToast',
            format: '[icon] Achievement Unlocked: {achievementName}',
            anchor: 'AchievementToastAnchor',
            duration: 4.0,
            stackBehavior:
              'queue — if a second toast fires within the current toast duration, it waits ' +
              'until the first finishes (no overlap, no suppression). Queue depth: 3 max.',
            hudBinding:
              'Declared per proj-hud-binding canon: widget=WBP_AchievementToast, ' +
              'displayFormat="[icon] Achievement Unlocked: {achievementName}", ' +
              'anchor=AchievementToastAnchor (a named slot in WBP_HUD). ' +
              'The toast subscribes to the UARPGAchievementSubsystem unlock delegate on the ' +
              'owning PlayerController.',
            animIn: 'slide-in from right (0.25s ease-out)',
            animOut: 'fade-out (0.5s, after duration elapses)',
            localizationKey: 'ACHIEVEMENT_TOAST_TITLE',
            achievementNameKey: `ACH_${slug(e.name).toUpperCase()}_NAME`,
            note:
              'Sound cue SC_AchievementUnlock plays simultaneously with the slide-in. ' +
              'No audio catalog entity seeded yet; add link once seeded.',
            wiringContract: {
              grantedBy:
                'APlayerController::Client_ShowAchievementToast() RPC — called by ' +
                'UARPGAchievementSubsystem on the owning controller after GrantReward()',
              activatedBy:
                'Server unlock confirmed → RPC fires on client → WBP_AchievementToast::PlayToast(data)',
              dependencies: [
                'hud-elements (WBP_HUD — exposes AchievementToastAnchor slot for toast injection)',
                'icon-sets (iconset-abilities — T_AbilityIcons_Atlas frame used in toast icon)',
              ],
              verification:
                'L2: WBP_AchievementToast declared in Content/UI/HUD/; ' +
                'WBP_HUD exposes AchievementToastAnchor CanvasPanel slot; ' +
                'L3: VSAchievementTest — toast visible in PIE within 1 frame of unlock RPC',
            },
          },
        },
      }),
      accept: fieldsPopulated('toast', 'widget + format + anchor + duration defined', [
        'widget',
        'format',
        'anchor',
        'duration',
      ]),
    },

    // ── 8. Anti-Cheat / Validation ───────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Anti-Cheat / Validation',
      view: {
        kind: 'table',
        field: 'antiCheat',
        columns: [{ key: 'authorityModel' }, { key: 'idempotencyGuard' }, { key: 'auditLog' }],
      },
      produce: () => ({
        data: {
          antiCheat: {
            authorityModel:
              'Server-authoritative — UARPGAchievementSubsystem runs only on the server ' +
              '(HasAuthority() guard in BeginPlay). Clients NEVER call unlock functions directly. ' +
              'The kill event is forwarded from AARPGEnemyCharacter::OnDeath (server side only). ' +
              'No client-predicted progress — counter lives in FARPGAchievementSaveRow on the server.',
            idempotencyGuard:
              'Achievement.FirstBlood.Unlocked world-state tag is written to the save file at ' +
              'the moment of unlock. All subsequent OnEnemyKilled events check this tag first and ' +
              'return early if set. GE_Achievement_FirstBlood is therefore applied at most once ' +
              'per save file.',
            auditLog:
              'Every unlock attempt (success and duplicate) is logged to UARPGTelemetrySubsystem ' +
              'with fields: { achievementId, playerId, sessionId, killCount, wasAlreadyUnlocked }. ' +
              'Duplicate-unlock attempts increment a suspicion counter; if > 3 duplicates in one ' +
              'session the subsystem flags the session for review (no automatic ban — human review).',
            networkValidation:
              'The kill event carries a server-generated eventId; duplicate eventIds (network ' +
              'resend) are deduplicated by the subsystem before incrementing the counter.',
            wiringContract: {
              grantedBy:
                'UARPGAchievementSubsystem (server-only, HasAuthority) — all unlock logic is here',
              activatedBy:
                'Event.Combat.EnemyKilled gameplay event, forwarded server-side from ' +
                'AARPGEnemyCharacter::OnDeath',
              dependencies: [
                'characters (server-side UAbilitySystemComponent — tag write target)',
                'save system (FARPGAchievementSaveRow — persistent idempotency store)',
              ],
              verification:
                'L2: UARPGAchievementSubsystem HasAuthority() guard present in Source/; ' +
                'L3: VSAchievementTest — unlock cannot be triggered by a direct client RPC (rejected server-side)',
            },
          },
        },
      }),
      accept: fieldsPopulated('antiCheat', 'authorityModel + idempotencyGuard + auditLog defined', [
        'authorityModel',
        'idempotencyGuard',
        'auditLog',
      ]),
      staticChecks: () => [
        cppSymbolExists('UARPGAchievementSubsystem', 'Achievement subsystem is server-authoritative'),
      ],
    },

    // ── 9. Telemetry ─────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Telemetry',
      view: {
        kind: 'table',
        field: 'telemetry',
        columns: [{ key: 'events' }, { key: 'metric' }],
      },
      produce: () => ({
        data: {
          telemetry: {
            events: [
              {
                name: 'achievement_unlocked',
                trigger: 'UARPGAchievementSubsystem — immediately after unlock tag is written',
                payload:
                  '{ achievementId: "achievement-first-blood", playerId, sessionId, ' +
                  'sessionKillCount: number, timeToUnlock_ms: number }',
              },
              {
                name: 'achievement_progress',
                trigger: 'UARPGAchievementSubsystem — on each OnEnemyKilled event before unlock',
                payload:
                  '{ achievementId, playerId, progressCurrent: number, progressThreshold: 1 }',
                note: 'For First Blood this fires at most once (progress 0→1 = unlock); ' +
                  'useful for multi-kill achievements in the same pipeline.',
              },
              {
                name: 'achievement_reward_granted',
                trigger: 'UARPGAchievementSubsystem::GrantReward() — after GE applied to ASC',
                payload:
                  '{ achievementId, playerId, rewardGold: 100, rewardItemId: "item-7", rewardItemQty: 1 }',
              },
            ],
            metric: 'unlock_rate',
            metricDef:
              'unlock_rate = sessions_where_achievement_unlocked / total_sessions_started. ' +
              'Expected ≈ 1.0 for First Blood (every player kills an enemy). ' +
              'Significant deviation (< 0.8) flags a tutorial/onboarding funnel failure. ' +
              'Persisted to UARPGTelemetrySubsystem; queryable per achievement_id.',
            wiringContract: {
              grantedBy:
                'UARPGTelemetrySubsystem::RecordAchievementEvent() called by ' +
                'UARPGAchievementSubsystem at each telemetry point',
              activatedBy:
                'OnEnemyKilled / GrantReward paths in UARPGAchievementSubsystem ' +
                'each call RecordAchievementEvent with the appropriate event name + payload',
              dependencies: ['characters (playerId / sessionId from player state)'],
              verification:
                'L2: UARPGTelemetrySubsystem::RecordAchievementEvent() declared in Source/PoF/; ' +
                'L3: VSAchievementTest — all 3 event names appear in the analytics log during a PIE run',
            },
          },
        },
      }),
      accept: fieldsPopulated('telemetry', 'events + metric defined', ['events', 'metric']),
      staticChecks: () => [
        cppSymbolExists('UARPGTelemetrySubsystem', 'Telemetry subsystem used for achievement events'),
      ],
    },

    // ── 10. Localization ─────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({
        data: {
          keys: [
            'ACH_FIRST_BLOOD_NAME       — "First Blood"',
            'ACH_FIRST_BLOOD_DESC       — "Kill your first enemy in the Shattered Realms."',
            'ACH_FIRST_BLOOD_LOCKED     — "Defeat one enemy to unlock this achievement."',
            'ACHIEVEMENT_TOAST_TITLE    — "Achievement Unlocked"',
            'ACH_FIRST_BLOOD_REWARD     — "Reward: 100 Gold + 1× Minor Health Potion"',
          ],
          locNote:
            'Keys follow PascalCase with namespace prefix (ACH_). ' +
            'PSN and Xbox platform strings share the ACH_FIRST_BLOOD_NAME / _DESC keys ' +
            '(the platform submission portal uses the same localization table). ' +
            'Steam API overrides with the SteamAppAdmin panel; keys act as fallback. ' +
            'Spoiler-gated achievements use ACH_*_LOCKED until the reveal condition is met.',
        },
      }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'achievement does NOT unlock before any enemy is killed (killCount = 0)',
            'killing one enemy increments killCount to 1 and fires the unlock path',
            'unlock fires exactly once — a second kill does not re-grant reward or re-fire RPC',
            'Achievement.FirstBlood.Unlocked tag is written to save and persists across session reload',
            'GE_Achievement_FirstBlood grants +100 currency-gold to the player ASC',
            'GE_Achievement_FirstBlood grants +1 item-7 (Minor Health Potion) to player inventory',
            'WBP_AchievementToast is visible in PIE within 1 frame of the unlock RPC',
            'Platform WriteAchievement fires for ACH_FIRST_BLOOD via DevMode OSS stub',
            'achievement_unlocked + achievement_reward_granted both appear in the telemetry log',
            'direct client RPC to unlock is rejected by server HasAuthority() guard',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSAchievementTest',
        'Trigger fires unlock + reward grants once in PIE',
      ),
    },

    // ── 12. UE Packaging ─────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DT_Achievements :: ${s}`,
          `GE_Achievement_${s}`,
          `T_${s}_AchievementIcon`,
          `WBP_AchievementToast`,
          `SC_AchievementUnlock`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'UARPGAchievementSubsystem (server-only, GameState) — reads FARPGAchievementRow ' +
                'from DT_Achievements keyed by "' + s + '"',
              activatedBy:
                'AARPGEnemyCharacter::OnDeath → Event.Combat.EnemyKilled gameplay event → ' +
                'UARPGAchievementSubsystem::OnEnemyKilled() → unlock check → GrantReward() → ' +
                'GE_Achievement_' + s + ' applied to player ASC → Client_ShowAchievementToast() RPC ' +
                '→ WBP_AchievementToast shown on client HUD',
              dependencies: [
                'bestiary (AARPGEnemyCharacter — source of Event.Combat.EnemyKilled)',
                'currencies (currency-gold — reward execution target)',
                'items (item-7 Minor Health Potion — inventory grant target)',
                'icon-sets (iconset-abilities — T_AbilityIcons_Atlas for badge + toast icon)',
                'hud-elements (WBP_HUD — exposes AchievementToastAnchor slot)',
                'Online Subsystem (UAchievementOnlineSubsystem — platform trophy API bridge)',
              ],
              verification:
                'L2: UARPGAchievementSubsystem.cpp compiled; FARPGAchievementRow in Source/PoF/; ' +
                'DT_Achievements seeded via seed_achievements.py; GE_Achievement_' + s + ' in Content/Abilities/Achievements/; ' +
                'L3: VSAchievementTest — full unlock cycle passes in PIE (kill→progress→unlock→reward→toast→telemetry)',
            },
          },
          ueAssets: [
            `/Game/Progression/Achievements/DT_Achievements`,
            `/Game/Abilities/Achievements/GE_Achievement_${s}`,
            `/Game/UI/Icons/T_${s}_AchievementIcon`,
            `/Game/UI/HUD/WBP_AchievementToast`,
            `/Game/Audio/UI/SC_AchievementUnlock`,
          ],
        };
      },
      accept: minCount('assets', '≥2 UE assets packaged', 2),
      staticChecks: (e) => [
        cppSymbolExists('UARPGAchievementSubsystem', 'Achievement subsystem present in Source/PoF/'),
        cppSymbolExists('FARPGAchievementRow', 'Achievement row struct present in Source/PoF/'),
        seedRowPresent('seed_achievements.py', slug(e.name), 'Achievement row seeded in Content/Python'),
      ],
    },
  ],
});
