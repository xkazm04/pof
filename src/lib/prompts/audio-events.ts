import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type {
  AudioEventCatalogConfig,
  AudioEvent,
  EventCategory,
} from '@/components/modules/content/audio/AudioEventCatalog';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  combat: 'Combat',
  environment: 'Environment',
  ui: 'UI',
  music: 'Music',
};

export function buildAudioEventPrompt(config: AudioEventCatalogConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use MetaSounds for DSP where applicable (UE5 best practice).',
      'The audio manager must integrate with the existing GameplayAbilitySystem for combat event binding.',
    ],
  });

  // Group events by category
  const byCategory = new Map<EventCategory, AudioEvent[]>();
  for (const evt of config.events) {
    if (!byCategory.has(evt.category)) byCategory.set(evt.category, []);
    byCategory.get(evt.category)!.push(evt);
  }

  const categoryBlocks = Array.from(byCategory.entries())
    .map(([cat, events]) => {
      const eventLines = events
        .map((e) =>
          `    - **${e.name}** → \`${e.trigger}\`\n` +
          `      Priority: ${e.priority} | Spatial: ${e.spatial.toUpperCase()} | Max concurrent: ${e.concurrency} | Cooldown: ${e.cooldownMs}ms\n` +
          `      Tags: [${e.tags.join(', ')}]`
        )
        .join('\n');
      return `  ### ${CATEGORY_LABELS[cat]} Events (${events.length})\n${eventLines}`;
    })
    .join('\n\n');

  // Count spatial modes
  const spatial3d = config.events.filter((e) => e.spatial === '3d').length;
  const spatial2d = config.events.filter((e) => e.spatial === '2d').length;

  // Unique triggers
  const allTriggers = config.events.map((e) => e.trigger);
  const uniqueTriggers = [...new Set(allTriggers)];

  // Priority distribution
  const priorities = config.events.reduce<Record<string, number>>((acc, e) => {
    acc[e.priority] = (acc[e.priority] || 0) + 1;
    return acc;
  }, {});

  return `${header}

## Task: Complete Audio Event System with Manager, Pooling & MetaSounds Integration

Build a comprehensive event-driven audio system modeled after FMOD/Wwise's event architecture.
The system maps game events to categorized sound events with priority, spatial settings, and concurrency control.

### Event Catalog (${config.events.length} events total)

${categoryBlocks}

### System Statistics
- **Spatial distribution**: ${spatial3d} 3D spatial events, ${spatial2d} 2D stereo events
- **Priority distribution**: ${Object.entries(priorities).map(([p, n]) => `${p}: ${n}`).join(', ')}
- **Unique triggers**: ${uniqueTriggers.length} (${uniqueTriggers.join(', ')})

### Required Files (all under Source/${moduleName}/Audio/)

1. **EAudioEventCategory** enum
   - Values: ${Array.from(byCategory.keys()).map((c) => CATEGORY_LABELS[c]).join(', ')}
   - Used to route events to the correct subsystem

2. **EAudioEventPriority** enum
   - Values: Low, Normal, High, Critical
   - Controls voice stealing and queue behavior

3. **FAudioEventDefinition** (USTRUCT)
   - EventName (FName), Category, TriggerDelegate name, Priority, SpatialMode (2D/3D)
   - MaxConcurrentInstances (int32), CooldownMs (float)
   - SoundCue (TSoftObjectPtr<USoundBase>), Tags (TArray<FName>)

4. **UAudioEventDataAsset** (UDataAsset)
   - TArray<FAudioEventDefinition> Events — the catalog table
   - Lookup helpers: FindByName(), FindByTrigger(), GetEventsByCategory()

5. **UAudioEventManager** (UGameInstanceSubsystem)
   - Central audio manager with:
     a. **Sound Pool**: Pre-allocated pool of UAudioComponent instances
        - Pool size configurable via data asset
        - Acquire/Release pattern with automatic return on completion
     b. **Priority Queue**: When pool is exhausted, steal from lowest-priority active sound
     c. **Concurrency Limiter**: Per-event max instances (from catalog), oldest-steal on overflow
     d. **Cooldown Tracker**: Per-event cooldown timers preventing rapid re-triggers
     e. **Category Volumes**: SFX, Ambient, Music, UI volume multipliers (saved to settings)
   - Public API (all UFUNCTION(BlueprintCallable)):
     - PlayEvent(FName EventName, FVector Location = FVector::ZeroVector)
     - PlayEventAttached(FName EventName, USceneComponent* AttachTo)
     - StopEvent(FName EventName, float FadeOutDuration = 0.2f)
     - StopAllInCategory(EAudioEventCategory Category, float FadeOutDuration = 0.5f)
     - SetCategoryVolume(EAudioEventCategory Category, float Volume)
     - GetCategoryVolume(EAudioEventCategory Category) → float

6. **UAudioEventListenerComponent** (UActorComponent)
   - Attach to any actor to bind game events to audio events
   - Auto-binds to GAS delegates for combat events (OnAbilityActivated, etc.)
   - Reads trigger names from the catalog to set up dynamic multicast bindings
   - Handles spatial mode: 3D events play at actor location, 2D events play globally

7. **UMusicLayerController** (UActorComponent)
   - Manages music layer events: crossfade, stack, ducking
   - Reads music-category events from the catalog
   - Implements layer blending: combat layer overrides exploration, boss overrides all
   - Smooth transitions with configurable fade times
   - Uses MetaSounds for real-time parameter control on music layers

8. **MetaSounds Integration**
   - Create MetaSoundSource patches for parametric sound events:
     - Combat impacts: randomized pitch/volume, surface-material variation
     - Footsteps: surface detection → MetaSounds material selector
     - Ambient: procedural wind/rain generators using MetaSounds oscillators
   - MetaSounds parameters driven by UAudioEventManager at runtime

### Event Binding Architecture
\`\`\`
Game Event (GAS/Interaction/UI)
  → UAudioEventListenerComponent detects trigger
    → Looks up FAudioEventDefinition in catalog
      → UAudioEventManager.PlayEvent()
        → Priority check → Concurrency check → Cooldown check
          → Acquire pooled UAudioComponent
            → Apply spatial settings (2D/3D)
              → Play sound
\`\`\`

### UE5 Best Practices
- All public methods UFUNCTION(BlueprintCallable)
- Use TSoftObjectPtr for sound asset references (async loading)
- Pool UAudioComponents in BeginPlay, never spawn at runtime
- Category volumes saved via USaveGame integration
- MetaSounds parameters exposed as UPROPERTY for designer tuning
- Thread-safe cooldown tracking for events triggered from gameplay threads`;
}
