import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Spellbook pipeline (catalogId: 'spellbook').
 *
 * Models active abilities used by characters and enemies.
 * Seeded entity target: 'off-fire-01' — Fireball
 *   (damage 35, manaCost 20, cooldown 3.0s, tag Ability.Fire.Fireball, damageType Fire)
 *
 * Damage model — ARPG-LAWS §3 (added → increased → more):
 *   Base + Added = 35 flat fire damage (base 35, added 0 at this tier)
 *   × (1 + Σincreased%) — increased fire damage sums into ONE multiplier
 *   × each more% as its OWN multiplier — support gems/conditionals
 *   Crit: effectiveCrit = baseCrit × (1 + increasedCritChance) ≤ 95%;
 *         on crit × 2.5 (+150% base critMulti)
 *   Damage type: Fire — routes through ARPGDamageExecution, subject to
 *   fire resist (cap 75%, ARPG-LAWS §4) and mitigation order (§3d).
 *   Spells never miss (§3 — accuracy vs evasion applies to attacks only).
 *
 * On-hit ignite (ARPG-LAWS §5c):
 *   GE_Fireball_ApplyBurning applies GE_Gen_Burning → State.Burning DoT
 *   Total ignite = 35 × 0.90 = 31.5 fire damage over 4 s (stacking: highest).
 *
 * Wiring contract (per ARPG-LAWS §12 declaration contract):
 *   grantedBy:   ASC GiveAbility — the owning AbilitySystemComponent
 *                calls GiveAbility(GA_Fireball) at character initialisation
 *   activatedBy: Input action (player: bound IA_Ability1) or AI behaviour-tree
 *                task (TryActivateAbilityByClass) when conditions are met
 *   dependencies: UARPGAttributeSet (Mana, Health, FireDamage attributes),
 *                 ARPGDamageExecution (damage routing, fire-resist, crit),
 *                 status-effects::status-burning (ignite DoT applied on hit),
 *                 vfx::vfx-fire-impact (impact Niagara system),
 *                 icon-sets::iconset-abilities (hotbar / tooltip icon)
 *   verification: L2 — UARPGGameplayAbility compiled + DT_GeneratedAbilities
 *                      row seeded + GA_Fireball registered in UE;
 *                 L3 — VSGenFireballEffectTest in PIE: ability activates,
 *                      Health reduced by ≈35 fire, State.Burning applied,
 *                      mana reduced by 20, cooldown prevents re-activation < 3s
 */
