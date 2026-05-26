import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * Screen Flow pipeline (catalogId: 'screen-flow').
 *
 * Represents the UI navigation graph between screens/menus in the PoF ARPG: how the
 * player moves between MainMenu → InGame HUD, through overlays (Inventory, CharStats,
 * Pause), and back.  Each entity in the catalog is a named screen; the pipeline
 * authoring step documents the full navigation graph, input bindings, widget
 * composition, transition animations, VFX/SFX juice, accessibility, localization,
 * and UE packaging for one Flow entity (e.g. the Main Menu Flow).
 *
 * Target entity: "Main Menu Flow" (screen-HUD — a real seeded screen entity).
 *
 * Wiring: UARPGHUDContext (owned by AARPGHUD, the HUD class) drives screen
 * stack pushes/pops in response to gameplay events and player input actions.
 * Screens are WBP_ UserWidget assets pushed onto the HUD viewport via
 * UGameViewportClient.  Input mode transitions (Game / UI / GameAndUI) are
 * managed by UARPGInputModeComponent on the PlayerController; it fires
 * SetInputMode* on open/close.  Navigation events use Enhanced Input
 * IA_OpenInventory / IA_OpenCharStats / IA_Pause (canon arpg-wiring-contract).
 * Screens embed HUD vitals (hud-elements::hud-health-bar) when visible in combat.
 *
 * Resolvable cross-catalog links:
 *   icon-sets::iconset-abilities   — source icon family for screen icons
 *   hud-elements::hud-health-bar   — embedded in InGame/HUD screen (vitals bar)
 */
