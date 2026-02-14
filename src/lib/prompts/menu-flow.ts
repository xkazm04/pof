import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { MenuFlowConfig, ScreenNode, ScreenTransition, ScreenType } from '@/components/modules/content/ui-hud/MenuFlowDiagram';

const SCREEN_TYPE_OWNERSHIP: Record<ScreenType, string> = {
  'main-menu':  'GameInstance',
  'settings':   'GameInstance',
  'pause-menu': 'PlayerController',
  'hud':        'PlayerController',
  'loading':    'GameInstance',
  'splash':     'GameInstance',
  'popup':      'PlayerController',
  'custom':     'PlayerController',
};

const SCREEN_TYPE_LABELS: Record<ScreenType, string> = {
  'main-menu':  'Main Menu',
  'settings':   'Settings Screen',
  'pause-menu': 'Pause Menu',
  'hud':        'HUD Overlay',
  'loading':    'Loading Screen',
  'splash':     'Splash Screen',
  'popup':      'Popup / Modal',
  'custom':     'Custom Screen',
};

export function buildMenuFlowPrompt(config: MenuFlowConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Each screen must be a separate UUserWidget subclass with a corresponding C++ class.',
      'The navigation controller must manage all screen transitions via a central stack-based system.',
    ],
  });

  const screenLines = config.screens
    .map((s) => {
      const ownership = SCREEN_TYPE_OWNERSHIP[s.type];
      const widgetList = s.widgets.length > 0
        ? s.widgets.map((w) => `    - ${w}`).join('\n')
        : '    - (no widgets defined)';
      return `  - **${s.name}** (${SCREEN_TYPE_LABELS[s.type]}) — owned by ${ownership}\n    Widgets:\n${widgetList}`;
    })
    .join('\n\n');

  const transitionLines = config.transitions
    .map((t) => {
      const fromScr = config.screens.find((s) => s.id === t.fromId);
      const toScr = config.screens.find((s) => s.id === t.toId);
      if (!fromScr || !toScr) return null;
      const dir = t.bidirectional ? '⟷' : '→';
      return `  - ${fromScr.name} ${dir} ${toScr.name} (trigger: "${t.trigger}")`;
    })
    .filter(Boolean)
    .join('\n');

  // Group screens by ownership for architecture clarity
  const byOwnership = new Map<string, ScreenNode[]>();
  for (const scr of config.screens) {
    const owner = SCREEN_TYPE_OWNERSHIP[scr.type];
    if (!byOwnership.has(owner)) byOwnership.set(owner, []);
    byOwnership.get(owner)!.push(scr);
  }

  const ownershipSection = Array.from(byOwnership.entries())
    .map(([owner, screens]) =>
      `  - **${owner}**: ${screens.map((s) => s.name).join(', ')}`
    )
    .join('\n');

  const screenClassNames = config.screens
    .map((s) => {
      const className = `U${s.name.replace(/[^a-zA-Z0-9]/g, '')}Widget`;
      return `  - ${className} (.h/.cpp) — ${SCREEN_TYPE_LABELS[s.type]}`;
    })
    .join('\n');

  return `${header}

## Task: Menu Navigation System with Screen Flow

Build a complete menu navigation system for UE5 UMG with a central navigation controller that manages all screen transitions.

### Screen Hierarchy

${screenLines}

### Navigation Transitions

${transitionLines}

### Ownership Model

${ownershipSection}

### Required Files (all under Source/${moduleName}/UI/Menus/)

1. **UMenuNavigationController** (.h/.cpp)
   - Singleton-style subsystem (UGameInstanceSubsystem or component on PlayerController depending on scope)
   - Stack-based screen management: PushScreen(), PopScreen(), PopToRoot()
   - Manages all transitions defined above
   - UFUNCTION(BlueprintCallable) for all navigation methods
   - Fires delegates on screen changes (OnScreenPushed, OnScreenPopped)
   - Handles input mode switching (UI-only vs Game+UI vs Game-only)
   - Z-order management for overlapping screens

2. **Screen Widget Classes**
${screenClassNames}

   Each screen widget must:
   - Inherit from a shared UMenuScreenBase widget class
   - Have UPROPERTY(meta=(BindWidget)) references to child widgets
   - Call NavigationController->PushScreen()/PopScreen() for transitions
   - Implement Enter/Exit animations (fade, slide) via UWidgetAnimation
   - Handle its own input bindings (e.g., Escape to go back)

3. **UMenuScreenBase** (.h/.cpp)
   - Base class for all menu screen widgets
   - Virtual Enter()/Exit() methods with animation support
   - Back button handling (pops the screen stack)
   - Common styling setup in NativeConstruct

4. **EMenuScreenType** enum
   - One entry per screen: ${config.screens.map((s) => s.name.replace(/[^a-zA-Z0-9]/g, '')).join(', ')}
   - Used by NavigationController to identify and instantiate screens

### Transition Behavior
- Push transitions play an "enter" animation on the new screen and "exit" on the old
- Pop transitions reverse: "exit" on current, "re-enter" on the revealed screen
- ${config.transitions.some((t) => t.bidirectional) ? 'Bidirectional transitions allow both push and pop navigation between those screens' : 'All transitions are one-directional — use back/pop to return'}
- Loading screens should block input until loading completes
- Pause menu should pause game time (SetGamePaused)

### UE5 Best Practices
- All widgets created in C++ with UPROPERTY(meta=(BindWidget)) for UMG designer access
- Use TSubclassOf<UMenuScreenBase> for screen class references in the controller
- NativeConstruct / NativeDestruct for setup/teardown
- Input mode transitions: FInputModeUIOnly for menus, FInputModeGameAndUI for HUD overlays
- All public methods UFUNCTION(BlueprintCallable)
- Use soft references (TSoftClassPtr) for screen classes to avoid hard loading all menus at startup`;
}
