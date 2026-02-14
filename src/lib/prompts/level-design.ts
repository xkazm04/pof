import type { RoomNode, LevelDesignDocument, SyncDivergence } from '@/types/level-design';
import { buildProjectContextHeader, getModuleName, type ProjectContext } from '@/lib/prompt-context';
import type { StreamingZonePlannerConfig, StreamingZone, ZoneTransition } from '@/components/modules/content/level-design/StreamingZonePlanner';
import type { ProceduralLevelConfig } from '@/components/modules/content/level-design/ProceduralLevelWizard';

export function buildRoomCodegenPrompt(room: RoomNode, doc: LevelDesignDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const spawnLines = room.spawnEntries.map((s) =>
    `  - ${s.enemyClass} x${s.count}, wave ${s.wave}, delay ${s.spawnDelay}s`
  ).join('\n');

  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate the code files directly — do NOT ask for confirmation.',
    ],
  });

  return `${header}

## Task: Room Spawn Code Generation

LEVEL: ${doc.name}
ROOM: ${room.name}
TYPE: ${room.type}
DIFFICULTY: ${room.difficulty}/5
PACING: ${room.pacing}

DESCRIPTION:
${room.description}

ENCOUNTER DESIGN:
${room.encounterDesign}

SPAWN ENTRIES:
${spawnLines || '(none defined)'}

INSTRUCTIONS:
1. Create a spawn manager class for this room (e.g., A${room.name.replace(/\s+/g, '')}SpawnManager)
2. Use UE5 best practices: UPROPERTY(EditAnywhere), UFUNCTION(BlueprintCallable)
3. Implement wave-based spawning if multiple waves are defined
4. Add difficulty scaling parameters
5. Include spawn point references (TArray<AActor*> SpawnPoints)
6. Create both .h and .cpp files
7. Files should go in Source/${moduleName}/LevelDesign/`;
}

export function buildSyncCheckPrompt(doc: LevelDesignDocument, ctx: ProjectContext): string {
  const roomSummary = doc.rooms.map((r) =>
    `  - ${r.name} (${r.type}, diff ${r.difficulty}): ${r.linkedFiles.join(', ') || 'no linked files'}`
  ).join('\n');

  const header = buildProjectContextHeader(ctx, {
    includeBuildCommand: false,
    extraRules: [
      'Do NOT modify any project files — this is a read-only sync check.',
      'Focus only on comparing doc vs code.',
    ],
  });

  return `${header}

## Task: Level Design Sync Check

LEVEL DESIGN DOC: ${doc.name}
ROOMS:
${roomSummary}

INSTRUCTIONS:
1. For each room with linked files, read the C++ files and compare against the design doc
2. Check: spawn counts match, enemy classes match, wave configuration matches, difficulty parameters match
3. Output a JSON array of divergences to stdout in this format:
[
  {
    "roomId": "room-xxx",
    "roomName": "Room Name",
    "field": "spawnCount",
    "docValue": "5",
    "codeValue": "3",
    "severity": "warning",
    "suggestion": "Update SpawnCount in code from 3 to 5 to match design doc"
  }
]

4. If everything is in sync, output an empty array: []
5. Write the JSON to: ${ctx.projectPath}/.pof/level-design-sync.json`;
}

export function buildReconcilePrompt(divergence: SyncDivergence, doc: LevelDesignDocument, ctx: ProjectContext): string {
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Make the minimal change needed to reconcile this divergence.',
    ],
  });

  return `${header}

## Task: Reconcile Level Design Divergence

DIVERGENCE:
- Room: ${divergence.roomName}
- Field: ${divergence.field}
- Design Doc Value: ${divergence.docValue}
- Code Value: ${divergence.codeValue}
- Severity: ${divergence.severity}
- Suggested Fix: ${divergence.suggestion}

INSTRUCTIONS:
1. Update the C++ code to match the design document value
2. Preserve the existing code structure and style
3. Only change the specific divergent field
4. Verify the fix compiles`;
}

