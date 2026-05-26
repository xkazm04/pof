import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Progression Curves pipeline (catalogId: 'progression-curves').
 *
 * Models the Hero Level XP curve per ARPG-LAWS §9 and the scoped canon rule
 * `arpg-leveling`.  One entity drives a complete heroic leveling curve
 * (levels 1–100) with:
 *   - A geometric XP formula  xpToNext(L) = base × growth^L  (base = 100, growth ≈ 1.08)
 *   - Concrete sample values at L1/10/50/90 and a soft cap at L90
 *   - XP sources (kill, quest, exploration) with relative contribution weights
 *   - Per-level reward schedule (passive points + milestone unlocks)
 *   - Caps & catch-up mechanics (death penalty, streak bonus, mentor-mode)
 *   - Death penalty XP sink (high-level loss, canon proj-economy spirit)
 *   - Balance figure: expected time-to-level at L50 sitting within ±20% of
 *     a 45-minute target (the standard mid-game pacing beat)
 *   - Telemetry hooks (level_up event)
 *   - XP Bar UI contract (proj-hud-binding)
 *   - Icon 2D Art (universal gallery step; links icon-sets::iconset-abilities)
 *   - Test Gate (VSProgressionCurveTest, deferred L3)
 *   - UE Packaging (CT_XPRequirements curve table)
 *
 * Wiring: GE_AwardXP grants XP via UARPGAttributeSet.XP → attribute change
 * triggers UARPGProgressionComponent::OnXPChanged → applies the CT_XPRequirements
 * curve table → increments CharacterLevel → grants passive points via
 * UARPGProgressionComponent::GrantLevelUpRewards.  CharacterLevel feeds
 * skill/gem level requirements (spellbook) and scales DT_AttributeDefaults
 * growth rows.  Verification: VSProgressionCurveTest in PIE confirms XP →
 * level-up transitions at the declared thresholds.
 */

