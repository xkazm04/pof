import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists, seedRowPresent } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * HUD Elements pipeline (catalogId: 'hud-elements').
 *
 * Represents persistent in-game UI widgets that surface live game-state to the
 * player. The seeded entity is the Health Bar — a UMG widget that binds to
 * UARPGAttributeSet.Health / MaxHealth via the OnAttributeChanged delegate,
 * displays current/max in {cur}/{max} format, and is anchored bottom-left.
 *
 * Per canon `proj-hud-binding`: every HUD entity must declare its widget, a
 * display-format string, and a HUD anchor. The widget is granted by the player
 * HUD class (AARPGHUD) and activated by the UARPGAttributeSet attribute-changed
 * delegate — never hard-coded placement.
 *
 * Wiring: AARPGHUD::BeginPlay creates WBP_<slug> and adds it to the viewport;
 * UARPGAttributeSet::PostAttributeChange fires OnHealthChanged → the widget's
 * OnHealthChanged binding refreshes the progress bar value and format string.
 */
registerCatalogPipeline({
  catalogId: 'hud-elements',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a persistent UMG widget in the player HUD that communicates the ` +
            `character's vital resource — current and maximum health — throughout combat and ` +
            `exploration. Positioned in the bottom-left safe area, it sits inside the HUD layer ` +
            `(ZOrder 10) alongside the resource and XP bars. Its role is situational awareness: ` +
            `a player must be able to gauge health at a glance during the disciplined melee rhythm ` +
            `(canon game-pillars), where reading the bar takes visual priority over reading numbers. ` +
            `The bar is a horizontal progress fill (width scales with viewport width via anchoring, ` +
            `never a fixed pixel size), with a {cur}/{max} numeric label in a localization-safe ` +
            `slot to the right of the fill. A low-health state (≤25% MaxHealth) triggers a crimson ` +
            `pulse overlay and a screen-edge vignette so the warning registers even in peripheral ` +
            `vision. The design is restrained per game-tone: no dynamic bounce or glow at full ` +
            `health; effects fire only on state transitions. Cross-catalog surface: the bar ` +
            `optionally shows an active shield layer (energy-shield / ward value from ` +
            `UARPGAttributeSet) overlaid in an ice-blue tint when shield > 0 — a visual ` +
            `distinction that maps to the ARPG-LAWS §8 defense-layer model. The icon slot ` +
            `pulls from the icon-sets presentation library (link: icon-sets::iconset-abilities ` +
            `for the health/vitals icon). Localization: the format string ({cur}/{max}) is ` +
            `table-driven; numerals are locale-aware. Accessibility: AA contrast on the dark HUD, ` +
            `colorblind-safe palette (no red-only cue — pulsing brightness doubles as the cue), ` +
            `scalable to 200% in UMG scaling.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Data Binding ────────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Data Binding',
      view: {
        kind: 'table',
        field: 'dataBinding',
        columns: [{ key: 'source' }, { key: 'format' }, { key: 'anchor' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          dataBinding: {
            source: 'UARPGAttributeSet.Health / MaxHealth',
            delegate: 'OnAttributeChanged (UARPGAttributeSet::PostAttributeChange)',
            bindingPattern:
              'UARPGHealthBarWidget::NativeConstruct subscribes to ' +
              'UARPGAttributeSet::OnHealthChanged; PostAttributeChange broadcasts ' +
              '(OldValue, NewValue) pair. The widget caches a weak pointer to the owning ' +
              'UARPGAbilitySystemComponent and reads Health / MaxHealth on each callback.',
            format: '{cur}/{max}',
            formatDetail:
              'FText::Format(LOCTEXT("HUDHealthFmt", "{0}/{1}"), ' +
              'FText::AsNumber(FMath::FloorToInt(Health)), ' +
              'FText::AsNumber(FMath::FloorToInt(MaxHealth))). ' +
              'Integer floors match the PoF convention of whole-number health displays.',
            anchor: 'bottom-left',
            anchorDetail:
              'UMG Anchor: Minimum=(0,1) Maximum=(0,1), Alignment=(0,1). ' +
              'Offset from bottom-left safe-area inset: X=24, Y=−24 (design units). ' +
              'Widget size: Width=320, Height=48 at 1080p base; DPI-scaled via UMG ' +
              'DPI Curve (1080p = scale 1.0, 4K = scale 2.0). ' +
              'The HUD ZOrder is 10 (below modal menus, above world widgets).',
            shieldLayer: {
              source: 'UARPGAttributeSet.EnergyShield (or Ward) when > 0',
              tint: 'ice-blue (#80C8FF at alpha 0.6, rendered as overlay fill above health fill)',
              note:
                'Shield layer maps to ARPG-LAWS §8 defense-layer model. ' +
                'Visible only when EnergyShield > 0; hides instantly on depletion.',
            },
            wiringContract: {
              grantedBy:
                'AARPGHUD::BeginPlay creates WBP_HudHealthBar and calls AddToViewport(ZOrder=10). ' +
                'The HUD class is set on the GameMode (DefaultHUDClass = AARPGHUD) per HUDClass→AARPGHUD wiring (project_improvements_04_hud_ui).',
              activatedBy:
                'UARPGAttributeSet::PostAttributeChange → OnHealthChanged multicast delegate → ' +
                'UARPGHealthBarWidget::OnHealthChanged(float NewHealth, float NewMaxHealth). ' +
                'The delegate fires on every attribute-change tick, including shield overlay (OnEnergyShieldChanged).',
              dependencies: [
                'UARPGAttributeSet (Health, MaxHealth, EnergyShield attributes)',
                'AARPGHUD (HUD class that creates and owns the widget)',
                'UARPGAbilitySystemComponent (attribute source)',
              ],
              verification:
                'L2: UARPGAttributeSet declares Health + MaxHealth attributes in Source/PoF/; ' +
                'AARPGHUD creates WBP_HudHealthBar in BeginPlay; ' +
                'seed_hud_elements.py seeds the WBP row in DT_HUDElements. ' +
                'L3: VSHUDElementTest — widget renders + reads correct values at 1080p and 4K in PIE.',
            },
          },
        },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'vitals-icon' },
        ],
        ueAssets: [
          '/Game/UI/HUD/WBP_HudHealthBar',
          '/Game/UI/HUD/DT_HUDElements',
        ],
      }),
      accept: fieldsPopulated('dataBinding', 'source / format / anchor populated', [
        'source',
        'format',
        'anchor',
      ]),
      staticChecks: () => [
        cppSymbolExists('UARPGAttributeSet', 'Attribute set declared in UE Source'),
        cppSymbolExists('AARPGHUD', 'HUD class declared in UE Source'),
      ],
    },

    // ── 3. State Logic ─────────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'State Logic',
      view: {
        kind: 'table',
        field: 'stateLogic',
        columns: [{ key: 'states' }, { key: 'transitions' }, { key: 'lowHealthThreshold' }],
      },
      produce: () => ({
        data: {
          stateLogic: {
            states: {
              full: {
                condition: 'Health / MaxHealth > 0.25',
                visual: 'Neutral green-to-amber fill gradient; no animation',
                note: 'The bar reads as safe; no animation to avoid distraction during normal combat.',
              },
              low: {
                condition: 'Health / MaxHealth ≤ 0.25 (i.e. ≤25% of MaxHealth)',
                visual:
                  'Fill color shifts to crimson (#C0392B). ' +
                  'Crimson pulse overlay (UMG Animation: 1.2 s period, alpha 0→0.4→0, ease in-out). ' +
                  'Screen-edge vignette (PostProcessVolume player channel, Vignette Intensity 0→0.35, 0.4 s blend).',
                note:
                  'Pulse period 1.2 s is chosen to avoid sync with typical 1 s heartbeat SFX; ' +
                  'brightness modulation doubles as the cue for deuteranopia/protanopia players ' +
                  '(the hue shift alone is insufficient — canon art-icon-a11y).',
              },
              critical: {
                condition: 'Health / MaxHealth ≤ 0.10 (≤10% of MaxHealth)',
                visual:
                  'Pulse period halves to 0.6 s; vignette intensity increases to 0.55. ' +
                  'Alert SFX fires once on transition (SC_HUDHealthCritical).',
                note: 'A second threshold gives the player a final escalating cue before death.',
              },
              dead: {
                condition: 'Health ≤ 0',
                visual: 'Bar fill immediately clears to 0; vignette fades out (handled by death screen).',
                note: 'The bar does not hold at near-zero — it snaps to 0 on the OnDeath broadcast.',
              },
            },
            transitions: [
              { from: 'full', to: 'low', trigger: 'Health / MaxHealth crosses 0.25 downward' },
              { from: 'low', to: 'critical', trigger: 'Health / MaxHealth crosses 0.10 downward' },
              { from: 'critical', to: 'low', trigger: 'Health / MaxHealth rises above 0.10 (e.g. flask)' },
              { from: 'low', to: 'full', trigger: 'Health / MaxHealth rises above 0.25' },
              { from: 'any', to: 'dead', trigger: 'Health ≤ 0 (OnDeath broadcast)' },
            ],
            lowHealthThreshold: 0.25,
            criticalThreshold: 0.10,
            pulsePeriodLow: 1.2,
            pulsePeriodCritical: 0.6,
            vignetteIntensityLow: 0.35,
            vignetteIntensityCritical: 0.55,
            smoothing: {
              enabled: true,
              lerpSpeed: 6.0,
              note:
                'Health fill is lerped at 6 units/s (FInterpTo) so large hits produce a visible ' +
                'drain rather than an instant snap. The numeric label updates instantly (no lerp) ' +
                'to maintain accuracy for the player.',
            },
          },
        },
      }),
      accept: fieldsPopulated('stateLogic', 'states / transitions / lowHealthThreshold populated', [
        'states',
        'transitions',
        'lowHealthThreshold',
      ]),
    },

    // ── 4. Wireframe ───────────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Wireframe',
      view: { kind: 'gallery', field: 'selected', candidates: 3 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        ueAssets: [
          `/Game/UI/HUD/Wireframes/T_${slug(e.name)}_WF_Standard`,
          `/Game/UI/HUD/Wireframes/T_${slug(e.name)}_WF_LowHealth`,
          `/Game/UI/HUD/Wireframes/T_${slug(e.name)}_WF_WithShield`,
        ],
      }),
      accept: selected('selected', 'A wireframe layout is selected'),
    },

    // ── 5. Visual Design 2D / Icon 2D Art ─────────────────────────────────────
    // Universal Icon step (AUTHORING §3): every row includes an Icon 2D Art step.
    // This step doubles as the visual design asset for the health bar's icon slot.
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'vitals-icon' },
        ],
        ueAssets: [
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Heart`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Shield`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Skull`,
          `/Game/UI/Icons/T_${slug(e.name)}_Icon_Regen`,
        ],
      }),
      accept: selected('selected', 'A health-bar icon is selected from the icon-sets family'),
    },

    // ── 6. Animation ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Animation',
      view: { kind: 'checklist', field: 'animChecks' },
      produce: () => ({
        data: {
          animChecks: [
            'Fill bar lerps (FInterpTo at 6 units/s) — no snap on normal damage',
            'Low-health crimson pulse: UMG Animation, 1.2 s period, alpha 0→0.4→0 ease-in-out',
            'Critical pulse: 0.6 s period, vignette 0.55 — fires on ≤10% threshold crossing',
            'Damage flash: on any health loss > 5% MaxHealth, a white flash overlay (0.08 s, alpha 0→0.6→0) confirms the hit registration',
            'Heal flash: on any health gain, a brief green fill-pulse (0.3 s, alpha 0→0.2→0)',
            'Shield appear/disappear: EnergyShield overlay fades in over 0.2 s when shield > 0, fades out instantly on depletion',
            'All animations use UMG Animation tracks (not ticker/timer) so they respect game pause',
          ],
        },
      }),
      accept: minCount('animChecks', '≥4 animation checks defined', 4),
    },

    // ── 7. Accessibility ──────────────────────────────────────────────────────
    // Scoped to canon `art-icon-a11y`: AA contrast, scalable, colorblind-safe
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'a11yChecks' },
      produce: () => ({
        data: {
          a11yChecks: [
            'AA contrast: health fill (#27AE60 full, #C0392B low, #E74C3C critical) on dark HUD background (#0D0D0D) — all ≥ 4.5:1 ratio',
            'Colorblind-safe: pulsing brightness (not hue alone) is the low-health cue; critical state adds a distinct animated pattern overlay that is not purely color-coded (deuteranopia / protanopia safe)',
            'Legible at 32px icon slot: vitals icon uses strong silhouette (heart shape, 3/4 view, rarity-frame) per art-icons canon — readable at 32px minimum',
            'Scalable: widget anchors + DPI curve ensure correct layout at 100%, 150%, 200% UMG text scale; numeric label uses UMG font size 18 base, scales via DPI curve',
            'No color-only information: every state change uses at least two channels (color + animation or color + shape change)',
            'Screen reader / subtitle: health value exposed as accessibility text "Health: {cur} of {max}" via UMG Accessibility Widget Visibility',
          ],
        },
      }),
      accept: minCount('a11yChecks', '≥4 accessibility checks defined (art-icon-a11y)', 4),
    },

    // ── 8. Localization ────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'l10nChecks' },
      produce: () => ({
        data: {
          l10nChecks: [
            'Format string "{0}/{1}" sourced from LOCTEXT("HUDHealthFmt") — not a hard-coded literal',
            'FText::AsNumber respects locale-specific numeral separators (e.g. 1.000 vs 1,000)',
            'Label slot width set to Auto with a max 96 dp clamp so 4-digit health values (9999/9999) do not overflow at any supported locale',
            'RTL layout: widget tested with right-to-left text direction; numeric label mirrors correctly via UMG auto-mirroring',
            'No truncation: if MaxHealth exceeds 4 digits (e.g. endgame 10000+), label switches to condensed format (e.g. "9.9k/10k") via blueprint format branch',
          ],
        },
      }),
      accept: minCount('l10nChecks', '≥3 localization checks defined', 3),
    },

    // ── 9. Test Gate ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'testChecks' },
      produce: () => ({
        data: {
          testChecks: [
            'Widget renders at 1080p: WBP_HudHealthBar visible in PIE viewport',
            'Widget renders at 4K (3840×2160): layout correct, no overflow',
            'Health attribute change fires OnHealthChanged → bar fill updates to correct value',
            'MaxHealth = 0 edge case: widget shows "0/0" without divide-by-zero crash',
            'Low-health threshold (≤25%) triggers crimson pulse animation',
            'Critical threshold (≤10%) triggers 0.6 s pulse + vignette 0.55',
            'EnergyShield > 0 shows ice-blue shield overlay; depletion hides overlay',
            'Localized format string renders correctly (FText::Format path exercised)',
          ],
        },
      }),
      accept: runtimeDeferred(
        'VSHUDElementTest',
        'Renders + binds at multiple resolutions in PIE',
      ),
    },

    // ── 10. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `WBP_${s}`,
          `DT_HUDElements :: ${s}`,
          `T_${s}_Fill_Full`,
          `T_${s}_Fill_Low`,
          `T_${s}_Fill_Critical`,
          `T_${s}_ShieldOverlay`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'AARPGHUD::BeginPlay calls CreateWidget<UUserWidget>(this, WBP_HudHealthBarClass) ' +
                'and AddToViewport(ZOrder=10). DefaultHUDClass = AARPGHUD is set on the GameMode ' +
                '(BP_ARPGGameMode). Per canon proj-hud-binding: widget declared, format string ' +
                'declared, anchor declared — no hard-coded placement.',
              activatedBy:
                'UARPGAttributeSet::PostAttributeChange broadcasts OnHealthChanged / OnMaxHealthChanged ' +
                'multicast delegates → UARPGHealthBarWidget::OnHealthChanged(float, float) updates ' +
                'ProgressBar fill and the FText label. OnEnergyShieldChanged drives the shield overlay. ' +
                'State transitions (full / low / critical / dead) are driven by the normalized ratio ' +
                'Health / MaxHealth evaluated on each callback.',
              dependencies: [
                'UARPGAttributeSet (Health, MaxHealth, EnergyShield — Source/PoF/)',
                'AARPGHUD (creates + owns the widget — Source/PoF/)',
                'UARPGAbilitySystemComponent (attribute source, lives on player character)',
                'icon-sets::iconset-abilities (vitals icon family)',
              ],
              verification:
                'L2: UARPGAttributeSet + AARPGHUD declared in Source/PoF/ (cppSymbolExists); ' +
                'seed_hud_elements.py seeds WBP_HudHealthBar row in DT_HUDElements; ' +
                'L3: VSHUDElementTest — widget renders + attribute-change delegate fires correctly ' +
                'at 1080p and 4K resolutions in PIE.',
            },
          },
          links: [
            { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'vitals-icon' },
          ],
          ueAssets: assets.map((a) => `/Game/UI/HUD/${a}`),
        };
      },
      accept: minCount('assets', '≥2 UE assets packaged', 2),
      staticChecks: (e) => [
        cppSymbolExists('UARPGAttributeSet', 'Attribute set declared in Source/'),
        cppSymbolExists('AARPGHUD', 'HUD class declared in Source/'),
        seedRowPresent('seed_hud_elements.py', slug(e.name), 'HUD element row seeded in Content/Python'),
      ],
    },
  ],
});