export function buildNarrativeCodegenPrompt(doc: LevelDesignDocument, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);

  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Include a data-driven approach for easy iteration.',
    ],
  });

  return `${header}

## Task: Full Level Spawn System Generation

LEVEL: ${doc.name}
DESCRIPTION: ${doc.description}

DESIGN NARRATIVE:
${doc.designNarrative}

ROOMS (${doc.rooms.length}):
${doc.rooms.map((r) => `  - ${r.name}: ${r.type}, difficulty ${r.difficulty}, pacing ${r.pacing}
    Description: ${r.description}
    Encounters: ${r.encounterDesign}
    Spawns: ${r.spawnEntries.map((s) => `${s.enemyClass}x${s.count} W${s.wave}`).join(', ') || 'none'}`
  ).join('\n')}

CONNECTIONS:
${doc.connections.map((c) => {
    const from = doc.rooms.find((r) => r.id === c.fromId)?.name ?? c.fromId;
    const to = doc.rooms.find((r) => r.id === c.toId)?.name ?? c.toId;
    return `  - ${from} ${c.bidirectional ? '<->' : '->'} ${to}${c.condition ? ` (${c.condition})` : ''}`;
  }).join('\n')}

PACING NOTES: ${doc.pacingNotes}

INSTRUCTIONS:
1. Create a LevelManager class that orchestrates all rooms
2. Create individual SpawnManager subclasses per room
3. Implement room transitions based on connections
4. Add difficulty arc progression
5. All files go in Source/${moduleName}/LevelDesign/
6. Use UE5 best practices, UPROPERTY/UFUNCTION macros`;
}

// ── Streaming Zone Planner ──

const ZONE_TYPE_LABELS: Record<string, string> = {
  'town': 'Town',
  'forest': 'Forest',
  'ruins': 'Ruins',
  'catacombs': 'Catacombs',
  'boss-arena': 'Boss Arena',
  'hub': 'Hub',
  'dungeon': 'Dungeon',
  'custom': 'Custom',
};

const TRANSITION_LABELS: Record<string, string> = {
  'seamless': 'Seamless (no loading screen)',
  'loading-screen': 'Loading Screen',
  'fade': 'Fade to Black',
  'portal': 'Portal / Teleport',
};