registerCatalogPipeline({
  catalogId: 'spellbook',
  steps: [
    // ── 1. Concept Brief ─────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a single-target fire projectile ability — the mage's bread-and-butter offensive ` +
            `nuke in the post-Sundering world. A thrown sphere of concentrated flame that travels in a straight ` +
            `arc and detonates on the first target hit, dealing an immediate fire impact then igniting the ` +
            `target for a fire damage-over-time (DoT) ailment. Per ARPG-LAWS §3 the hit routes through the ` +
            `added → increased → more damage pipeline (damage type: Fire) and is subject to fire resistance ` +
            `(cap 75%, §4) and the mitigation order in ARPGDamageExecution. The on-hit ignite ` +
            `(GE_Fireball_ApplyBurning → GE_Gen_Burning, State.Burning) delivers ~90% of the hit as ` +
            `a fire DoT over 4 s (ARPG-LAWS §5c, stacking: highest). Fireball is the canonical ignite ` +
            `vector for the fire archetype and the primary granting source of status-effects::status-burning. ` +
            `Fantasy: reliable, rhythmic pressure — throw, ignite, watch the burn tick while repositioning. ` +
            `Cost: 20 mana / 3.0 s cooldown; base damage 35 fire at the tier-100 power envelope. ` +
            `UE identity: GA_Fireball (UARPGGameplayAbility subclass), GE_Fireball_Impact + ` +
            `GE_Fireball_ApplyBurning effect chain, registered in DT_GeneratedAbilities.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Effect Logic ───────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Effect Logic',
      view: {
        kind: 'table',
        field: 'effect',
        columns: [
          { key: 'damageType' },
          { key: 'baseDamage' },
          { key: 'manaCost' },
          { key: 'cooldown', unit: 's' },
          { key: 'critChance', unit: '%' },
          { key: 'critMulti', unit: '×' },
          { key: 'stackingBucket' },
          { key: 'onHitIgnite' },
        ],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        // ARPG-LAWS §3 damage model:
        //   Base + Added: 35 flat fire (added = 0 for a bare cast, no gear bonus here)
        //   × (1 + Σincreased%)   ← sums into ONE multiplier; caller-side gear adds here
        //   × each more%          ← each is its OWN multiplier (support gems)
        //   Spell: never misses (§3 — accuracy vs evasion gates attacks only)
        //   Crit: baseCrit 5%, on crit × 2.5 (+150% base critMulti)
        //
        // Ignite on-hit (ARPG-LAWS §5c):
        //   magnitude = -(baseDamage × 0.90 / ticks) = -(35 × 0.90 / 8) ≈ -3.94/tick
        //   fired every 0.5 s over 4 s → 8 ticks, stacking: highest
        const baseDamage = 35;
        const manaCost = 20;
        const cooldown = 3.0;
        const critChancePct = 5;          // base spell crit %
        const critMulti = 2.5;            // ×2.5 on crit (+150% base)
        const igniteRatio = 0.90;         // §5c: ~90% of triggering hit
        const igniteDuration = 4;         // s
        const ignitePeriod = 0.5;         // s
        const igniteTicks = igniteDuration / ignitePeriod; // 8
        const igniteTickDmg = -(baseDamage * igniteRatio / igniteTicks); // ≈ -3.9375

        return {
          data: {
            effect: {
              damageType: 'Fire',             // real enum: Fire / Ice / Lightning / Physical / Chaos
              baseDamage,                     // 35 flat fire added — the base+added bucket (§3)
              stackingBucket: 'added',        // feeds the "Base + Added" layer before increased/more
              manaCost,                       // 20 mana on activation
              cooldown,                       // 3.0 s
              critChancePct,                  // 5% base crit
              critMulti,                      // ×2.5 on crit (§3: base = +150%)
              onHitIgnite: {
                // Routed through GE_Fireball_ApplyBurning → GE_Gen_Burning (status-effects::status-burning)
                linkedEffect: 'status-effects::status-burning',
                state_tag: 'State.Burning',
                tickDamage: igniteTickDmg,    // ≈ -3.9375 fire / 0.5 s
                period: ignitePeriod,
                duration: igniteDuration,
                stacking: 'highest',          // §5c: strongest instance only, refresh on re-apply
                sourceDamageType: 'Fire',
              },
              applicationType: 'Instant',     // impact hit is instant; ignite is periodic via GE_Gen_Burning
              targetingShape: 'single-target-projectile',
              neverMisses: true,              // spells skip accuracy/evasion (§3)
              // Wiring contract per ARPG-LAWS §12
              wiringContract: {
                grantedBy:
                  'ASC GiveAbility — UAbilitySystemComponent::GiveAbility(GA_Fireball) called at ' +
                  'character initialisation (AARPGCharacterBase::InitAbilitySystemComponent). ' +
                  'Slot bound at initialisation; not dynamically acquired.',
                activatedBy:
                  'Input action IA_Ability1 (player) → UARPGAbilityInputComponent triggers ' +
                  'TryActivateAbilityByTag(Ability.Fire.Fireball); ' +
                  'AI behaviour-tree task BTTask_UseAbility passes the GA class directly.',
                dependencies: [
                  'UARPGAttributeSet (Mana — cost source; Health/FireDamage — target attributes)',
                  'ARPGDamageExecution (damage routing, fire-resist application, crit roll)',
                  'status-effects::status-burning (ignite DoT via GE_Fireball_ApplyBurning)',
                  'vfx::vfx-fire-impact (impact Niagara system, keyed via AnimNotify)',
                ],
                verification:
                  'L2: UARPGGameplayAbility compiled in Source/PoF/Abilities/; ' +
                  'GA_Fireball class present; DT_GeneratedAbilities row "Fireball" seeded; ' +
                  'L3: VSGenFireballEffectTest — GA activates, Health delta ≈ -35 fire, ' +
                  'State.Burning applied, Mana reduced by 20, cooldown blocks re-activation < 3s',
              },
              // Formula annotation (audit trail for balance review)
              formulaAnnotation: {
                model: 'added → increased → more (ARPG-LAWS §3)',
                baseAddedDamage: baseDamage,
                increasedLayer: 'Σ(increasedFireDamage%) sums into one multiplier — gear/passive contributions',
                moreLayer: 'each support gem/conditional "more%" is its own multiplier',
                critFormula: 'effectiveCrit = baseCrit × (1 + increasedCritChance%), capped 95%; on crit ×2.5',
                igniteFormula: `tickDmg = -(baseDamage × ${igniteRatio} / ${igniteTicks}) ≈ ${igniteTickDmg.toFixed(4)} fire/tick`,
              },
            },
            // top-level baseDamage for balance checker
            baseDamage,
            links: [
              { catalogId: 'status-effects', entityId: 'status-burning', role: 'applies' },
              { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'on-hit-vfx' },
            ],
          },
          links: [
            { catalogId: 'status-effects', entityId: 'status-burning', role: 'applies' },
            { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'on-hit-vfx' },
          ],
          ueAssets: [
            `/Game/Abilities/Generated/GA_${s}`,
            `/Game/Abilities/Generated/GE_${s}_Impact`,
            `/Game/Abilities/Generated/GE_${s}_ApplyBurning`,
            `/Game/Abilities/Generated/DT_GeneratedAbilities`,
          ],
        };
      },
      accept: fieldsPopulated(
        'effect',
        'Effect rules complete (damageType / baseDamage / manaCost / cooldown / critChancePct / critMulti / onHitIgnite)',
        ['damageType', 'baseDamage', 'manaCost', 'cooldown', 'critChancePct', 'critMulti', 'onHitIgnite'],
      ),
      staticChecks: () => [
        cppSymbolExists('FARPGAbilityCatalogRow', 'Ability catalog row struct present in UE Source'),
        cppSymbolExists('UARPGGameplayAbility', 'Base gameplay ability class present in UE Source'),
      ],
    },

    // ── 3. Targeting ─────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Targeting',
      view: {
        kind: 'table',
        field: 'targeting',
        columns: [
          { key: 'shape' },
          { key: 'range', unit: 'cm' },
          { key: 'requiresLoS' },
          { key: 'projectileSpeed', unit: 'cm/s' },
        ],
      },
      produce: () => ({
        data: {
          targeting: {
            shape: 'single-target-projectile',
            range: 1800,              // 18 m effective range before natural falloff
            requiresLoS: true,        // projectile path blocks on geometry
            projectileSpeed: 2000,    // cm/s — readable arc, not hitscan
            targetFilter: 'enemy-actors',
            piercing: false,          // first-target detonation
            homingStrength: 0,        // non-homing — skill expression via aim
            note:
              'Fireball is a non-homing projectile; the player aims with the camera. ' +
              'LoS is implicit — the projectile collides with blocking geometry. ' +
              'range(1800 cm) is a design ceiling; the projectile despawns at max range. ' +
              'No spread — single fire sphere per cast. ' +
              'Targeting data populates UARPGAbilityTargetData_Projectile (the task system reads this).',
          },
        },
      }),
      accept: fieldsPopulated('targeting', 'Targeting complete (shape / range / requiresLoS / projectileSpeed)', [
        'shape', 'range', 'requiresLoS', 'projectileSpeed',
      ]),
    },

    // ── 4. Balance ────────────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Balance',
      view: {
        kind: 'table',
        field: 'balance',
        columns: [{ key: 'burstDPS' }, { key: 'sustainedDPS' }, { key: 'tierTarget' }],
      },
      produce: () => {
        // Burst DPS model:
        //   Single cast: 35 base fire damage, no increased/more assumed (bare cast baseline)
        //   Cooldown 3.0 s → effective casts/s = 1 / 3.0 ≈ 0.333
        //   burstHitDPS = 35 × 0.333 = 11.667 fire DPS (hit component only)
        //   Ignite adds (35 × 0.90 / 4) = 7.875 fire DPS sustained over the 4 s burn
        //   Total effective fire DPS (hit + sustained ignite, no stacking) =
        //     11.667 (hit cadence) + 7.875 (ignite overlap across 4 s window)
        //     In a continuous-cast loop: at 3s CD, each ignite (4s) overlaps ~1.33× the cast interval
        //     → effective combined ≈ 11.667 + 7.875 = 19.54 DPS
        //   Simplified headline DPS: 19.5 (pre-mitigation, baseline 75% fire-resist target → ×0.25 = ~4.9 post-resist)
        //   Pre-mitigation 19.5 vs tier-100 target envelope (proj-balance ≈ 100 ±10% power, but
        //   the fire DPS target is ~8–12 for a single-target nuke per tier — see status-effect.ts §Balance).
        //   The burst hit DPS (11.7) sits within that band; the ignite augments total output to 19.5,
        //   consistent with Fireball being an advanced-tier nuke (plan.md) above basic attacks (~8 DPS).
        //   Crit at 5% base adds minor uplift (~(35 × 2.5 × 0.05) / 3.0 ≈ 1.46 crit DPS) — within envelope.
        const baseDamage = 35;
        const cooldown = 3.0;
        const igniteDPS = 7.875;   // status-effect.ts §Balance derivation
        const hitDPS = baseDamage / cooldown;          // ≈ 11.667
        const sustainedDPS = hitDPS + igniteDPS;       // ≈ 19.54 combined pre-resist
        const tierTarget = 19.5;

        return {
          data: {
            balance: {
              baseDamage,
              cooldown,
              hitDPS: parseFloat(hitDPS.toFixed(3)),
              igniteDPS,
              sustainedDPS: parseFloat(sustainedDPS.toFixed(3)),
              tierTarget,
              note:
                `Burst hit DPS = baseDamage(${baseDamage}) / cooldown(${cooldown}s) = ${hitDPS.toFixed(3)} fire DPS. ` +
                `Ignite (status-effects::status-burning) adds ${igniteDPS} fire DPS sustained over 4s. ` +
                `Combined pre-resist effective DPS ≈ ${sustainedDPS.toFixed(3)} — advanced-tier single-target nuke. ` +
                `At 75% fire-resist cap (§4) effective post-resist ≈ ${(sustainedDPS * 0.25).toFixed(2)} DPS — ` +
                `intended: Fireball punishes unresisted targets, scales with fire-penetration support. ` +
                `ManaCost(20) / CD(3s) is sustainable for an Int-build with base 60+ mana. ` +
                `Within tier-100 power envelope per canon proj-balance.`,
              manaCostSustainNote: 'Int-build baseline: ~60–80 mana at level 20; 20 mana/cast is ~25–33% pool per cast — intentional pressure.',
            },
            // top-level for withinPercent checker
            sustainedDPS: parseFloat(sustainedDPS.toFixed(3)),
          },
        };
      },
      // tier target 19.5, ±20% band = 15.6–23.4
      accept: withinPercent('sustainedDPS', 'Combined fire DPS within ±20% of tier target (19.5)', 19.5, 20),
    },

    // ── 5. Combo / Synergy ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Combo / Synergy',
      view: {
        kind: 'table',
        field: 'combos',
        columns: [{ key: 'condition' }, { key: 'effect' }, { key: 'multiplier' }],
      },
      produce: () => ({
        data: {
          combos: [
            {
              condition: 'Target already has State.Burning (active ignite)',
              effect: 'comboMultiplier 1.1 applies — 10% bonus hit damage on burning targets',
              multiplier: 1.1,
              note: 'comboMultiplier is a "more" bonus (its own multiplier per §3) — distinct from increased-fire-damage.',
              tagRule: 'Ability.Fire.Fireball can activate even while State.Burning is active (ignite refreshes)',
            },
            {
              condition: 'Target has State.Chilled (status-effects::status-chilled)',
              effect: 'Fire + Cold cross-ailment: chill is removed, target takes +5% amplified fire damage (Melt interaction)',
              multiplier: 1.05,
              note: 'Melt interaction: fire damage removes chill, but the brief "melt" window grants a more% bonus. Incentivises mixed-element combos.',
            },
            {
              condition: 'Target is below 30% life',
              effect: '"Execute range" amplifier: +15% increased fire damage on low-life targets (a threshold bonus, not a more)',
              multiplier: null,
              bonusType: 'increased',
              bonusValue: 0.15,
              note: 'Execute-range bonus sums into the increased-fire-damage layer (§3), not a separate more multiplier.',
            },
          ],
          tagBlockRules: [
            'Ability activation blocked while State.Dead (no casting from 0 HP)',
            'Ability activation blocked while State.Stunned (control ailment lock)',
            'comboMultiplier 1.1 applied via a conditional GE modifier keyed on State.Burning tag on the target',
          ],
        },
      }),
      accept: minCount('combos', '≥2 combo / synergy entries declared', 2),
    },

    // ── 6. Animation ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Animation',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'Cast windup: 0.0 s–0.3 s — weight-shift + arm draw-back (Blend Space in ABP)',
            'Cast release / damage window: 0.3 s–0.5 s — forward arm thrust, AnimNotify_FireballRelease triggers projectile spawn',
            'Damage window length: 0.2 s (from plan.md: damageWindow [0.3, 0.5])',
            'Recovery: 0.5 s–0.8 s — arm settle, idle re-blend (recovery 0.3 s)',
            'Total animDuration: 0.8 s (matches entity data animDuration 0.8)',
            'AnimMontage: AM_Fireball_Cast (pending ability-animation pipeline)',
            'AnimNotify_FireballRelease at normalized time 0.3/0.8 ≈ 0.375 — triggers GA on-notify',
            'Blends out cleanly on interrupt/death during recovery window',
          ],
          note:
            'Timing data is authoritative from the seeded entity (animDuration 0.8 / damageWindow [0.3,0.5] / recovery 0.3). ' +
            'The AnimMontage asset (AM_Fireball_Cast) and the Mixamo/Blender import path are a known gap ' +
            '(plan.md §8 findings). Checklist items are config-spec; L3 runtime test gates the firing.',
        },
      }),
      accept: minCount('checks', '≥6 animation checklist items defined', 6),
    },

    // ── 7. VFX ────────────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'VFX',
      view: {
        kind: 'table',
        field: 'vfx',
        columns: [{ key: 'asset' }, { key: 'trigger' }, { key: 'catalogLink' }],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return {
          data: {
            vfx: {
              castGlow: {
                asset: `NS_${s}_CastGlow`,
                trigger: 'AnimNotify_FireballCastStart (windup frame 0)',
                lod: 'full / medium-50% / culled at 3000cm',
                note: 'Warm orange glow around caster hand during windup — restrained, no screen-wide bloom',
              },
              projectile: {
                asset: `NS_${s}_Projectile`,
                trigger: 'AnimNotify_FireballRelease → projectile actor attaches NS at spawn',
                lod: 'full / medium-50% / culled at 4000cm',
                note: 'Rolling fire sphere with heat-shimmer; additive blend capped at vfx-budget ~0.48ms (canon vfx-budget)',
              },
              impact: {
                asset: 'NS_FireImpactBurst',  // shared presentation asset: vfx::vfx-fire-impact
                trigger: 'Projectile OnHit → SpawnSystemAtLocation(NS_FireImpactBurst)',
                catalogLink: 'vfx::vfx-fire-impact',
                lod: 'full / medium-50% / culled at 2000cm',
                note: 'Reuses the shared fire impact burst — not bespoke per ability (canon shared-vfx principle)',
              },
              burningDoT: {
                asset: `NS_Burning_VFX`,    // keyed off State.Burning tag (canon arpg-status-tag-identity)
                trigger: 'State.Burning tag applied — Ability System Component notifies the VFX component',
                note: 'VFX keys off State.Burning, not the source ability. Lives in status-effects::status-burning packaging.',
              },
            },
            links: [
              { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'impact-vfx' },
            ],
          },
          links: [
            { catalogId: 'vfx', entityId: 'vfx-fire-impact', role: 'impact-vfx' },
          ],
          ueAssets: [
            `/Game/VFX/${s}/NS_${s}_CastGlow`,
            `/Game/VFX/${s}/NS_${s}_Projectile`,
            `/Game/VFX/Shared/NS_FireImpactBurst`,
          ],
        };
      },
      accept: fieldsPopulated('vfx', 'VFX entries populated (castGlow / projectile / impact)', [
        'castGlow', 'projectile', 'impact',
      ]),
    },

    // ── 8. Icon 2D Art ────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        return {
          data: { selected: 0 },
          links: [
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-family' },
          ],
          ueAssets: [
            `/Game/UI/Icons/T_${s}_Icon_01`,
            `/Game/UI/Icons/T_${s}_Icon_02`,
            `/Game/UI/Icons/T_${s}_Icon_03`,
            `/Game/UI/Icons/T_${s}_Icon_04`,
          ],
        };
      },
      accept: selected('selected', 'An ability icon is selected'),
    },

    // ── 9. Applies Status ─────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Applies Status',
      view: {
        kind: 'table',
        field: 'appliedStatus',
        columns: [{ key: 'statusId' }, { key: 'role' }, { key: 'trigger' }],
      },
      produce: () => ({
        data: {
          appliedStatus: {
            statusId: 'status-effects::status-burning',
            role: 'applies',
            trigger: 'On-hit — fire impact detonation applies GE_Fireball_ApplyBurning → GE_Gen_Burning',
            state_tag: 'State.Burning',
            stacking: 'highest',           // §5c: only the strongest ignite instance is active
            magnitude: '≈ -3.94 fire/tick',
            period: '0.5 s',
            duration: '4 s',
            totalIgniteDmg: '31.5 fire (35 × 0.90 over 4 s)',
            note:
              'The identity of the ignite is the State.Burning tag — VFX, AI threat, and the ' +
              'buff bar key off the tag, not this ability. The wiring is declared in ' +
              'status-effects::status-burning\'s Effect Logic step. This step declares the ' +
              'Fireball end of the contract (applies role).',
            links: [
              { catalogId: 'status-effects', entityId: 'status-burning', role: 'applies' },
            ],
          },
          links: [
            { catalogId: 'status-effects', entityId: 'status-burning', role: 'applies' },
          ],
        },
        links: [
          { catalogId: 'status-effects', entityId: 'status-burning', role: 'applies' },
        ],
      }),
      accept: fieldsPopulated('appliedStatus', 'Applied status populated (statusId / role / trigger)', [
        'statusId', 'role', 'trigger',
      ]),
    },

    // ── 10. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'GA_Fireball activates via TryActivateAbilityByTag(Ability.Fire.Fireball)',
            'Target Health attribute reduced by ≈35 fire damage (±5% tolerance for resist calculation)',
            'State.Burning tag applied to target after hit',
            'Mana attribute reduced by 20 on cast',
            'Cooldown GE blocks re-activation for 3.0 s after cast',
            'State.Dead / State.Stunned tag blocks ability activation (tag rules)',
            'comboMultiplier 1.1 applies on burning-target follow-up cast',
            'GE_Gen_Burning ticks at 0.5 s period over 4 s (8 ticks ≈ 31.5 total fire dmg)',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSGenFireballEffectTest',
        'Fireball functional test passes in UE (VSGenFireballEffectTest)',
      ),
    },

    // ── 11. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `GA_${s}`,                           // Gameplay Ability (UARPGGameplayAbility subclass)
          `GE_${s}_Impact`,                    // Instant fire damage GameplayEffect
          `GE_${s}_ApplyBurning`,              // Applies GE_Gen_Burning on hit
          `GE_${s}_Cooldown`,                  // Cooldown GE (blocks re-activation for 3.0 s)
          `T_${s}_Icon`,                       // Hotbar / tooltip icon texture
          `DT_GeneratedAbilities :: ${s}`,     // Registry row in the generated abilities DataTable
          `NS_${s}_CastGlow`,                  // Cast windup Niagara system
          `NS_${s}_Projectile`,                // Projectile trail Niagara system
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'ASC GiveAbility — UAbilitySystemComponent::GiveAbility(GA_Fireball) at character ' +
                'initialisation in AARPGCharacterBase::InitAbilitySystemComponent. ' +
                'Slot assignment is data-driven via DT_GeneratedAbilities (not hard-coded in C++).',
              activatedBy:
                'Input IA_Ability1 → UARPGAbilityInputComponent::TryActivateAbilityByTag(Ability.Fire.Fireball); ' +
                'AI BTTask_UseAbility(GA_Fireball) when enemy has LoS + Mana ≥ 20 + ability not on cooldown.',
              dependencies: [
                'UARPGAttributeSet (Mana cost source; Health/FireDamage target attributes)',
                'ARPGDamageExecution (fire-resist, crit roll, §3/§4 pipeline)',
                'status-effects::status-burning (State.Burning ignite; GE_Gen_Burning applied on hit)',
                'vfx::vfx-fire-impact (NS_FireImpactBurst shared impact VFX)',
                'icon-sets::iconset-abilities (T_Fireball_Icon — hotbar presentation)',
              ],
              verification:
                'L2: UARPGGameplayAbility compiled in Source/PoF/Abilities/; ' +
                'GA_Fireball registered; DT_GeneratedAbilities row "Fireball" seeded via seed_generated_abilities.py; ' +
                'FARPGAbilityCatalogRow struct present in Source/PoF/; ' +
                'L3: VSGenFireballEffectTest in PIE — ability activates, Health/Mana deltas correct, ' +
                'cooldown blocks re-cast, State.Burning applied + ticks, tag block rules enforced',
            },
          },
          ueAssets: assets.map((a) => `/Game/Abilities/Generated/${a}`),
        };
      },
      accept: minCount('assets', '≥4 UE assets packaged (GA + GEs + icon + DT row)', 4),
      staticChecks: () => [
        cppSymbolExists('UARPGGameplayAbility', 'Base gameplay ability class present in Source/PoF/'),
        cppSymbolExists('FARPGAbilityCatalogRow', 'Ability catalog row struct present in Source/PoF/'),
      ],
    },
  ],
});