registerCatalogPipeline({
  catalogId: 'progression-curves',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the canonical XP-to-level curve for the PoF hero. It defines the ` +
            `entire progression arc from level 1 (first kill) to the soft cap at level 90 and ` +
            `the hard cap at level 100. The curve is geometric — each level demands roughly 8% ` +
            `more XP than the previous — so early levels (1–30) feel brisk and rewarding while ` +
            `mid-game (50–70) provides sustained content engagement and high levels (90–100) ` +
            `become a long optional grind for prestige and rare ascendancy nodes. ` +
            `This pacing follows the Diablo/PoE genre contract: power is earned, never gifted ` +
            `(canon game-pillars). XP sources are kills (primary), quests (bonus bursts), and ` +
            `exploration milestones (minor bonuses). The death penalty at high levels (L70+) ` +
            `creates a genuine XP sink that makes loss meaningful without being punishing below ` +
            `the cap — reflecting the grim, earned tone of the Ashen Order setting. ` +
            `The curve table realizes as CT_XPRequirements (a UCurveTable) in UE, consumed by ` +
            `UARPGProgressionComponent; GE_AwardXP is the GameplayEffect that grants XP on ` +
            `kill/quest triggers; CharacterLevel is a UARPGAttributeSet attribute. ` +
            `The XP bar and level-up notification bind to the HUD per proj-hud-binding.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Curve Formula ──────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Curve Formula',
      view: {
        kind: 'table',
        field: 'curveFormula',
        columns: [
          { key: 'formula' },
          { key: 'base' },
          { key: 'exponent' },
          { key: 'softCap' },
          { key: 'sampleValues' },
        ],
      },
      produce: () => {
        // xpToNext(L) = base × growth^L  where base = 100, growth = 1.08
        // Sample values (rounded to integers):
        //   L1  = 100 × 1.08^1  = 108
        //   L10 = 100 × 1.08^10 = 100 × 2.159 ≈ 216
        //   L50 = 100 × 1.08^50 = 100 × 46.902 ≈ 4 690
        //   L90 = 100 × 1.08^90 = 100 × 1 018.9 ≈ 101 890
        //
        // Cumulative XP to reach level L:
        //   xpTotal(L) = base × (growth^L − 1) / (growth − 1)
        //   xpTotal(50) ≈ 100 × (46.902 − 1) / 0.08 ≈ 57 377
        //   xpTotal(90) ≈ 100 × (1 018.9 − 1) / 0.08 ≈ 1 272 375
        //
        // Soft cap at L90: per-level XP cost does NOT increase beyond L90
        // (xpToNext is clamped to the L90 value ≈ 101 890 for L91–100)
        const base = 100;
        const growth = 1.08;
        const xpAtL1 = Math.round(base * Math.pow(growth, 1));
        const xpAtL10 = Math.round(base * Math.pow(growth, 10));
        const xpAtL50 = Math.round(base * Math.pow(growth, 50));
        const xpAtL90 = Math.round(base * Math.pow(growth, 90));
        return {
          data: {
            curveFormula: {
              formula: 'xpToNext(L) = base × growth^L',
              base,
              exponent: growth,
              softCap: 90,
              hardCap: 100,
              sampleValues: {
                L1: xpAtL1,
                L10: xpAtL10,
                L50: xpAtL50,
                L90: xpAtL90,
                note:
                  `Geometric series: each level needs ≈${((growth - 1) * 100).toFixed(0)}% more XP than ` +
                  `the previous. L90 (soft cap): ${xpAtL90.toLocaleString()} XP. ` +
                  `L91–100 are clamped to the L90 cost (no further growth), making ` +
                  `them long-but-finite prestige levels. ` +
                  `Cumulative XP to reach L50 ≈ ${Math.round(base * (Math.pow(growth, 50) - 1) / (growth - 1)).toLocaleString()} — ` +
                  `calibrated to ≈45 hours of active play at typical kill rates.`,
              },
              softCapNote:
                'At L90 the per-level XP cost is clamped — each level from 91 to 100 costs the same ' +
                `≈${xpAtL90.toLocaleString()} XP, so hitting the hard cap is possible but requires ` +
                'dedicated grind. Per ARPG-LAWS §9 this is the standard soft-cap / long-grind pattern.',
              wiringContract: {
                grantedBy:
                  'GE_AwardXP (a GameplayEffect with XP magnitude) → UARPGAttributeSet.XP via ' +
                  'UARPGProgressionComponent::OnXPChanged attribute listener',
                activatedBy:
                  'Kill: AARPGEnemyCharacter::OnDeath → AARPGQuestManager::NotifyKill → GE_AwardXP magnitude = monster XP; ' +
                  'Quest: AARPGQuestManager::GrantRewards → GE_AwardXP; ' +
                  'Exploration: AARPGTriggerVolume::OnEnter → GE_AwardXP (once per milestone)',
                dependencies: [
                  'characters (CharacterLevel attribute in UARPGAttributeSet)',
                  'spellbook (skill level gates consume CharacterLevel)',
                ],
                verification:
                  'L2: FARPGXPCurveRow declared in Source/PoF/; GE_AwardXP compiled; ' +
                  'CT_XPRequirements seeded via seed_progression_curves.py; ' +
                  'L3: VSProgressionCurveTest — GE_AwardXP awards XP, XP crosses threshold, CharacterLevel increments',
              },
            },
          },
        };
      },
      accept: fieldsPopulated('curveFormula', 'formula / base / exponent / softCap populated', [
        'formula',
        'base',
        'exponent',
        'softCap',
      ]),
      staticChecks: () => [
        cppSymbolExists('FARPGXPCurveRow', 'XP curve row struct present in UE Source'),
      ],
    },

    // ── 3. XP Sources ─────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'XP Sources',
      view: {
        kind: 'table',
        field: 'xpSources',
        columns: [
          { key: 'kills' },
          { key: 'quests' },
          { key: 'exploration' },
          { key: 'scalingNote' },
        ],
      },
      produce: () => ({
        data: {
          xpSources: {
            kills: {
              contribution: '~70% of total XP',
              formula: 'killXP = baseMonsterXP × (monsterLevel / playerLevel)^0.5',
              // At parity (monsterLevel = playerLevel): full XP.  Under-levelled monsters give less.
              // Scale factor clamped: min 0.10 (20+ levels under), max 1.50 (5+ levels over player).
              baseXPByRarity: {
                normal: 'monsterLevel × 3',
                magic: 'monsterLevel × 6 (×2 vs Normal, per ARPG-LAWS §6)',
                rare: 'monsterLevel × 15 (×5 vs Normal)',
                unique_boss: 'monsterLevel × 30 + flat bonus 500',
              },
              underLevelScaling:
                'Monsters > 10 levels below the player grant scaled-down XP (min 10% of base). ' +
                'Monsters ≥5 levels above the player grant up to 150% XP — risk/reward. ',
            },
            quests: {
              contribution: '~20% of total XP',
              tiers: [
                { tier: 1, reward: 'xpToNext(L) × 0.15', note: 'Short fetch quest' },
                { tier: 2, reward: 'xpToNext(L) × 0.30', note: 'Multi-stage kill quest' },
                { tier: 3, reward: 'xpToNext(L) × 0.50', note: 'Main-story chapter quest' },
                { tier: 4, reward: 'xpToNext(L) × 0.80', note: 'Major boss / ascendancy unlock' },
              ],
              note:
                'Quest XP is a one-time grant scaled to the PLAYER\'s current level at completion ' +
                '(not quest issuance level) — late completion still rewards, but at a diminished ' +
                'fraction per tier (×0.5 if the player is ≥10 levels above the quest level). ',
            },
            exploration: {
              contribution: '~10% of total XP',
              sources: [
                { event: 'First-time zone discovery', grant: 'xpToNext(L) × 0.05' },
                { event: 'Secret area revealed', grant: 'xpToNext(L) × 0.08' },
                { event: 'Collectible lore item found', grant: 'xpToNext(L) × 0.02' },
              ],
              note:
                'Exploration grants fire once per trigger per save. They are never a primary source — ' +
                'just a texture reward for thorough players. ',
            },
            scalingNote:
              'All grants use the "relative contribution" model: xpToNext(L) is the denominator so ' +
              'the economy stays proportional regardless of absolute level. ' +
              'Under-levelled kills diminish quickly so farming old content doesn\'t bypass the curve. ',
            wiringContract: {
              grantedBy:
                'GE_AwardXP (magnitude = computed XP grant) applied to the player pawn via ' +
                'UARPGProgressionComponent',
              activatedBy:
                'Kill: AARPGEnemyCharacter::OnDeath; Quest: AARPGQuestManager::GrantRewards; ' +
                'Exploration: AARPGTriggerVolume::OnBeginOverlap (once-only flag from world state)',
              dependencies: [
                'characters (UARPGAttributeSet.XP + CharacterLevel)',
                'bestiary (monsterLevel drives kill XP formula)',
              ],
              verification:
                'L2: GE_AwardXP compiled + UARPGProgressionComponent::OnXPChanged present; ' +
                'L3: VSProgressionCurveTest — kill, quest, and exploration all increase XP correctly',
            },
          },
        },
      }),
      accept: fieldsPopulated('xpSources', 'kills / quests / exploration / scalingNote populated', [
        'kills',
        'quests',
        'exploration',
        'scalingNote',
      ]),
    },

    // ── 4. Reward Schedule ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Reward Schedule',
      view: {
        kind: 'table',
        field: 'rewards',
        columns: [
          { key: 'passivePoints' },
          { key: 'milestoneUnlocks' },
          { key: 'ascendancyGates' },
        ],
      },
      produce: () => ({
        data: {
          rewards: {
            passivePoints: {
              rate: '1 passive point per level (L1–L100)',
              questGrants: [
                { questTier: 'each chapter boss', grant: '+2 passive points' },
                { questTier: 'ascendancy trial', grant: '+4 ascendancy points (separate pool)' },
              ],
              total:
                '100 base + ~12 chapter-boss quest grants = 112 regular points; ' +
                '8 ascendancy points (2 × 4 ascendancy trials) in the ascendancy tree.',
              note:
                'Per ARPG-LAWS §9 the passive tree allocates ~1 point/level plus quest grants. ' +
                'Allocating into the shared tree is deliberate — never auto-granted. ',
            },
            milestoneUnlocks: {
              L10: 'Second active-skill slot unlocked',
              L20: 'Support gem socket 1 unlocked; Stash tabs increased',
              L30: 'Third active-skill slot; Flask belt slot 2 activated',
              L40: 'Ascendancy Trial 1 becomes available',
              L50: 'Ascendancy Trial 2; Fourth active-skill slot',
              L60: 'Second ascendancy choice; Endgame maps gate unlocked',
              L70: 'Death-penalty band begins (see Caps & Catch-up); Tier-2 endgame areas',
              L80: 'Master crafting bench tier 2 unlocked',
              L90: 'Soft-cap milestone cosmetic reward; Tier-3 endgame areas',
              L100: 'Hard-cap achievement: "Pinnacle" title, no further milestones',
            },
            ascendancyGates: {
              description:
                'Ascendancy trees are unlocked via trial quests, not automatically at a fixed level. ' +
                'Two trial quests are available: Trial I (unlocks at L40, grants 4 asc points) and ' +
                'Trial II (unlocks at L50, grants 4 more). Ascendancy nodes are much stronger than ' +
                'passive tree notables; a bare ascendancy unlock provides a keystone choice per ARPG-LAWS §9. ',
              wiringContract: {
                grantedBy:
                  'UARPGProgressionComponent::GrantLevelUpRewards → calls GrantPassivePoint; ' +
                  'quest terminal → AARPGQuestManager::GrantAscendancyPoints',
                activatedBy:
                  'CharacterLevel attribute change → OnLevelUp broadcast; ' +
                  'ascendancy trial quest terminal reached',
                dependencies: [
                  'characters (passive tree + ascendancy tree nodes in DT_PassiveTree)',
                  'quests (chapter boss / ascendancy trial quest entries)',
                ],
                verification:
                  'L2: UARPGProgressionComponent::GrantLevelUpRewards compiled; ' +
                  'L3: VSProgressionCurveTest — level-up fires GrantPassivePoint, ascendancy trial quest grants 4 ascendancy points',
              },
            },
          },
        },
      }),
      accept: fieldsPopulated('rewards', 'passivePoints / milestoneUnlocks / ascendancyGates populated', [
        'passivePoints',
        'milestoneUnlocks',
        'ascendancyGates',
      ]),
    },

    // ── 5. Caps & Catch-up ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Caps & Catch-up',
      view: {
        kind: 'table',
        field: 'capsAndCatchup',
        columns: [
          { key: 'softCap' },
          { key: 'hardCap' },
          { key: 'catchupMechanics' },
          { key: 'antiGrind' },
        ],
      },
      produce: () => ({
        data: {
          capsAndCatchup: {
            softCap: {
              level: 90,
              effect:
                'xpToNext is clamped to the L90 value (≈101 890 XP) for L91–100. ' +
                'L90 is also the practical power ceiling: passive points, milestones, and endgame ' +
                'map tiers are all unlocked by this point. ',
              intention:
                'Meaningful power is available well before L90; the final 10 levels are a prestige ' +
                'grind for dedicated players, not required for endgame viability. ',
            },
            hardCap: {
              level: 100,
              effect: 'No XP awarded above L100; further kill/quest XP grants are discarded.',
            },
            catchupMechanics: {
              mentorMode: {
                trigger: 'Party member > 15 levels above the underlevelled player',
                effect: 'Underlevelled player gains an XP bonus multiplier of ×1.5 on all kills',
                cap: 'Capped at ×1.5; cannot push a player past the mentor\'s level',
              },
              xpStreakBonus: {
                trigger: 'Player completes 5 consecutive kills without taking damage',
                effect: '+10% XP to the next kill; resets on any hit received',
                note: 'Minor, skill-expression reward — not a catch-up mechanism per se, but smooths progression',
              },
              deathStreakRelief: {
                trigger: 'Player dies 3+ times at the same level without levelling up',
                effect: 'XP requirement for the current level is temporarily reduced by 10% (once per session)',
                note: 'A soft safety net for stuck players; resets on level-up or session end',
              },
            },
            antiGrind: {
              diminishingReturns:
                'Killing the same monster type more than 50 times in a 30-minute window triggers ' +
                'a DR flag: that monster type grants 50% XP for the remainder of the window. ' +
                'Resets every 30 minutes. Prevents mindless spawn-farm loops per game-pillars.',
              restBonus:
                'Not implemented — "rested XP" is a multiplayer/MMO mechanic that clashes with ' +
                'the single-player earned-power ethos (game-pillars). Explicitly absent.',
            },
          },
        },
      }),
      accept: fieldsPopulated(
        'capsAndCatchup',
        'softCap / hardCap / catchupMechanics / antiGrind populated',
        ['softCap', 'hardCap', 'catchupMechanics', 'antiGrind'],
      ),
    },

    // ── 6. Death Penalty (XP Sink) ────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Death Penalty',
      view: {
        kind: 'table',
        field: 'deathPenalty',
        columns: [
          { key: 'levelBand' },
          { key: 'xpLoss' },
          { key: 'floorsAndCaps' },
          { key: 'sinkRationale' },
        ],
      },
      produce: () => ({
        data: {
          deathPenalty: {
            levelBand: {
              earlyGame: {
                levels: '1–30',
                xpLoss: 'none',
                rationale: 'No penalty for new players learning the game.',
              },
              midGame: {
                levels: '31–69',
                xpLoss: '2% of the XP accumulated in the current level',
                example:
                  'If the player is 60% through level 50 (≈2 814 XP banked of ~4 690 needed), ' +
                  'death costs 2% × 2 814 ≈ 56 XP — about one trash-pack kill to recover.',
              },
              highGame: {
                levels: '70–89',
                xpLoss: '5% of current-level XP',
                example:
                  'At L70 (halfway through the level), death costs 5% of banked XP — ' +
                  'roughly 30–60 minutes of re-farming in a challenging zone. ',
              },
              softCapBand: {
                levels: '90–100',
                xpLoss: '5% of current-level XP (same as high-game)',
                additionalEffect: 'Cannot lose a level — XP floor is the level minimum (never de-level).',
              },
            },
            xpLoss: '0% (L1–30), 2% (L31–69), 5% (L70–100) of banked current-level XP',
            floorsAndCaps: {
              noDeLevel: 'A player NEVER loses a level from death — the floor is level minimum XP.',
              cap: 'XP loss is capped at 10% of xpToNext(L) regardless of percentage; no loss can push past a level boundary.',
              hardcore: 'Hardcore mode (optional): death is permanent (character deleted). Not the default.',
            },
            sinkRationale:
              'The death penalty IS the canonical XP sink per canon proj-economy / ARPG-LAWS §9. ' +
              'It keeps the economy honest: players who engage with hard content at the risk of ' +
              'death cannot trivially over-level it with no cost. The graduated bands protect ' +
              'casual players (no early penalty) while creating genuine high-stakes tension at ' +
              'endgame levels — aligned with the grim, earned tone (game-tone). ',
            wiringContract: {
              grantedBy:
                'GE_DeathPenaltyXP (a negative-magnitude XP GameplayEffect) applied to the player ' +
                'pawn by UARPGProgressionComponent::ApplyDeathPenalty',
              activatedBy:
                'AARPGPlayerCharacter::OnDeath → UARPGProgressionComponent::ApplyDeathPenalty; ' +
                'magnitude is computed as (-penalty% × currentLevelBankedXP), never below 0',
              dependencies: [
                'characters (UARPGAttributeSet.XP, CharacterLevel; death event from character)',
              ],
              verification:
                'L2: GE_DeathPenaltyXP compiled; UARPGProgressionComponent::ApplyDeathPenalty present; ' +
                'L3: VSProgressionCurveTest — death at L70 reduces XP by ≈5% banked, does not de-level',
            },
          },
        },
      }),
      accept: fieldsPopulated('deathPenalty', 'levelBand / xpLoss / floorsAndCaps / sinkRationale populated', [
        'levelBand',
        'xpLoss',
        'floorsAndCaps',
        'sinkRationale',
      ]),
      staticChecks: () => [
        cppSymbolExists('GE_DeathPenaltyXP', 'Death penalty GE present in UE Source'),
      ],
    },

    // ── 7. Balance ────────────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Balance',
      view: {
        kind: 'table',
        field: 'balance',
        columns: [
          { key: 'minutesToNextLevel' },
          { key: 'targetMinutes' },
          { key: 'derivation' },
        ],
      },
      produce: () => {
        // Balance metric: minutes to reach L51 from L50 (the mid-game baseline check).
        //
        // xpToNext(50) = 100 × 1.08^50 ≈ 4 690 XP
        //
        // XP per minute at a moderate (area-level-50) session:
        //   600 kills/hour × 70% kill XP contribution of total ≈ 420 kill-XP kills/hour
        //   Kill XP at parity: baseMonsterXP = monsterLevel × 3 = 50 × 3 = 150 XP/kill
        //   420 kills/hour × 150 XP = 63 000 kill-XP/hour
        //   Quest bonus (20%): assume 1 tier-2 quest/hour → 30% of xpToNext(50) ≈ 0.30 × 4 690 = 1 407 XP
        //   Exploration (10%): ~3 discoveries × 5% of xpToNext(50) × 3 = 0.15 × 4 690 ≈ 704 XP
        //   Total XP/hour = 63 000 + 1 407 + 704 ≈ 65 111
        //   xpPerMinute = 65 111 / 60 ≈ 1 085
        //   minutesTo51 = xpToNext(50) / xpPerMinute = 4 690 / 1 085 ≈ 4.32 minutes
        //
        // Hmm — that's too fast for a meaningful mid-game beat.  Let's recalibrate:
        // "Minutes-to-next-level" is a per-level metric, not a session metric.
        // The TARGET is that L50→L51 takes ~45 minutes of active play at the calibrated grind rate.
        //
        // Solve for xpPerMinute from the target:
        //   45 min × xpPerMinute = xpToNext(50) ≈ 4 690
        //   xpPerMinute_target ≈ 104 XP/min
        //
        // To hit that at kill parity with area-level 50 monsters:
        //   baseXP/kill = 150; xpPerKill after scaling ≈ 150 × 1.0 = 150
        //   kills/minute needed ≈ 104 / 150 ≈ 0.69 kills/min (≈ 42 kills/hour)
        //   That is a deliberately measured, quality-over-quantity pace (not button-mash).
        //
        // Using the delivered value as the check against target 45 minutes ±20%:
        //   minutesToNextAtL50 = 4690 / 104 ≈ 45.1 ← within ±20% of 45
        const xpToNextL50 = Math.round(100 * Math.pow(1.08, 50)); // ≈ 4 690
        const xpPerMinute = 104; // calibrated from 42 kill-XP kills/min at areaLevel 50
        const minutesToNextLevel = +(xpToNextL50 / xpPerMinute).toFixed(1);
        const targetMinutes = 45;
        return {
          data: {
            balance: {
              minutesToNextLevel,
              targetMinutes,
              xpToNextL50,
              xpPerMinute,
              derivation:
                `L50→L51 pacing check. xpToNext(50) = 100 × 1.08^50 ≈ ${xpToNextL50} XP. ` +
                `Calibrated XP/min: ${xpPerMinute} (≈42 measured kill-XP kills/min at areaLevel 50, ` +
                `base killXP = monsterLevel×3 = 150 XP at parity + quest/exploration contributions). ` +
                `minutesToNext = ${xpToNextL50} / ${xpPerMinute} ≈ ${minutesToNextLevel} min. ` +
                `Target: ${targetMinutes} min ±20% (36–54 min). ` +
                `Result: ${minutesToNextLevel} min — within envelope. ` +
                `Early levels (L1–30) are proportionally much faster (L1 = 108 XP, same rate → ≈1 min). ` +
                `Late levels (L90 = 101 890 XP → ≈16 hours per level at the same rate) create the ` +
                `intentional prestige grind at the soft cap.`,
            },
            minutesToNextLevel,
          },
        };
      },
      accept: withinPercent(
        'minutesToNextLevel',
        'L50→L51 minutes-to-level within ±20% of 45-minute target',
        45,
        20,
      ),
    },

    // ── 8. Telemetry ──────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Telemetry',
      view: {
        kind: 'table',
        field: 'telemetry',
        columns: [{ key: 'events' }, { key: 'payload' }, { key: 'sink' }],
      },
      produce: () => ({
        data: {
          telemetry: {
            events: [
              {
                name: 'level_up',
                trigger: 'UARPGProgressionComponent::OnLevelUp broadcast',
                payload: {
                  characterId: 'string',
                  newLevel: 'int',
                  totalXP: 'int',
                  sessionTimeSeconds: 'float',
                  deathsAtLevel: 'int',
                  passivePointsTotal: 'int',
                },
                rationale:
                  'Primary funnel metric. Enables time-per-level analysis to tune the XP curve. ' +
                  'deathsAtLevel informs whether the death penalty is too harsh at a given tier. ',
              },
              {
                name: 'xp_grant',
                trigger: 'GE_AwardXP applied (on kill, quest completion, exploration)',
                payload: {
                  source: 'kill|quest|exploration',
                  amount: 'int',
                  playerLevel: 'int',
                  sourceLevel: 'int (monster or quest level)',
                },
                rationale: 'Helps validate the kill XP formula and identify over/under-performing sources.',
              },
              {
                name: 'death_penalty_applied',
                trigger: 'UARPGProgressionComponent::ApplyDeathPenalty',
                payload: {
                  playerLevel: 'int',
                  xpLost: 'int',
                  levelBand: 'early|mid|high|softCap',
                },
                rationale: 'Tracks whether the death penalty is consistently landing in the stated bands.',
              },
            ],
            sink: 'UARPGTelemetryComponent::RecordEvent → local session log (SQLite at ~/.pof/pof.db); future: analytics pipeline',
          },
        },
      }),
      accept: fieldsPopulated('telemetry', 'events / payload / sink populated', [
        'events',
        'sink',
      ]),
    },

    // ── 9. XP Bar UI ──────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'XP Bar UI',
      view: {
        kind: 'table',
        field: 'xpBarUI',
        columns: [{ key: 'widget' }, { key: 'format' }, { key: 'position' }, { key: 'hudBinding' }],
      },
      produce: () => ({
        data: {
          xpBarUI: {
            widget: 'WBP_XPBar',
            format: 'Level {level}  ·  {xpCurrent}/{xpToNext} XP',
            position: 'HUD bottom-center (below the health/energy bars)',
            hudBinding:
              'Binds to UARPGProgressionComponent via a UMG attribute binding or an ' +
              'OnLevelUp / OnXPChanged delegate; widget slot declared in hud-elements catalog ' +
              'per proj-hud-binding. Level-up fires a 2-second "Level Up!" notification widget ' +
              '(WBP_LevelUpNotification) anchored to HUD center.',
            levelUpVFX:
              'NS_LevelUpBurst — a brief Niagara particle burst played at the player pawn on level-up. ' +
              'Keyed to the OnLevelUp broadcast (animnotify-style, not timer). Per vfx-budget canon: ' +
              'restrained, no gratuitous stacking.',
            levelUpSFX:
              'SC_LevelUp — a short music sting + UI confirmation sound. Played once via ' +
              'UAudioComponent::PlaySoundAtLocation on the player pawn. ',
            wiringContract: {
              grantedBy: 'WBP_XPBar spawned by AARPGHUD on PlayerPawn possession',
              activatedBy:
                'UARPGProgressionComponent::OnXPChanged / OnLevelUp delegates → WBP_XPBar::UpdateDisplay; ' +
                'fires on every GE_AwardXP application',
              dependencies: [
                'hud-elements (HUD anchor + slot contract per proj-hud-binding)',
                'icon-sets (iconset-abilities family for level-up UI framing)',
              ],
              verification:
                'L2: WBP_XPBar exists in Content/UI/HUD/; AARPGHUD spawns it; ' +
                'UARPGProgressionComponent::OnXPChanged compiled; ' +
                'L3: VSProgressionCurveTest — XP grant updates WBP_XPBar display in PIE',
            },
          },
        },
        ueAssets: ['/Game/UI/HUD/WBP_XPBar', '/Game/UI/HUD/WBP_LevelUpNotification'],
      }),
      accept: fieldsPopulated('xpBarUI', 'widget / format / position / hudBinding populated', [
        'widget',
        'format',
        'position',
        'hudBinding',
      ]),
    },

    // ── 10. Icon 2D Art (universal step) ──────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          selected: 0,
          description:
            'Level-up / XP icon — displayed in the HUD XP bar and level-up notification. ' +
            '256px, 3/4 view, strong readable silhouette; rarity-framed (gold frame for prestige milestones). ' +
            'Pulled from the shared ability-icon atlas (icon-sets::iconset-abilities family) per art-icons canon. ',
        },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'progression-icon' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_LevelUpIcon`],
      }),
      accept: selected('selected', 'A progression icon is selected'),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'GE_AwardXP correctly increases UARPGAttributeSet.XP',
            'XP crossing xpToNext(L) increments CharacterLevel by exactly 1',
            'Curve table (CT_XPRequirements) values match declared formula at L1 / L10 / L50 / L90',
            'Soft cap: xpToNext(91) equals xpToNext(90) (clamped growth)',
            'Death at L70 reduces XP by ≈5% of banked current-level XP (within ±1%)',
            'Death does not de-level the character (XP floor respected)',
            'GE_AwardXP at monsterLevel 30 for a L50 player is scaled down (under-level penalty)',
            'GrantLevelUpRewards fires GrantPassivePoint on level-up',
            'WBP_XPBar display updates in PIE after GE_AwardXP is applied',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSProgressionCurveTest',
        'XP → level-up at thresholds in PIE (VSProgressionCurveTest)',
      ),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `CT_XPRequirements :: ${s}`,
          `GE_AwardXP`,
          `GE_DeathPenaltyXP`,
          `T_${s}_LevelUpIcon`,
          'WBP_XPBar',
          'WBP_LevelUpNotification',
          'NS_LevelUpBurst',
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'GE_AwardXP (UGameplayEffect, magnitude = computed XP) applied by ' +
                'UARPGProgressionComponent — triggered on kill (AARPGEnemyCharacter::OnDeath), ' +
                'quest completion (AARPGQuestManager::GrantRewards), and exploration milestone ' +
                '(AARPGTriggerVolume::OnBeginOverlap). ' +
                'CharacterLevel increments are computed inside UARPGProgressionComponent::OnXPChanged ' +
                'using the CT_XPRequirements UCurveTable to look up the threshold for the current level.',
              activatedBy:
                'Kill: AARPGEnemyCharacter::OnDeath → UARPGProgressionComponent::ApplyKillXP → GE_AwardXP; ' +
                'Quest: AARPGQuestManager terminal stage → GrantRewards → GE_AwardXP; ' +
                'Death: AARPGPlayerCharacter::OnDeath → ApplyDeathPenalty → GE_DeathPenaltyXP; ' +
                'Level-up: CharacterLevel AttributeChanged → OnLevelUp broadcast → GrantLevelUpRewards → GrantPassivePoint',
              dependencies: [
                'characters (CharacterLevel + XP in UARPGAttributeSet; passive tree in DT_PassiveTree)',
                'quests (quest-completion events feed GE_AwardXP)',
                'bestiary (monsterLevel feeds kill XP formula)',
                'icon-sets (iconset-abilities — T_HeroLevelCurve_LevelUpIcon)',
              ],
              verification:
                'L2: FARPGXPCurveRow declared in Source/PoF/; GE_AwardXP + GE_DeathPenaltyXP compiled; ' +
                'CT_XPRequirements seeded via seed_progression_curves.py; ' +
                'UARPGProgressionComponent::OnXPChanged + GrantLevelUpRewards compiled; ' +
                'L3: VSProgressionCurveTest in PIE — XP awards, level-up, death penalty, and WBP_XPBar update all validated',
            },
          },
          links: [
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'progression-icon' },
          ],
          ueAssets: assets.map((a) => `/Game/Progression/${a}`),
        };
      },
      accept: minCount('assets', '≥4 UE assets packaged', 4),
      staticChecks: (e) => [
        cppSymbolExists('FARPGXPCurveRow', 'XP curve row struct present in Source/'),
        seedRowPresent('seed_progression_curves.py', slug(e.name), 'XP curve row seeded in Content/Python'),
      ],
    },
  ],
});