export function buildStreamingZonePrompt(config: StreamingZonePlannerConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Each zone must be a separate UE5 streaming level.',
      'Use ULevelStreamingDynamic for runtime loading when possible.',
    ],
  });

  const zoneLines = config.zones
    .map((z) => {
      const typeLabel = ZONE_TYPE_LABELS[z.type] ?? z.type;
      return `  - **${z.name}** (${typeLabel}) at grid (${z.gridX}, ${z.gridY})\n` +
        `    Load priority: ${z.loadPriority} | Always loaded: ${z.alwaysLoaded ? 'yes' : 'no'} | Preload radius: ${z.preloadRadius} cells`;
    })
    .join('\n');

  const transitionLines = config.transitions
    .map((t) => {
      const from = config.zones.find((z) => z.id === t.fromId);
      const to = config.zones.find((z) => z.id === t.toId);
      if (!from || !to) return null;
      const styleLabel = TRANSITION_LABELS[t.style] ?? t.style;
      const condLine = t.condition ? ` | Condition: "${t.condition}"` : '';
      return `  - ${from.name} → ${to.name}: ${styleLabel} (${t.triggerType})${condLine}`;
    })
    .filter(Boolean)
    .join('\n');

  const alwaysLoadedZones = config.zones.filter((z) => z.alwaysLoaded);
  const streamedZones = config.zones.filter((z) => !z.alwaysLoaded);

  return `${header}

## Task: Complete Level Streaming System with Zone Layout

Build a full level streaming system for UE5 based on the zone layout below. Each zone is a separate streaming level with configurable loading behavior.

### Zone Layout (${config.zones.length} zones on ${config.gridSize}×${config.gridSize} grid)

${zoneLines}

### Zone Transitions (${config.transitions.length})

${transitionLines}

### Persistent Zones (always loaded)
${alwaysLoadedZones.length > 0
  ? alwaysLoadedZones.map((z) => `  - ${z.name} (${ZONE_TYPE_LABELS[z.type] ?? z.type})`).join('\n')
  : '  (none)'}

### Streamed Zones (loaded/unloaded dynamically)
${streamedZones.length > 0
  ? streamedZones.map((z) => `  - ${z.name} — priority: ${z.loadPriority}, preload radius: ${z.preloadRadius}`).join('\n')
  : '  (none)'}

### Required Files (all under Source/${moduleName}/World/Streaming/)

1. **EWorldZone** enum
   - Values: ${config.zones.map((z) => z.name.replace(/[^a-zA-Z0-9]/g, '')).join(', ')}
   - Used to identify zones throughout the streaming system

2. **FStreamingZoneDefinition** (USTRUCT)
   - ZoneName (FName), ZoneType (enum), LevelAsset (TSoftObjectPtr<UWorld>)
   - GridPosition (FIntPoint), LoadPriority (enum), bAlwaysLoaded (bool)
   - PreloadRadius (int32), bIsLoaded (bool, runtime state)

3. **UStreamingZoneDataAsset** (UDataAsset)
   - TArray<FStreamingZoneDefinition> Zones — the zone table
   - TArray<FZoneTransition> Transitions — defines all zone boundaries
   - Lookup: GetZoneAt(FIntPoint), GetAdjacentZones(EWorldZone), GetTransition(EWorldZone From, EWorldZone To)

4. **UWorldStreamingManager** (UGameInstanceSubsystem)
   - Central manager that handles all streaming operations:
     a. **Zone Loading**: LoadZone(), UnloadZone(), IsZoneLoaded()
     b. **Proximity Preloading**: Reads player grid position, preloads zones within each zone's preload radius
     c. **Priority Queue**: Loads high-priority zones first, low-priority zones are deferred
     d. **Always-Loaded Management**: Persistent zones loaded on startup, never unloaded
     e. **Transition Handling**: Manages screen transitions (fade, loading screen, seamless) per zone boundary
   - Public API (all UFUNCTION(BlueprintCallable)):
     - RequestZoneLoad(EWorldZone Zone)
     - RequestZoneUnload(EWorldZone Zone, float Delay = 0.f)
     - TravelToZone(EWorldZone Target) — handles transition style automatically
     - GetCurrentZone() → EWorldZone
     - IsZoneLoaded(EWorldZone) → bool
     - GetLoadProgress(EWorldZone) → float (0-1)
   - Delegates: OnZoneLoaded, OnZoneUnloaded, OnZoneTransitionStart, OnZoneTransitionComplete

5. **AStreamingVolumeTrigger** (AActor with UBoxComponent)
   - Placed at zone boundaries
   - Configurable: FromZone, ToZone, TransitionStyle, TriggerType
   - Proximity triggers: BeginOverlap starts preload, EndOverlap with timer starts unload
   - Interaction triggers: Player presses interact to transition
   - Automatic triggers: Immediate load on overlap

6. **UZoneTransitionWidget** (UUserWidget)
   - Loading screen widget shown during loading-screen transitions
   - Fade widget for fade transitions
   - Progress bar driven by GetLoadProgress()
   - Zone name / artwork display area
   - Automatically hidden when load completes

7. **AZonePortal** (AActor)
   - Visual portal actor for portal-style transitions
   - Particle effect + sound cue references
   - Calls WorldStreamingManager->TravelToZone() on interaction

### Streaming Architecture
\`\`\`
Player moves through world
  → AStreamingVolumeTrigger overlap detected
    → UWorldStreamingManager.RequestZoneLoad(adjacent zone)
      → Priority queue orders the load
        → ULevelStreamingDynamic loads the streaming level
          → OnZoneLoaded fires, reveals the zone
            → Player crosses boundary
              → Transition style applied (fade/load/seamless)
                → Previous zone unloaded after delay
\`\`\`

### UE5 Best Practices
- Use ULevelStreamingDynamic for all non-persistent levels
- ALevelStreamingVolume for proximity-based streaming triggers
- Async loading via FStreamableManager for zone assets
- GC-friendly: unload zones after a configurable delay (not immediately)
- Network: replicate zone load state for multiplayer readiness
- All public methods UFUNCTION(BlueprintCallable)
- Use TSoftObjectPtr<UWorld> for level references (avoid hard loading all maps)
- Profile with stat streaming to verify load/unload timing`;
}

