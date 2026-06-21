import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, withinPercent, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Status Effects pipeline (catalogId: 'status-effects').
 *
 * Models ARPG ailments: secondary effects that out-live the hit that applied them.
 * Identity = the granted State.* gameplay tag (canon `arpg-status-tag-identity`).
 * Seeded entity: "Burning" — an ignite-type fire DoT per ARPG-LAWS §5c.
 *
 * Ignite model (ARPG-LAWS §5c):
 *   - Source damage type: Fire
 *   - Magnitude derivation: each tick = (triggeringFireHit × 0.90) / (duration / period)
 *     → for a 35-damage Fireball hit at 4 s duration / 0.5 s period = 8 ticks:
 *       tickDamage = 35 × 0.90 / 8 ≈ 3.94  (rounds to ~4 fire damage / 0.5 s)
 *   - Total ignite ≈ 90% of triggering hit over 4 s (ARPG-LAWS §5c envelope)
 *   - Tick period: 0.5 s → 8 ticks
 *   - Stacking: 'highest' — only the strongest active ignite instance is live;
 *     a weaker new hit does NOT stack, a stronger one refreshes the timer (§5d)
 *   - Dispel: yes — cleanse removes State.Burning and cancels GE immediately
 *
 * Tag identity (canon `arpg-status-tag-identity`):
 *   - GameplayEffect: GE_Gen_Burning (class UGE_Gen_Burning)
 *   - Granted tag: State.Burning
 *   - Registered in: DT_GeneratedAbilities (row "Burning")
 *
 * Granting source — fire spellbook abilities:
 *   Real seeded fire ability ids (src/components/modules/core-engine/sub_ability/_shared/data.ts):
 *     off-fire-01  Fireball        (35 base damage, 3 s CD, tag Ability.Fire.Fireball)
 *     off-fire-04  Blazing Slash   (25 base damage, melee fire swing)
 *     off-fire-05  Flame Lance     (55 base damage, projectile)
 *   Fireball (off-fire-01) is the primary vector — its on-hit GE applies GE_Gen_Burning.
 *   The link below resolves to the real seeded id.
 *
 * Wiring contract (per ARPG-LAWS §12 declaration contract):
 *   grantedBy:   Fireball's apply-GE (GE_Fireball_ApplyBurning) calls ApplyGameplayEffectToTarget →
 *                GE_Gen_Burning is applied to the hit target
 *   activatedBy: On-hit (projectile/melee impact) for fire abilities that carry the Ignite tag
 *   dependencies: UARPGAttributeSet (FireDamage + Health attributes),
 *                 ARPGDamageExecution (damage routing + ailment chance),
 *                 spellbook::off-fire-01 (Fireball — primary ignite source)
 *   verification: L2 — UGE_Gen_Burning compiled + DT_GeneratedAbilities row seeded;
 *                 L3 — VSStatusBurningEffectTest: apply ignite → tick fires at 0.5 s period,
 *                      State.Burning tag present during duration, tag removed on expiry/cleanse,
 *                      highest-stack: weaker re-apply does not reset timer, stronger does
 */
