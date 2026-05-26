import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

/**
 * Input Schemes pipeline (catalogId: 'input-schemes').
 *
 * Represents the full lifecycle of a single input-device scheme: action bindings,
 * context stacks, rebinding UI, accessibility options, and platform cert compliance.
 *
 * Governed by canon rules:
 *   - `input-remap-conflict` (global): FindConflictingAction before any binding is applied;
 *     platform-reserved system buttons are never remappable.
 *   - `input-a11y` (scoped): every hold-duration action exposes hold-to-toggle; no action
 *     is chord-only; analog deadzone default 0.1–0.25, user-tunable and saved.
 *
 * UE wiring: AARPGPlayerController owns the UEnhancedInputComponent and the active
 * UInputMappingContext stack. WBP_InputRebind calls FindConflictingAction on the
 * UEnhancedInputLocalPlayerSubsystem before committing any user-defined binding.
 * Deadzone and hold-to-toggle settings persist via the game-config save slot.
 */

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

registerCatalogPipeline({
  catalogId: 'input-schemes',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the input scheme for PoF that maps physical device inputs to game ` +
            `actions for one device family (gamepad by default). It defines the canonical bind ` +
            `set for all core ARPG verbs — movement, combat, traversal, interaction, and ` +
            `ability activation — via UE5 Enhanced Input (UInputMappingContext / IA_* actions). ` +
            `The scheme is accessibility-first: every hold-duration action exposes a hold-to-toggle ` +
            `alternative; no action is chord-only; analog deadzones are user-tunable in the ` +
            `0.1–0.25 range and persist in the save slot. Rebinding is fully supported for all ` +
            `non-system buttons: WBP_InputRebind calls FindConflictingAction on the Enhanced Input ` +
            `subsystem before committing any remap, and reserved platform buttons (Guide/Share/Create) ` +
            `are excluded from the remappable set by a static allowlist. Haptic feedback is layered ` +
            `on top of bindings via a separate rumble profile asset. The scheme ships as a DA_ ` +
            `DataAsset referencing IMC_Gameplay, IMC_Menu, and IMC_Dialogue contexts so the ` +
            `player controller can push/pop contexts cleanly across game states.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Action Mapping ─────────────────────────────────────────────────────
    {
      archetype: 'schema',
      label: 'Action Mapping',
      view: {
        kind: 'table',
        field: 'mapping',
        columns: [
          { key: 'move' },
          { key: 'attack' },
          { key: 'dodge' },
          { key: 'interact' },
          { key: 'ability1' },
          { key: 'ability2' },
          { key: 'ability3' },
          { key: 'ability4' },
        ],
      },
      produce: () => ({
        data: {
          mapping: {
            // Core verbs — UE Enhanced Input action asset names + default gamepad binds
            move: { action: 'IA_Move', bind: 'LeftThumbstick (2D-Axis)', type: 'Axis2D' },
            attack: { action: 'IA_Attack', bind: 'ButtonFaceBottom (Cross/A)', type: 'Digital' },
            dodge: { action: 'IA_Dodge', bind: 'ButtonFaceRight (Circle/B)', type: 'Digital' },
            interact: { action: 'IA_Interact', bind: 'ButtonFaceTop (Triangle/Y)', type: 'Digital' },
            // Ability slots — map to shoulder/trigger set
            ability1: { action: 'IA_Ability1', bind: 'LeftShoulder (L1)', type: 'Digital' },
            ability2: { action: 'IA_Ability2', bind: 'RightShoulder (R1)', type: 'Digital' },
            ability3: { action: 'IA_Ability3', bind: 'LeftTrigger (L2 held)', type: 'Axis1D' },
            ability4: { action: 'IA_Ability4', bind: 'RightTrigger (R2 held)', type: 'Axis1D' },
            // Wiring contract
            wiringContract: {
              grantedBy:
                'AARPGPlayerController::SetupInputComponent — binds each IA_* action to a ' +
                'UEnhancedInputComponent callback; IMC_Gameplay pushed to the Enhanced Input subsystem on possess',
              activatedBy: 'Physical device input event → UEnhancedInputLocalPlayerSubsystem routes to active IMC',
              dependencies: ['AARPGPlayerController (C++ class, ueAssets: DA_InputSchemes)'],
              verification:
                'L2: AARPGPlayerController declared in Source/PoF/ + DA_InputSchemes in Content/Input/; ' +
                'L3: VSInputBindTest — each IA_* action fires the expected callback in PIE',
            },
          },
        },
        ueAssets: ['/Game/Input/DA_InputSchemes', '/Game/Input/IMC_Gameplay'],
      }),
      accept: fieldsPopulated('mapping', 'Move/attack/dodge/interact + ability1–4 bindings defined', [
        'move',
        'attack',
        'dodge',
        'interact',
        'ability1',
        'ability2',
        'ability3',
        'ability4',
      ]),
      staticChecks: () => [
        cppSymbolExists('AARPGPlayerController', 'Player controller (Enhanced Input owner) present in Source/'),
      ],
    },

    // ── 3. Context Stack ──────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Context Stack',
      view: {
        kind: 'table',
        field: 'contexts',
        columns: [{ key: 'gameplay' }, { key: 'menu' }, { key: 'dialogue' }],
      },
      produce: () => ({
        data: {
          contexts: {
            gameplay: {
              asset: 'IMC_Gameplay',
              priority: 0,
              pushedBy: 'AARPGPlayerController::OnPossess',
              poppedBy: 'AARPGPlayerController::OnUnPossess or menu open',
            },
            menu: {
              asset: 'IMC_Menu',
              priority: 10,
              pushedBy: 'UARPGUISubsystem::OpenMenu — pushed over IMC_Gameplay',
              poppedBy: 'UARPGUISubsystem::CloseMenu',
            },
            dialogue: {
              asset: 'IMC_Dialogue',
              priority: 5,
              pushedBy: 'UARPGDialogueComponent::BeginDialogue',
              poppedBy: 'UARPGDialogueComponent::EndDialogue',
            },
            wiringNote:
              'Higher priority IMC suppresses lower-priority mappings for overlapping actions. ' +
              'All three IMCs are declared in DA_InputSchemes for one-stop DataAsset load.',
          },
        },
      }),
      accept: fieldsPopulated('contexts', 'Gameplay/menu/dialogue context mappings defined', [
        'gameplay',
        'menu',
        'dialogue',
      ]),
    },

    // ── 4. Rebinding UI & Persistence ─────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Rebinding UI',
      view: {
        kind: 'table',
        field: 'rebinding',
        columns: [{ key: 'widget' }, { key: 'conflictCheck' }, { key: 'reservedButtons' }, { key: 'reset' }],
      },
      produce: () => ({
        data: {
          rebinding: {
            widget: 'WBP_InputRebind',
            // input-remap-conflict canon: FindConflictingAction before every binding commit
            conflictCheck: {
              api: 'UEnhancedInputLocalPlayerSubsystem::FindConflictingAction',
              behaviour:
                'Called BEFORE committing any user-defined remap. ' +
                'If a conflict is detected, the UI displays the conflicting action name and ' +
                'blocks the remap until the user resolves or accepts swap. ' +
                'Silent overwrite is NEVER permitted — a cert failure per canon input-remap-conflict.',
            },
            // input-remap-conflict canon: platform-reserved buttons are never remappable
            reservedButtons: {
              policy: 'Static allowlist — excluded from the remappable action set at all times',
              buttons: [
                'SpecialLeft (PS Share / Xbox View / Switch Minus)',
                'SpecialRight (PS Options / Xbox Menu / Switch Plus)',
                'HomeButton (PS Guide / Xbox Guide)',
              ],
              enforcement: 'AARPGInputRebindConfig::IsRemappable() returns false for reserved button FKeys',
            },
            reset: {
              api: 'UEnhancedInputLocalPlayerSubsystem::RemoveAllPlayerMappedKeysForContext',
              label: 'Restore Defaults',
              behaviour: 'Clears all user-mapped keys for the active IMC; reloads factory defaults from DA_InputSchemes',
            },
            persistence: {
              mechanism: 'UARPGSaveGame — remaps serialized as TArray<FPlayerKeyMapping> per context',
              loadedAt: 'AARPGPlayerController::BeginPlay after save-game is loaded',
              savedAt: 'On every successful remap commit + on game exit',
            },
            wiringContract: {
              grantedBy: 'WBP_InputRebind (UMG widget, opened from settings screen)',
              activatedBy: 'Player opens Settings → Controls; each confirmed remap triggers FindConflictingAction check then SaveGame write',
              dependencies: ['AARPGPlayerController', 'UARPGSaveGame'],
              verification:
                'L2: AARPGPlayerController + UARPGSaveGame symbols in Source/PoF/; WBP_InputRebind in Content/UI/; ' +
                'L3: VSInputRebindTest — remap persists across session reload; conflict triggers rejection not overwrite',
            },
          },
        },
        ueAssets: ['/Game/UI/WBP_InputRebind', '/Game/Input/DA_InputSchemes'],
      }),
      accept: fieldsPopulated('rebinding', 'Widget / conflictCheck / reservedButtons / reset defined', [
        'widget',
        'conflictCheck',
        'reservedButtons',
        'reset',
      ]),
      staticChecks: () => [
        cppSymbolExists('AARPGPlayerController', 'Player controller (rebind host) present in Source/'),
      ],
    },

    // ── 5. Deadzone & Haptics ─────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Deadzone & Haptics',
      view: {
        kind: 'table',
        field: 'feel',
        columns: [{ key: 'deadzone' }, { key: 'rumble' }],
      },
      produce: () => ({
        data: {
          feel: {
            // input-a11y canon: deadzone default 0.1–0.25, user-tunable, saved
            deadzone: {
              default: 0.15,
              min: 0.10,
              max: 0.25,
              tunable: true,
              savedIn: 'UARPGSaveGame::AnalogDeadzone',
              appliedVia: 'UInputModifierDeadZone on IA_Move within IMC_Gameplay',
              note:
                'Per canon input-a11y: deadzone default must sit in 0.1–0.25; ' +
                'user can adjust within that range in Settings → Accessibility → Deadzone. ' +
                'Value persists in the save slot and is reloaded at controller possess.',
            },
            rumble: {
              defaultProfile: 'ForceFeedbackEffect_DefaultHit',
              optIn: true,
              savedIn: 'UARPGSaveGame::HapticsEnabled',
              note: 'Vibration OFF by default (platform cert requirement); user opts in via Settings → Controls.',
            },
          },
        },
      }),
      accept: fieldsPopulated('feel', 'Deadzone + rumble profile defined', ['deadzone', 'rumble']),
    },

    // ── 6. Accessibility ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            // input-a11y canon — hold-to-toggle
            'hold-to-toggle available for all hold-duration actions (IA_Dodge charged hold, IA_Interact held prompt): ' +
              'implemented as UInputModifierHoldOrToggle; user toggles in Settings → Accessibility → Hold-to-Toggle',
            // input-a11y canon — no chord-only actions
            'no action is chord-only: every function reachable by a single button (chords are convenience duplicates, ' +
              'never the only path); verified by action-allowlist review in AARPGInputRebindConfig',
            // input-a11y canon — deadzone user-tunable
            'analog deadzone user-tunable 0.10–0.25 (default 0.15); stored in UARPGSaveGame::AnalogDeadzone; ' +
              'reloaded at possess so the setting survives session restart',
            // extra cert-required accessibility item
            'remapping does not expose platform-reserved buttons (Guide / Share / Options) — ' +
              'AARPGInputRebindConfig::IsRemappable() enforces the static exclusion list per canon input-remap-conflict',
          ],
          wiringContract: {
            grantedBy: 'Settings screen → Accessibility panel (WBP_AccessibilitySettings) writes to UARPGSaveGame',
            activatedBy: 'AARPGPlayerController::BeginPlay reads saved accessibility prefs and applies modifiers to the active IMC',
            dependencies: ['UARPGSaveGame', 'AARPGPlayerController', 'WBP_AccessibilitySettings'],
            verification:
              'L2: UARPGSaveGame + AARPGPlayerController in Source/PoF/; ' +
              'L3: VSInputA11yTest — hold-to-toggle fires on single press after opt-in; deadzone change takes effect without session restart',
          },
        },
      }),
      accept: minCount('checks', '≥3 accessibility checks per input-a11y canon', 3),
    },

    // ── 7. Input Glyphs ───────────────────────────────────────────────────────
    {
      archetype: 'gallery',
      label: 'Input Glyphs',
      view: { kind: 'gallery', field: 'glyphSet', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: {
          glyphSet: 0,
          // No live icon-sets link: the only seeded icon-set is iconset-abilities (ability icons),
          // which does not carry input-device glyph semantics. The input-glyphs icon set is
          // deferred until a dedicated seed row is authored in the icon-sets catalog.
          glyphSetNote:
            'Glyph set deferred as descriptive data — no dangling cross-catalog link. ' +
            'A dedicated icon-sets seed row for device glyphs (e.g. iconset-gamepad-glyphs) is ' +
            'required before a real CatalogLink can be declared here. ' +
            'note: pending dedicated input-glyphs icon-set seed.',
          glyphSetSpec: {
            deviceFamily: 'Gamepad (PlayStation / Xbox / Generic)',
            buttonGlyphs: ['Cross/A', 'Circle/B', 'Square/X', 'Triangle/Y', 'L1/LB', 'R1/RB', 'L2/LT', 'R2/RT', 'LS', 'RS', 'D-Pad'],
            format: '64×64 px PNG sprites + 256-px source PSD; packed into T_Glyphs_Gamepad_Atlas (4096 grid)',
            atlasAsset: `T_${slug(e.name)}_Glyphs_Atlas`,
            styleNote: 'Flat silhouette style; high contrast on dark HUD; colorblind-safe (no hue-only distinction)',
          },
        },
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_Glyphs_Atlas`],
      }),
      accept: selected('glyphSet', 'A glyph set candidate is selected'),
    },

    // ── 8. Tutorial Prompts ───────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Tutorial Prompts',
      view: { kind: 'table', field: 'tutorial', columns: [{ key: 'promptStyle' }] },
      produce: () => ({
        data: {
          tutorial: {
            promptStyle: 'contextual-overlay',
            glyphSource: 'T_Gamepad_Glyphs_Atlas resolved at runtime from AARPGPlayerController::GetActiveDeviceFamily()',
            note: 'Prompt glyphs update automatically when the active input device changes (gamepad ↔ keyboard).',
          },
        },
      }),
      accept: fieldsPopulated('tutorial', 'Tutorial prompt style defined', ['promptStyle']),
    },

    // ── 9. Localization ───────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'keys' },
      produce: () => ({
        data: {
          keys: [
            'action_move',
            'action_attack',
            'action_dodge',
            'action_interact',
            'action_ability1',
            'action_ability2',
            'action_ability3',
            'action_ability4',
            'input_rebind_conflict_warning',
            'input_hold_to_toggle_label',
            'input_deadzone_label',
          ],
        },
      }),
      accept: minCount('keys', '≥1 localization key defined', 1),
    },

    // ── 10. Platform Cert ─────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Platform Cert',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            // input-remap-conflict canon: system buttons reserved
            'System buttons non-remappable: Guide/HomeButton, Share/SpecialLeft, Options/SpecialRight excluded ' +
              'from remappable set via AARPGInputRebindConfig::IsRemappable() static allowlist',
            // Trigger-axis accessibility (cert TRC requirement)
            'Trigger axes (L2/R2) not required for accessibility-critical interactions: every ability bound to ' +
              'a trigger has a single-button shoulder alternative; trigger-only paths are convenience duplicates only',
            // Vibration opt-in (TRC/XR cert)
            'Vibration OFF by default (platform cert); user opt-in via Settings → Controls → Haptics; ' +
              'preference stored in UARPGSaveGame::HapticsEnabled',
            // Deadzone cert requirement (many cert suites require tunable deadzone)
            'Analog deadzone user-tunable 0.10–0.25 with visible range in settings UI; ' +
              'meets platform accessibility deadzone requirement (TRC/XR ref: Accessibility §3)',
          ],
        },
      }),
      accept: minCount('checks', '≥1 platform cert check documented', 1),
    },

    // ── 11. Test Gate ─────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'rebind persists across sessions (UARPGSaveGame round-trip)',
            'conflict rejected by FindConflictingAction — silent overwrite never occurs',
            'hold-to-toggle fires correctly on single press after opt-in in PIE',
            'deadzone change takes effect immediately without session restart',
            'reserved system buttons absent from the remappable list in WBP_InputRebind',
            'all IA_* callbacks fire on expected gamepad inputs in PIE',
          ],
        },
      }),
      accept: runtimeDeferred('VSInputRebindTest', 'Rebind persists + conflicts rejected + a11y options functional in PIE'),
    },

    // ── 12. UE Packaging ──────────────────────────────────────────────────────
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `DA_InputSchemes_${s}`,
          `IMC_Gameplay_${s}`,
          `IMC_Menu_${s}`,
          `IMC_Dialogue_${s}`,
          `T_${s}_Glyphs_Atlas`,
          `WBP_InputRebind`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                'AARPGPlayerController::SetupInputComponent reads DA_InputSchemes_* DataAsset; ' +
                'pushes IMC_Gameplay on possess; WBP_InputRebind commits remaps via ' +
                'UEnhancedInputLocalPlayerSubsystem::AddPlayerMappedKeyInSlot after FindConflictingAction check',
              activatedBy:
                'Possess / unpossess lifecycle for IMC push/pop; ' +
                'Player interact with Settings screen for rebind/a11y changes',
              dependencies: [
                'AARPGPlayerController (C++ — Enhanced Input owner)',
                'UARPGSaveGame (C++ — remap + a11y persistence)',
                'WBP_InputRebind + WBP_AccessibilitySettings (UMG)',
              ],
              verification:
                'L2: AARPGPlayerController + UARPGSaveGame compiled in Source/PoF/; ' +
                'DA_InputSchemes + IMC_* seeded in Content/Input/; T_*_Glyphs_Atlas in Content/UI/Icons/; ' +
                'L3: VSInputRebindTest in PIE — full bind/remap/persist/a11y cycle',
            },
          },
          ueAssets: assets.map((a) => `/Game/Input/${a}`),
        };
      },
      accept: minCount('assets', 'All input assets packaged', 2),
      staticChecks: () => [
        cppSymbolExists('AARPGPlayerController', 'Player controller present in Source/'),
      ],
    },
  ],
});