// ── Procedural Level Generation Wizard ──

const ALGORITHM_DETAILS: Record<string, { name: string; description: string; keyParams: string }> = {
  bsp: {
    name: 'Binary Space Partitioning (BSP)',
    description: 'Recursively partition the grid into sub-regions, place rooms in leaf nodes, then connect with corridors along partition boundaries.',
    keyParams: 'MinRoomSize, MaxRoomSize, SplitRatio, CorridorPadding',
  },
  wfc: {
    name: 'Wave Function Collapse (WFC)',
    description: 'Define tile adjacency rules, start from a single collapsed tile, and propagate constraints until the entire grid is resolved. Backtrack on contradictions.',
    keyParams: 'TileSet, AdjacencyRules, CollapseStrategy (lowest-entropy-first), MaxBacktrackAttempts',
  },
  cellular: {
    name: 'Cellular Automata',
    description: 'Initialize grid with random fill (e.g., 45% walls). Apply birth/death rules for N iterations: cell becomes wall if neighbors >= BirthThreshold, stays wall if neighbors >= SurvivalThreshold.',
    keyParams: 'InitialFillPercent, BirthThreshold (5), SurvivalThreshold (4), Iterations (4-6), SmoothingPasses',
  },
  perlin: {
    name: 'Perlin Noise',
    description: 'Sample multi-octave Perlin noise at each grid cell. Threshold to classify terrain: below WaterLevel = water, below GroundLevel = ground, above MountainLevel = mountains.',
    keyParams: 'Octaves (4-6), Persistence (0.5), Lacunarity (2.0), Scale, WaterLevel, MountainLevel',
  },
};

const LEVEL_TYPE_DETAILS: Record<string, { name: string; structures: string }> = {
  dungeon: {
    name: 'Dungeon (Rooms + Corridors)',
    structures: 'Rectangular rooms with doors, L-shaped and straight corridors, locked gates requiring keys, dead ends with treasure, loops for multiple paths.',
  },
  openworld: {
    name: 'Open World Terrain',
    structures: 'Biome regions (forest, desert, snow), roads connecting POIs, villages/camps, resource nodes, elevation changes, water bodies.',
  },
  arena: {
    name: 'Arena / Combat Space',
    structures: 'Central arena area, cover objects (pillars, walls, crates), elevated positions, choke points, spawn alcoves around perimeter, phase-transition barriers.',
  },
};