registerCatalogPipeline({
  catalogId: 'screen-flow',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is the full UI navigation graph for the PoF ARPG: the state machine ` +
            `that governs how the player enters and exits every screen — from the Main Menu ` +
            `(NewGame / Continue / Settings / Quit) through the InGame HUD and its overlays ` +
            `(Inventory, CharStats, Pause/Settings) to terminal exit states (QuitToDesktop, Death). ` +
            `The graph enforces that every reachable state has at least one exit back to a known ` +
            `context, and that terminal states (QuitToDesktop, InGame) are explicitly marked. ` +
            `Design intent: navigation is keyboard/controller-first with zero mouse-only paths; ` +
            `every transition is driven by a named Enhanced Input Action (IA_Pause, IA_OpenInventory, ` +
            `IA_OpenCharStats) so remapping never silently breaks navigation. ` +
            `Tone: lean, purposeful menus — the player returns to combat quickly. Settings and ` +
            `CharStats are modal overlays over the HUD, not full scene transitions. ` +
            `The InGame HUD screen embeds the vitals bar (hud-elements::hud-health-bar) when ` +
            `active and always sits at z-depth 1; overlays push to z-depth 3 and above. ` +
            `Accessibility: all screens navigable by gamepad D-pad / keyboard arrows; focus state ` +
            `uses the unified focus-ring token; no timed or mouse-only interactions.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. Navigation Graph ────────────────────────────────────────────────────
    // KEY STEP — archetype: 'graph', view: graph, accept: graphValid
    // Nodes: all screens in the PoF UI state machine.
    // Edges: named transitions (Enhanced Input Actions or game events).
    // Terminals: QuitToDesktop (user exits game), InGame (active gameplay reached).
    // graphValid enforces: no dangling edges, all nodes reachable from [0], ≥1 terminal.
    {
      archetype: 'graph',
      label: 'Navigation Graph',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({
        data: {
          graph: {
            nodes: [
              // ── Root ─────────────────────────────────────────────────────────
              {
                id: 'main_menu',
                label: 'Main Menu [root] — title screen; entry point on game launch',
              },
              // ── Main Menu choices ─────────────────────────────────────────────
              {
                id: 'new_game',
                label: 'New Game — character creation / class select',
              },
              {
                id: 'continue',
                label: 'Continue — load last save slot',
              },
              {
                id: 'settings_menu',
                label: 'Settings — graphics / audio / controls / accessibility',
              },
              {
                id: 'quit_confirm',
                label: 'Quit Confirm — modal "Are you sure?" dialog',
              },
              // ── InGame screens ────────────────────────────────────────────────
              {
                id: 'ingame_hud',
                label: 'InGame HUD — combat/exploration HUD (vitals, abilities, minimap)',
              },
              {
                id: 'inventory_overlay',
                label: 'Inventory Overlay — modal item grid + equipment panel (z-depth 3)',
              },
              {
                id: 'char_stats_overlay',
                label: 'CharStats Overlay — attributes / passive overview (z-depth 3)',
              },
              {
                id: 'pause_menu',
                label: 'Pause Menu — resume / settings / save / quit-to-main (z-depth 4)',
              },
              {
                id: 'ingame_settings',
                label: 'InGame Settings — graphics/audio/controls panel from Pause',
              },
              {
                id: 'death_screen',
                label: 'Death Screen — respawn / quit-to-main options (z-depth 4)',
              },
              // ── Terminals ─────────────────────────────────────────────────────
              {
                id: 'quit_to_desktop',
                label: 'QUIT_TO_DESKTOP — application exits; unreachable to re-enter',
                terminal: true,
              },
              {
                id: 'in_game',
                label: 'IN_GAME — active gameplay running; HUD active; all overlays closeable',
                terminal: true,
              },
            ],
            edges: [
              // Main Menu → top-level choices
              { from: 'main_menu',          to: 'new_game',           label: 'Select New Game' },
              { from: 'main_menu',          to: 'continue',           label: 'Select Continue (save exists)' },
              { from: 'main_menu',          to: 'settings_menu',      label: 'Select Settings' },
              { from: 'main_menu',          to: 'quit_confirm',       label: 'Select Quit' },

              // Settings back to main
              { from: 'settings_menu',      to: 'main_menu',          label: 'Back / Esc' },

              // Quit confirm
              { from: 'quit_confirm',       to: 'main_menu',          label: 'Cancel' },
              { from: 'quit_confirm',       to: 'quit_to_desktop',    label: 'Confirm Quit' },

              // New Game / Continue → InGame HUD → IN_GAME terminal
              { from: 'new_game',           to: 'ingame_hud',         label: 'Class selected → scene load' },
              { from: 'continue',           to: 'ingame_hud',         label: 'Save loaded → scene load' },
              { from: 'ingame_hud',         to: 'in_game',            label: 'HUD active, gameplay running' },

              // InGame HUD overlays (open)
              { from: 'ingame_hud',         to: 'inventory_overlay',  label: 'IA_OpenInventory (Tab / I)' },
              { from: 'ingame_hud',         to: 'char_stats_overlay', label: 'IA_OpenCharStats (C)' },
              { from: 'ingame_hud',         to: 'pause_menu',         label: 'IA_Pause (Esc)' },

              // Overlays → back to HUD
              { from: 'inventory_overlay',  to: 'ingame_hud',         label: 'IA_OpenInventory toggle / Esc' },
              { from: 'char_stats_overlay', to: 'ingame_hud',         label: 'IA_OpenCharStats toggle / Esc' },

              // Pause Menu navigation
              { from: 'pause_menu',         to: 'ingame_hud',         label: 'Resume' },
              { from: 'pause_menu',         to: 'ingame_settings',    label: 'Settings' },
              { from: 'pause_menu',         to: 'main_menu',          label: 'Quit to Main Menu' },

              // InGame Settings back to Pause
              { from: 'ingame_settings',    to: 'pause_menu',         label: 'Back' },

              // Death
              { from: 'ingame_hud',         to: 'death_screen',       label: 'Player HP reaches 0' },
              { from: 'death_screen',       to: 'ingame_hud',         label: 'Respawn at checkpoint' },
              { from: 'death_screen',       to: 'main_menu',          label: 'Quit to Main Menu' },

              // IN_GAME terminal is a logical leaf — overlays route through ingame_hud, not IN_GAME
            ],
            note:
              'Terminals: QUIT_TO_DESKTOP (reached via quit_confirm) and IN_GAME (reached when ingame_hud ' +
              'is fully active with gameplay running). ' +
              'graphValid: 13 nodes, 22 edges, all reachable from main_menu[0]. ' +
              'Wiring: UARPGHUDContext on AARPGHUD drives screen stack; ' +
              'UARPGInputModeComponent on PlayerController fires SetInputMode on open/close; ' +
              'transitions keyed to Enhanced Input Actions (IA_Pause, IA_OpenInventory, IA_OpenCharStats). ' +
              'Overlay z-depths: HUD=1, FloatingBars=2, Overlays=3, Modals=4.',
          },
          wiringContract: {
            grantedBy:
              'AARPGHUD (HUD class) owns WBP_ root widget and manages a UARPGHUDContext screen stack. ' +
              'WBP_MainMenu / WBP_InGameHUD / WBP_InventoryOverlay / WBP_CharStatsOverlay / ' +
              'WBP_PauseMenu / WBP_DeathScreen are the concrete UserWidget assets. ' +
              'Screen pushes/pops are triggered by game events and Enhanced Input Actions.',
            activatedBy:
              'GameMode → AARPGHUD::BeginPlay → AddToViewport(WBP_MainMenu). ' +
              'Player input (IA_OpenInventory / IA_OpenCharStats / IA_Pause) → ' +
              'UARPGInputModeComponent → AARPGHUD::PushScreen / PopScreen. ' +
              'Death: AARPGCharacter::OnDeath → AARPGHUD::ShowDeathScreen.',
            dependencies: [
              'hud-elements (hud-health-bar — vitals bar embedded in InGame HUD)',
              'input-schemes (IA_OpenInventory, IA_OpenCharStats, IA_Pause — Enhanced Input Actions)',
            ],
            verification:
              'L2: WBP_MainMenu + WBP_InGameHUD + overlay WBPs present in /Game/UI/; ' +
              'UARPGHUDContext.cpp compiled; UARPGInputModeComponent.cpp compiled; ' +
              'L3: VSScreenFlowTest — all screens reachable + back-stack correct in PIE (deferred)',
          },
        },
        links: [
          { catalogId: 'hud-elements', entityId: 'hud-health-bar',  role: 'embedded-vitals-bar' },
          { catalogId: 'icon-sets',    entityId: 'iconset-abilities', role: 'screen-icon-family' },
        ],
      }),
      accept: graphValid('graph', 'Screens reachable + has a terminal/exit'),
    },

    // ── 3. Input Mapping ──────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Input Mapping',
      view: {
        kind: 'table',
        field: 'inputMapping',
        columns: [{ key: 'action' }, { key: 'defaultBinding' }, { key: 'inputMode' }, { key: 'transition' }],
      },
      produce: () => ({
        data: {
          inputMapping: [
            {
              action: 'IA_OpenInventory',
              defaultBinding: 'Tab / Gamepad Face Bottom',
              inputMode: 'Game → UI (toggle)',
              transition: 'ingame_hud ↔ inventory_overlay',
              note:
                'Toggles Inventory overlay open/close. InputMode switches to UI on open (GameInputMode), ' +
                'restored to Game on close. IA_OpenInventory is remappable (canon input-remap-conflict: ' +
                'FindConflictingAction called before any remap apply).',
            },
            {
              action: 'IA_OpenCharStats',
              defaultBinding: 'C / Gamepad Face Right',
              inputMode: 'Game → UI (toggle)',
              transition: 'ingame_hud ↔ char_stats_overlay',
              note:
                'Toggles CharStats overlay. Same InputMode pattern as Inventory. ' +
                'Closing also fires if Inventory is open (they are mutually exclusive overlays). ' +
                'Remappable with conflict check.',
            },
            {
              action: 'IA_Pause',
              defaultBinding: 'Esc / Gamepad Special Right',
              inputMode: 'Game → UI (stack push)',
              transition: 'ingame_hud → pause_menu | pause_menu → ingame_hud',
              note:
                'Pushes PauseMenu as a full modal overlay (z-depth 4); game paused via SetGlobalTimeDilation(0). ' +
                'Esc within PauseMenu = Resume. Gamepad Special Right is a platform-reserved exclusion ' +
                'on some platforms — mapped via conditional per-platform binding (canon input-remap-conflict).',
            },
            {
              action: 'IA_Confirm',
              defaultBinding: 'Enter / Gamepad Face Bottom',
              inputMode: 'UI',
              transition: 'Activates focused button in any menu',
              note:
                'Universal confirm in all UI contexts. No hold-duration; not chord-only. ' +
                'Works in MainMenu, PauseMenu, QuitConfirm, DeathScreen, Settings.',
            },
            {
              action: 'IA_Back',
              defaultBinding: 'Esc / Gamepad Face Right',
              inputMode: 'UI',
              transition: 'Pops current overlay / navigates back',
              note:
                'In overlays: closes overlay → returns to previous screen. ' +
                'In MainMenu: no-op (root screen). ' +
                'Hold-to-toggle option: disabled for navigation (instant action). ' +
                'Analog deadzone: not applicable (digital action).',
            },
          ],
          wiringContract: {
            grantedBy:
              'UARPGInputModeComponent (PlayerController) + AARPGHUD::HandleInput. ' +
              'All five actions are declared in IA_NavigationContext Enhanced Input mapping context, ' +
              'activated by AARPGPlayerController::SetupInputComponent.',
            activatedBy:
              'Player triggers the Enhanced Input action → PlayerController delegates to ' +
              'UARPGInputModeComponent → AARPGHUD::PushScreen / PopScreen / ToggleOverlay.',
            dependencies: [
              'input-schemes (Enhanced Input asset references for IA_OpenInventory/IA_OpenCharStats/IA_Pause/IA_Confirm/IA_Back)',
            ],
            verification:
              'L2: IA_NavigationContext mapping context asset present; UARPGInputModeComponent.cpp compiled; ' +
              'L3: VSScreenFlowTest — each IA triggers the declared transition in PIE (deferred)',
          },
        },
        ueAssets: ['/Game/Input/IMC_Navigation'],
      }),
      accept: minCount('inputMapping', '≥1 input mapping rule defined', 1),
    },

    // ── 4. Component Inventory ─────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'Component Inventory',
      view: {
        kind: 'table',
        field: 'componentInventory',
        columns: [{ key: 'screen' }, { key: 'widget' }, { key: 'zDepth' }, { key: 'inputMode' }],
      },
      produce: () => ({
        data: {
          componentInventory: [
            {
              screen: 'main_menu',
              widget: 'WBP_MainMenu',
              zDepth: 5,
              inputMode: 'UI',
              subWidgets: ['WBP_MenuButton × 4', 'WBP_GameLogo', 'WBP_VersionLabel'],
              anchor: 'Full viewport; centered panel 40% width',
              hudBinding: 'Not a HUD widget — standalone viewport addition',
            },
            {
              screen: 'settings_menu / ingame_settings',
              widget: 'WBP_SettingsPanel',
              zDepth: 4,
              inputMode: 'UI',
              subWidgets: ['WBP_SettingsTab × 4', 'WBP_SliderRow', 'WBP_KeybindRow', 'WBP_ToggleRow'],
              anchor: 'Centered modal 70% × 80% viewport',
              hudBinding:
                'Bound to AARPGHUD via UARPGHUDContext push. ' +
                'Tab navigation per category (canon input-a11y: every hold action exposes toggle option; ' +
                'keyboard-arrow focus).',
            },
            {
              screen: 'ingame_hud',
              widget: 'WBP_InGameHUD',
              zDepth: 1,
              inputMode: 'Game',
              subWidgets: [
                'WBP_HealthBar (hud-health-bar)',
                'WBP_ManaBar',
                'WBP_AbilitySlots × 4',
                'WBP_MiniMap',
                'WBP_QuestTracker',
                'WBP_EnemyHealthBar (floating, z-depth 2)',
                'WBP_DamageText (floating, z-depth 2)',
              ],
              anchor: 'Full viewport; sub-widget anchors per canon proj-hud-binding',
              hudBinding:
                'Root widget managed by AARPGHUD. Vitals bar anchored bottom-left (2%, 3%). ' +
                'Ability slots anchored bottom-center 30–70% width. ' +
                'hud-health-bar binding: hud-elements::hud-health-bar presentation entry (canon proj-hud-binding).',
            },
            {
              screen: 'inventory_overlay',
              widget: 'WBP_InventoryOverlay',
              zDepth: 3,
              inputMode: 'UI',
              subWidgets: ['WBP_ItemGrid', 'WBP_EquipPanel', 'WBP_Tooltip', 'WBP_FilterBar'],
              anchor: 'Centered panel 80% × 70% viewport; WBP_InGameHUD dimmed to 50% opacity behind',
              hudBinding:
                'Pushed onto AARPGHUD viewport at z-depth 3 via UARPGHUDContext. ' +
                'Dismissed on IA_OpenInventory toggle or IA_Back.',
            },
            {
              screen: 'char_stats_overlay',
              widget: 'WBP_CharStatsOverlay',
              zDepth: 3,
              inputMode: 'UI',
              subWidgets: ['WBP_StatRow × N', 'WBP_AttributeTotal', 'WBP_PassivePreview'],
              anchor: 'Right-side panel 35% width, full height; slides in from right edge',
              hudBinding:
                'Pushed at z-depth 3, mutually exclusive with WBP_InventoryOverlay. ' +
                'HUD dimmed 50% behind. Dismissed on IA_OpenCharStats toggle or IA_Back.',
            },
            {
              screen: 'pause_menu',
              widget: 'WBP_PauseMenu',
              zDepth: 4,
              inputMode: 'UI',
              subWidgets: ['WBP_MenuButton × 4 (Resume / Settings / Save / Quit to Main)'],
              anchor: 'Centered panel 30% width; backdrop blur on viewport behind',
              hudBinding:
                'Pushed at z-depth 4; game paused (SetGlobalTimeDilation 0). ' +
                'Resume: pop + restore InputMode Game. ' +
                'Settings: push WBP_SettingsPanel at z-depth 4.',
            },
            {
              screen: 'death_screen',
              widget: 'WBP_DeathScreen',
              zDepth: 4,
              inputMode: 'UI',
              subWidgets: ['WBP_DeathOverlay (full viewport dark)', 'WBP_RespawnButton', 'WBP_DeathStats'],
              anchor: 'Full viewport overlay; stats panel centered 60% width',
              hudBinding:
                'Pushed at z-depth 4; game time frozen. ' +
                'Respawn: pop + restore gameplay + call AARPGCharacter::Respawn. ' +
                'Quit to Main: unload level + push WBP_MainMenu.',
            },
          ],
          wiringContract: {
            grantedBy:
              'AARPGHUD::BeginPlay adds WBP_InGameHUD to viewport at z-depth 1. ' +
              'All overlay WBPs are added/removed via UARPGHUDContext (push/pop stack). ' +
              'Widget class references declared in ProjectSettings → ARPG → HUDWidgetClasses ' +
              '(never hardcoded in C++). Follows canon proj-hud-binding.',
            activatedBy:
              'Game event or Enhanced Input action → UARPGHUDContext::Push(ScreenId) → ' +
              'CreateWidget<UUserWidget>(PlayerController, WidgetClass) → AddToViewport(ZOrder).',
            dependencies: [
              'hud-elements (hud-health-bar — WBP_HealthBar binding on WBP_InGameHUD)',
              'input-schemes (IA_OpenInventory / IA_OpenCharStats / IA_Pause — trigger push/pop)',
            ],
            verification:
              'L2: all listed WBP_ assets present in /Game/UI/; UARPGHUDContext.cpp compiled; ' +
              'L3: VSScreenFlowTest — each screen opens/closes with correct z-order + InputMode (deferred)',
          },
        },
        ueAssets: [
          '/Game/UI/WBP_MainMenu',
          '/Game/UI/WBP_InGameHUD',
          '/Game/UI/WBP_InventoryOverlay',
          '/Game/UI/WBP_CharStatsOverlay',
          '/Game/UI/WBP_PauseMenu',
          '/Game/UI/WBP_DeathScreen',
          '/Game/UI/WBP_SettingsPanel',
        ],
      }),
      accept: minCount('componentInventory', '≥1 screen widget component entry defined', 1),
    },

    // ── 5. Transitions / Animation ────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Transitions / Animation',
      view: { kind: 'checklist', field: 'transitionChecks' },
      produce: () => ({
        data: {
          transitionChecks: [
            'WBP_MainMenu: FadeIn 0.4 s EaseOut on scene load; FadeOut 0.4 s EaseIn on scene unload',
            'WBP_InventoryOverlay: ScaleUp from 0.92 → 1.0 + FadeIn 0.25 s EaseOut on open; ScaleDown + FadeOut 0.2 s on close',
            'WBP_CharStatsOverlay: SlideIn from right edge 0.25 s EaseInOut; SlideOut 0.2 s on close',
            'WBP_PauseMenu: ScaleUp 0.2 s EaseOut + backdrop blur fade 0.3 s; ScaleDown + blur reverse on close',
            'WBP_DeathScreen: SlowFadeIn 1.2 s EaseIn (deliberate, weighted); FadeOut 0.4 s on respawn',
            'WBP_SettingsPanel: SlideIn from bottom 0.2 s EaseOut; SlideOut reverse on close',
            'All transitions respect the Reduce Motion accessibility flag (skip animation, instant swap)',
            'No transition blocks input for > 0.1 s; overlay is interactive as soon as AnimIn starts',
            'UMG WidgetAnimation assets named WA_<WidgetName>_Open / WA_<WidgetName>_Close (canon proj-naming)',
          ],
          transitionNotes:
            'Transitions authored as UMG WidgetAnimation (WA_ prefix). Durations chosen to feel ' +
            'responsive without feeling instant. Backdrop blur via BP_PostProcessOverlay (Material ' +
            'parameter-driven). Reduce Motion: UARPGSettingsSubsystem.ReduceMotion flag; when true all ' +
            'WA_ animations are skipped (instant visibility toggle). ' +
            'Canon vfx-budget rule applies: transitions fire no Niagara — they are pure UMG anim.',
        },
      }),
      accept: minCount('transitionChecks', '≥1 transition animation check listed', 1),
    },

    // ── 6. VFX / SFX Juice ────────────────────────────────────────────────────
    {
      archetype: 'rules',
      label: 'VFX / SFX Juice',
      view: {
        kind: 'table',
        field: 'juiceRules',
        columns: [{ key: 'trigger' }, { key: 'vfx' }, { key: 'sfx' }],
      },
      produce: () => ({
        data: {
          juiceRules: [
            {
              trigger: 'Menu button hover',
              vfx: 'Subtle highlight ring scales 1.0 → 1.04 (UMG RenderTransform); no Niagara — pure widget anim',
              sfx: 'SC_UI_Hover — short tick/whoosh < 80 ms; volume 0.6; never overlapping (debounce 50 ms)',
              note:
                'Hover SFX must respect UI Volume setting (UARPGSettingsSubsystem.UIVolume). ' +
                'Debounce prevents rapid stutter on focus cycling with arrow keys.',
            },
            {
              trigger: 'Menu button confirm / select',
              vfx: 'Button ScalePop 0.95 → 1.05 → 1.0 (spring, 0.15 s); icon flash WA_ConfirmFlash',
              sfx: 'SC_UI_Confirm — punchy click ~120 ms; volume 0.8',
              note: 'Plays on IA_Confirm press, not release, to feel immediate.',
            },
            {
              trigger: 'Overlay open (Inventory / CharStats)',
              vfx: 'Widget SlideIn anim (see Transitions); canvas edges shimmer WA_OverlayEdgeShimmer (subtle, 1-frame flash)',
              sfx: 'SC_UI_PanelOpen — whoosh ~200 ms; directional (pan right for CharStats, pan center for Inventory)',
              note: 'Shimmer: single-frame brightness pulse on the panel border — reads as "snap into place". No Niagara.',
            },
            {
              trigger: 'Pause menu open',
              vfx: 'Backdrop blur fade-in (0.3 s); PauseMenu ScaleUp (0.2 s); vignette darkens 20%',
              sfx: 'SC_UI_Pause — low thud + reverb tail ~0.4 s; communicates game world halting',
              note: 'Backdrop blur: PostProcess material param driven; does not disable game world rendering.',
            },
            {
              trigger: 'Death screen',
              vfx: 'Full-viewport desaturate + slow red vignette fade-in 1.2 s; WBP_DeathOverlay FadeIn',
              sfx: 'SC_Death_Sting — cinematic low-frequency sting ~2.0 s; respects Master Volume',
              note: 'Desaturate: PostProcess material param; not a full viewport capture (no perf spike).',
            },
            {
              trigger: 'Respawn',
              vfx: 'Death screen FadeOut 0.4 s → viewport FadeIn from black 0.6 s; PostProcess params reset',
              sfx: 'SC_Respawn_Ambient — soft ambient rise ~0.8 s; volume 0.5',
              note: 'No Niagara on respawn — pure screen fade. Player character respawn VFX handled by Character pipeline.',
            },
          ],
          note:
            'All SFX assets use SC_ prefix (SoundCue, canon proj-naming). ' +
            'UI SFX volume routed through UIVolume mix class (UARPGSettingsSubsystem). ' +
            'VFX: no Niagara emitters in UI — all visual feedback via UMG WidgetAnimations and PostProcess params. ' +
            'Canon art-vfx: restrained, readable — no gratuitous additive stacking applies equally to UI.',
        },
        ueAssets: [
          '/Game/Audio/UI/SC_UI_Hover',
          '/Game/Audio/UI/SC_UI_Confirm',
          '/Game/Audio/UI/SC_UI_PanelOpen',
          '/Game/Audio/UI/SC_UI_Pause',
          '/Game/Audio/Death/SC_Death_Sting',
          '/Game/Audio/Respawn/SC_Respawn_Ambient',
        ],
      }),
      accept: minCount('juiceRules', '≥1 VFX/SFX juice rule defined', 1),
    },

    // ── 7. Accessibility ─────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Accessibility',
      view: { kind: 'checklist', field: 'a11yChecks' },
      produce: () => ({
        data: {
          a11yChecks: [
            'All screens navigable by keyboard (arrow keys + Enter/Esc) — no mouse-only path',
            'All screens navigable by gamepad D-pad + Face buttons — no analog-stick-only nav',
            'Focus ring: unified .focus-ring token (var(--focus-accent)); never hand-rolled ring styles',
            'AA contrast on all text, button labels, and icon overlays on dark backgrounds',
            'Button states (default / hover / focus / disabled) distinguished by shape + brightness, not color alone (colorblind-safe)',
            'Reduce Motion flag: when set, all WA_ widget animations are skipped (instant toggle) — no layout shift',
            'UI font scales with global font-size setting (14–24 pt range); no fixed pixel font sizes',
            'No timed interactions in any menu — all inputs wait indefinitely for player',
            'Death Screen readable by screenreader-compatible widget names (AccessibleText set on all WBP_ roots)',
            'Settings panel: every hold-duration control (Volume slider hold) exposes a step-increment alternative (arrow key ±5%)',
            'Controller: Pause accessible from all screens via IA_Pause (no screen traps)',
          ],
        },
      }),
      accept: minCount('a11yChecks', '≥1 accessibility check listed', 1),
    },

    // ── 8. Localization ──────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Localization',
      view: { kind: 'checklist', field: 'locChecks' },
      produce: (e: LabEntity) => ({
        data: {
          locChecks: [
            `UI_${slug(e.name).toUpperCase()}_MAINMENU_NEWGAME: "New Game"`,
            `UI_${slug(e.name).toUpperCase()}_MAINMENU_CONTINUE: "Continue"`,
            `UI_${slug(e.name).toUpperCase()}_MAINMENU_SETTINGS: "Settings"`,
            `UI_${slug(e.name).toUpperCase()}_MAINMENU_QUIT: "Quit"`,
            `UI_${slug(e.name).toUpperCase()}_QUITCONFIRM_TITLE: "Are you sure?"`,
            `UI_${slug(e.name).toUpperCase()}_QUITCONFIRM_CONFIRM: "Quit to Desktop"`,
            `UI_${slug(e.name).toUpperCase()}_QUITCONFIRM_CANCEL: "Cancel"`,
            `UI_${slug(e.name).toUpperCase()}_PAUSE_RESUME: "Resume"`,
            `UI_${slug(e.name).toUpperCase()}_PAUSE_SETTINGS: "Settings"`,
            `UI_${slug(e.name).toUpperCase()}_PAUSE_SAVE: "Save Game"`,
            `UI_${slug(e.name).toUpperCase()}_PAUSE_QUITTOMAIN: "Quit to Main Menu"`,
            `UI_${slug(e.name).toUpperCase()}_DEATH_RESPAWN: "Respawn"`,
            `UI_${slug(e.name).toUpperCase()}_DEATH_QUITTOMAIN: "Quit to Main Menu"`,
          ],
          locNotes:
            'Keys authored in Content/Localization/UI/ScreenFlow.csv. ' +
            'German expansion ~135%: button text must fit in WBP_MenuButton at maximum expansion. ' +
            'Overflow guard: WBP_MenuButton uses SizeBox with MaxDesiredWidth; text wraps to 2 lines (no clipping). ' +
            'Japanese/Chinese ~85–90% (CJK text is compact): no overflow risk. ' +
            'All keys follow UI_<SCREEN>_<ELEMENT> convention (canon proj-naming).',
        },
      }),
      accept: minCount('locChecks', '≥1 localization key defined', 1),
    },

    // ── 9. Icon 2D Art ────────────────────────────────────────────────────────
    // Universal Icon step — every row includes this (AUTHORING.md §3).
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-source' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_ScreenFlowIcon`],
      }),
      accept: selected('selected', 'A screen flow icon is selected'),
    },

    // ── 10. Test Gate ────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'Launch game → WBP_MainMenu is visible; New Game / Continue / Settings / Quit buttons present',
            'New Game → character creation scene loads → InGame HUD active (in_game terminal reached)',
            'IA_OpenInventory → WBP_InventoryOverlay opens (z-depth 3); HUD behind at 50% opacity',
            'IA_OpenInventory toggle / IA_Back → WBP_InventoryOverlay closes; HUD fully visible',
            'IA_OpenCharStats → WBP_CharStatsOverlay opens; mutually exclusive with Inventory',
            'IA_Pause → WBP_PauseMenu opens; game time frozen (SetGlobalTimeDilation 0)',
            'Pause → Resume → game time restored; HUD active; InputMode = Game',
            'Pause → Quit to Main Menu → WBP_MainMenu shown; save flushed',
            'Player death → WBP_DeathScreen shown; Respawn → InGame HUD at last checkpoint',
            'All 13 screens reachable from main_menu via automated navigation walk in PIE',
            'Back-stack correct: no orphaned overlays after rapid open/close cycles',
          ],
        },
      }),
      accept: runtimeDeferred('VSScreenFlowTest', 'All screens reachable + back-stack correct in PIE'),
    },

    // ── 11. UE Packaging ─────────────────────────────────────────────────────
    // Wiring contract per arpg-wiring-contract canon.
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          'WBP_MainMenu',
          'WBP_InGameHUD',
          'WBP_InventoryOverlay',
          'WBP_CharStatsOverlay',
          'WBP_PauseMenu',
          'WBP_DeathScreen',
          'WBP_SettingsPanel',
          'WBP_QuitConfirmDialog',
          `T_${s}_ScreenFlowIcon`,
          'IMC_Navigation',
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `AARPGHUD (HUD class, GameMode-assigned) owns WBP_InGameHUD as root widget. ` +
                `UARPGHUDContext manages the screen stack (push/pop/replace). ` +
                `UARPGInputModeComponent (on AARPGPlayerController) drives ` +
                `SetInputModeGameOnly / SetInputModeUIOnly / SetInputModeGameAndUI on screen transitions. ` +
                `All WBP_ class references are set in ProjectSettings → ARPG → HUDWidgetClasses (never C++ hardcode). ` +
                `IMC_Navigation mapping context provides IA_OpenInventory, IA_OpenCharStats, IA_Pause, IA_Confirm, IA_Back.`,
              activatedBy:
                `GameMode::BeginPlay → AARPGHUD::BeginPlay → AddToViewport(WBP_MainMenu, ZOrder=5). ` +
                `Player navigates via Enhanced Input Actions → UARPGHUDContext::Push/Pop → ` +
                `CreateWidget + AddToViewport(ZOrder) or RemoveFromParent. ` +
                `Death: AARPGCharacter::OnDeath → AARPGHUD::ShowDeathScreen(ZOrder=4). ` +
                `InputMode restored to Game on any overlay close.`,
              dependencies: [
                'hud-elements (hud-health-bar — WBP_HealthBar binding in WBP_InGameHUD, canon proj-hud-binding)',
                'input-schemes (IMC_Navigation mapping context; IA_ actions must be registered)',
                'icon-sets (iconset-abilities — T_<slug>_ScreenFlowIcon source family)',
              ],
              verification:
                `L2: all WBP_ assets in /Game/UI/; UARPGHUDContext.cpp + UARPGInputModeComponent.cpp ` +
                `compiled; IMC_Navigation asset present; T_${s}_ScreenFlowIcon in /Game/UI/Icons/; ` +
                `L3: VSScreenFlowTest — all 13 screens reachable + back-stack correct in PIE (deferred)`,
            },
          },
          ueAssets: assets.map((a) => `/Game/UI/${a}`),
        };
      },
      accept: minCount('assets', '≥3 UE screen flow assets packaged', 3),
    },
  ],
});