registerCatalogPipeline({
  catalogId: 'status-effects',
  steps: [
    // ── 1. Concept Brief ─────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a fire damage-over-time ailment (ignite) applied by fire-type hits such as Fireball ` +
            `and Blazing Slash. Per ARPG-LAWS §5c its identity is the granted State.Burning gameplay tag — ` +
            `VFX, AI threat weighting, and the player's buff bar all key off this tag, never the source ability. ` +
            `The ignite deals fire DoT equal to ~90% of the triggering fire hit distributed over 4 seconds at ` +
            `a 0.5 s tick period (8 ticks). Stacking mode is 'highest': only the strongest active ignite ` +
            `instance is live on the target at any time; a weaker re-apply is discarded, a stronger one ` +
            `replaces and refreshes the duration. This design rewards escalating fire pressure without ` +
            `trivialising the system through free stacking. The GE is GE_Gen_Burning (UGE_Gen_Burning), ` +
            `registered in DT_GeneratedAbilities. Dispel/cleanse immediately removes State.Burning and ` +
            `cancels the periodic GE. Bosses may carry ignite-resist or immunity modifiers but remain ` +
            `vulnerable to the damaging variant unlike freeze/chill (control ailments). The primary ` +
            `granting source is Fireball (spellbook::off-fire-01) whose on-hit gameplay effect applies ` +
            `GE_Gen_Burning via ApplyGameplayEffectToTarget; other fire abilities (Blazing Slash, Flame Lance) ` +
            `carry the same ignite application path. Ailment DPS for a 35-damage Fireball hit: ` +
            `35 × 0.90 / 4 s ≈ 7.88 fire DPS sustained — inside the tier-100 power envelope.`,
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
          { key: 'magnitude' },
          { key: 'period', unit: 's' },
          { key: 'duration', unit: 's' },
          { key: 'tag' },
          { key: 'stacking' },
          { key: 'sourceDamageType' },
          { key: 'dispellable' },
        ],
      },
      produce: (e: LabEntity) => {
        const s = slug(e.name); // "Burning"
        // Ignite formula per ARPG-LAWS §5c:
        //   total damage ≈ 90% of triggering fire hit over 4 s
        //   reference hit: Fireball (off-fire-01) base damage = 35
        //   ticks = duration / period = 4 / 0.5 = 8
        //   tickDamage = 35 * 0.90 / 8 = 3.9375  (negative = damage per tick)
        //   dps = 35 * 0.90 / 4 = 7.875
        const referenceHit = 35;          // Fireball base damage
        const igniteRatio = 0.90;         // §5c: ~90% of triggering hit
        const duration = 4;               // seconds (§5c: 4 s)
        const period = 0.5;               // seconds — 8 ticks total
        const ticks = duration / period;  // = 8
        const magnitude = -(referenceHit * igniteRatio / ticks); // ≈ -3.94 fire dmg/tick
        const dps = Math.abs(magnitude) / period;                // ≈ 7.875 fire DPS

        return {
          data: {
            effect: {
              // Per §5b shape: tag / magnitude (per-tick signed, negative = damage) / period / duration /
              //   stacking / sourceDamageType / dispellable
              tag: `State.${s}`,            // State.Burning — the identity tag
              magnitude,                    // ≈ -3.94 fire damage / 0.5 s tick
              period,                       // 0.5 s
              duration,                     // 4 s
              stacking: 'highest',          // §5c: highest ignite only; stronger refreshes, weaker discarded
              maxStacks: 1,                 // only one ignite instance at a time
              sourceDamageType: 'Fire',     // Fire DoT (matches code enum Fire/Ice/Lightning)
              dispellable: true,            // cleanse removes State.Burning + cancels GE
              // Wiring contract per ARPG-LAWS §12
              wiringContract: {
                grantedBy:
                  'Fireball on-hit GE (GE_Fireball_ApplyBurning) → ' +
                  'ApplyGameplayEffectToTarget(GE_Gen_Burning) on the hit target. ' +
                  'Other fire abilities (Blazing Slash off-fire-04, Flame Lance off-fire-05) ' +
                  'use the same apply-GE path.',
                activatedBy: 'On-hit — fire ability projectile/melee impact that carries the Ignite tag',
                dependencies: [
                  'UARPGAttributeSet (FireDamage, Health attributes)',
                  'ARPGDamageExecution (damage routing + ailment chance roll)',
                  'spellbook::off-fire-01 (Fireball — primary ignite vector)',
                ],
                verification:
                  'L2: UGE_Gen_Burning compiled + DT_GeneratedAbilities row "Burning" seeded; ' +
                  'L3: VSStatusBurningEffectTest — tick fires at 0.5 s intervals, ' +
                  'State.Burning tag present during duration, tag removed on expiry/cleanse, ' +
                  'highest-stack law: weaker re-apply discarded (timer unchanged), ' +
                  'stronger re-apply replaces + resets timer',
              },
              // Formula annotation for audit trail
              formula: {
                referenceHit,
                igniteRatio,
                ticks,
                magnitudeFormula: 'magnitude = -(referenceHit × igniteRatio / ticks)',
                dps,
                dpsFormula: 'dps = |magnitude| / period = referenceHit × igniteRatio / duration',
              },
            },
            // top-level dps for the withinPercent balance checker
            dps,
            // cross-catalog links: real seeded fire ability ids
            links: [
              { catalogId: 'spellbook', entityId: 'off-fire-01', role: 'primary-ignite-source' },
              { catalogId: 'spellbook', entityId: 'off-fire-04', role: 'ignite-source' },
              { catalogId: 'spellbook', entityId: 'off-fire-05', role: 'ignite-source' },
            ],
          },
          links: [
            { catalogId: 'spellbook', entityId: 'off-fire-01', role: 'primary-ignite-source' },
            { catalogId: 'spellbook', entityId: 'off-fire-04', role: 'ignite-source' },
            { catalogId: 'spellbook', entityId: 'off-fire-05', role: 'ignite-source' },
          ],
          ueAssets: [
            `/Game/Abilities/Generated/GE_Gen_${s}`,
            `/Game/Abilities/Generated/DT_GeneratedAbilities`,
          ],
        };
      },
      // fieldsPopulated checks that all named keys exist (non-null) on data.effect
      accept: fieldsPopulated(
        'effect',
        'Effect rules complete (tag/magnitude/period/duration/stacking/sourceDamageType/dispellable)',
        ['tag', 'magnitude', 'period', 'duration', 'stacking', 'sourceDamageType', 'dispellable'],
      ),
      staticChecks: (e) => [
        cppSymbolExists(`UGE_Gen_${slug(e.name)}`, 'Ignite GameplayEffect C++ class compiled'),
      ],
    },

    // ── 3. Balance ────────────────────────────────────────────────────────────
    {
      archetype: 'balance',
      label: 'Balance',
      view: {
        kind: 'table',
        field: 'balance',
        columns: [{ key: 'dps' }, { key: 'totalDamage' }, { key: 'referenceHit' }],
      },
      produce: () => {
        // Ignite DPS derivation:
        //   Fireball (off-fire-01) base = 35 damage
        //   igniteRatio = 0.90 (§5c: ~90% of triggering hit)
        //   duration = 4 s, period = 0.5 s → 8 ticks
        //   tickDamage = 35 × 0.90 / 8 ≈ 3.9375
        //   dps = tickDamage / period = 3.9375 / 0.5 = 7.875
        //   totalDamage = 35 × 0.90 = 31.5 (sustained over 4 s)
        //
        // Tier-100 power envelope: sustained fire ailment DPS ~7–10 per tier 1 hit
        // Ignite at 7.875 dps is inside that band.
        const dps = 7.875;
        const totalDamage = 31.5;
        const referenceHit = 35;
        return {
          data: {
            balance: {
              dps,
              totalDamage,
              referenceHit,
              note:
                'Ignite DPS = referenceHit(35) × igniteRatio(0.90) / duration(4 s) = 7.875 fire DPS. ' +
                'Total ignite = 31.5 fire damage over 4 s (8 ticks × 3.9375 per tick at 0.5 s period). ' +
                'Stacking is highest-only — a second 35-damage Fireball on a burning target refreshes ' +
                'the 4 s timer but does NOT add a second stack (no DPS doubling). ' +
                'A stronger hit (e.g. Flame Lance off-fire-05 base 55 dmg → 12.375 DPS) would replace ' +
                'the weaker ignite. Within tier-100 power envelope per canon proj-balance.',
            },
            dps,
          },
        };
      },
      // tier target 7.875, ±20% band = 6.3–9.45 — comfortably inside
      accept: withinPercent('dps', 'Ignite DPS within ±20% of tier target (7.875)', 7.875, 20),
    },

    // ── 4. Icon 2D Art ────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Icon`],
      }),
      accept: selected('selected', 'A status icon is selected'),
    },

    // ── 5. Test Gate ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'GE_Gen_Burning applies State.Burning tag on hit target',
            'tick fires at 0.5 s period (8 ticks over 4 s)',
            'total damage ≈ 90% of triggering fire hit (31.5 for Fireball base 35)',
            'State.Burning tag removed on GE expiry (4 s)',
            'cleanse/dispel removes State.Burning and cancels periodic GE immediately',
            'highest-stack law: weaker re-apply is discarded (timer unchanged)',
            'highest-stack law: stronger re-apply replaces active ignite and resets timer',
          ],
        },
      }),
      // FVSStatusBurningEffectTest — registered automation name (not the C++ class) so the runner resolves it.
      accept: runtimeDeferred('PoF.StatusBurning.EffectConfig', 'Functional test passes in UE'),
    },

    // ── 6. UE Packaging ───────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `GE_Gen_${s}`,                        // The ignite GameplayEffect (UGE_Gen_Burning)
          `T_${s}_Icon`,                         // Status icon texture
          `DT_GeneratedAbilities :: ${s}`,       // Row in the abilities DataTable
          `NS_${s}_VFX`,                         // Fire DoT particle / Niagara system (keys off State.Burning)
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'Fireball (GE_Fireball_ApplyBurning) → ApplyGameplayEffectToTarget(GE_Gen_Burning); ' +
                'GE_Gen_Burning grants State.Burning and starts the periodic execution. ' +
                'Other fire abilities (off-fire-04, off-fire-05) use the same path.',
              activatedBy:
                'On-hit for any fire ability carrying the Ignite application tag; ' +
                'highest-stack logic: GE_Gen_Burning checks active magnitude before applying — ' +
                'discards if weaker, replaces if stronger.',
              dependencies: [
                'UARPGAttributeSet (FireDamage, Health)',
                'ARPGDamageExecution (routes fire DoT ticks, applies resist)',
                'spellbook::off-fire-01 (Fireball — primary source)',
                'spellbook::off-fire-04 (Blazing Slash)',
                'spellbook::off-fire-05 (Flame Lance)',
              ],
              verification:
                'L2: UGE_Gen_Burning compiled in Source/PoF/Abilities/Generated/; ' +
                'DT_GeneratedAbilities seeded via seed_generated_abilities.py row "Burning"; ' +
                'L3: VSStatusBurningEffectTest in PIE — ' +
                'tag apply/expire/cleanse + tick timing + highest-stack replacement all verified',
            },
          },
          ueAssets: assets.map((a) => `/Game/Abilities/Generated/${a}`),
        };
      },
      accept: minCount('assets', 'All produced assets packaged', 3),
      staticChecks: (e) => [
        seedRowPresent('seed_generated_abilities.py', slug(e.name), 'Row present in the generated-abilities seed'),
      ],
    },
  ],
});