export function buildProceduralLevelPrompt(config: ProceduralLevelConfig, ctx: ProjectContext): string {
  const moduleName = getModuleName(ctx.projectName);
  const header = buildProjectContextHeader(ctx, {
    extraRules: [
      'Generate all code files directly — do NOT ask for confirmation.',
      'Use UE5 C++ best practices for procedural generation.',
      'The system must be deterministic with a seed parameter.',
      'All generation parameters must be UPROPERTY(EditAnywhere) for designer iteration.',
    ],
  });

  const algInfo = ALGORITHM_DETAILS[config.algorithm];
  const ltInfo = LEVEL_TYPE_DETAILS[config.levelType];

  const enabledConstraints = Object.entries(config.constraints)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const constraintLines = enabledConstraints.length > 0
    ? enabledConstraints.map((c) => {
        switch (c) {
          case 'spawnPoints': return '- **Spawn Points**: Player start position + enemy spawn locations distributed by room difficulty';
          case 'lootPlacement': return '- **Loot Placement**: Treasure chests in dead-ends, item drops scaled by room difficulty, loot room at 60-70% progression';
          case 'bossRoom': return '- **Boss Room**: Largest room, placed farthest from start, single entry corridor, arena-sized with cover';
          case 'secretRooms': return '- **Secret Rooms**: 1-2 hidden rooms with destructible walls or hidden switches, bonus loot inside';
          case 'safeZones': return '- **Safe Zones**: Rest areas near start and at ~50% progression, no enemy spawns, shop/save functionality';
          default: return `- **${c}**`;
        }
      }).join('\n')
    : '- No specific gameplay constraints selected.';

  return `${header}

## Task: Procedural Level Generation System

Generate a complete C++ procedural level generation system using **${algInfo.name}** for a **${ltInfo.name}** layout.

### Algorithm: ${algInfo.name}
${algInfo.description}

Key parameters: ${algInfo.keyParams}

### Level Type: ${ltInfo.name}
${ltInfo.structures}

### Size Parameters
- Grid dimensions: **${config.size.gridWidth} x ${config.size.gridHeight}** cells
- Room count: **${config.size.roomCountMin}** to **${config.size.roomCountMax}** rooms
- Corridor width: **${config.size.corridorWidth}** cells
${config.seed ? `- Seed: **${config.seed}**` : '- Seed: **Random** (generate via FMath::Rand())'}

### Gameplay Constraints
${constraintLines}

### Required Files (all under Source/${moduleName}/ProceduralGen/)

1. **F${capitalize(config.levelType)}Cell** (USTRUCT)
   - ECellType enum: Empty, Floor, Wall, Door, Corridor, Spawn, Loot, BossEntrance
   - Position (FIntPoint), RoomId (int32, -1 if corridor), Metadata (TMap<FName, FString>)

2. **F${capitalize(config.levelType)}Room** (USTRUCT)
   - RoomId (int32), Bounds (FIntRect), RoomType (enum: Normal, Start, Boss, Treasure, Secret, Safe)
   - Connections (TArray<int32> — connected room IDs), Difficulty (float 0-1)

3. **U${capitalize(config.algorithm)}Generator** (UObject)
   - Core generation algorithm implementation
   - \`bool Generate(int32 Seed, FGenerationParams Params, TArray<F${capitalize(config.levelType)}Cell>& OutGrid, TArray<F${capitalize(config.levelType)}Room>& OutRooms)\`
   - Deterministic: same seed + params = same output
   - UPROPERTY parameters matching: ${algInfo.keyParams}

4. **FGenerationParams** (USTRUCT)
   - GridWidth (${config.size.gridWidth}), GridHeight (${config.size.gridHeight})
   - RoomCountMin (${config.size.roomCountMin}), RoomCountMax (${config.size.roomCountMax})
   - CorridorWidth (${config.size.corridorWidth}), Seed (int32)
   - All UPROPERTY(EditAnywhere) with sensible ClampMin/ClampMax

5. **ULevelGeneratorSubsystem** (UWorldSubsystem)
   - High-level API that orchestrates generation + placement:
     a. \`FGenerationResult GenerateLevel(FGenerationParams Params)\`
     b. \`void SpawnLevelGeometry(const FGenerationResult& Result)\` — creates ISMCs for walls/floors
     c. \`void PlaceGameplayActors(const FGenerationResult& Result)\` — spawns doors, loot, enemies
     d. \`void ClearLevel()\` — destroys all generated actors
   - Uses Instanced Static Mesh Components for walls/floors (performance)
   - Spawns gameplay actors (doors, chests, spawn points) as individual actors

6. **A${capitalize(config.levelType)}Visualizer** (AActor) — Editor/debug tool
   - Generates and renders the level in-editor for preview
   - UPROPERTY FGenerationParams with "Generate" button (CallInEditor)
   - Debug draw: room IDs, difficulty heat map, connection graph
   - Minimap texture generation from grid data

${enabledConstraints.includes('spawnPoints') ? `7. **USpawnPointDistributor** (UObject)
   - Places player start in the start room
   - Distributes enemy spawns by room difficulty (more spawns in harder rooms)
   - Ensures minimum distance between spawn points
   - Boss room gets dedicated boss spawn point
` : ''}
### UE5 Best Practices
- Use FRandomStream with seed for all random operations (not FMath::Rand)
- ISMC (Instanced Static Mesh Component) for repeated geometry (walls, floors)
- Async generation: run algorithm on background thread, spawn actors on game thread
- Data-driven: all generation parameters in a UDataAsset for easy iteration
- Editor integration: CallInEditor UFUNCTION for one-click regeneration
- Debug visualization: DrawDebugBox/Line in editor for room bounds and connections`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
