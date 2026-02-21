/**
 * CLI Skill Packs — domain knowledge injected into Claude prompts
 * based on detected project sub-genre patterns.
 *
 * Each skill pack provides deep, actionable context for a specific
 * gameplay domain so Claude CLI can generate better code without
 * the user manually specifying what kind of game they're building.
 */

import type { SubGenreId, GameplayPattern } from '@/types/telemetry';

// ── Skill definitions ──────────────────────────────────────────────────────

export type SkillId =
  | 'souls-combat'
  | 'character-action-combat'
  | 'loot-itemization'
  | 'projectile-systems'
  | 'squad-tactics'
  | 'open-world-streaming'
  | 'roguelite-procedural'
  | 'survival-crafting'
  | 'networking-replication'
  | 'performance-optimization'
  | 'pcg-procedural'
  | 'state-tree-ai';

interface SkillPack {
  id: SkillId;
  label: string;
  /** Concise domain knowledge injected as prompt prefix */
  context: string;
}

const SKILL_PACKS: Record<SkillId, SkillPack> = {
  'souls-combat': {
    id: 'souls-combat',
    label: 'Souls-like Combat',
    context: `## Skill: Souls-like Combat Systems
- **Poise/Stagger**: Each hit reduces Poise by StaggerDamage. When Poise=0, apply Staggered tag and play long stagger montage enabling a riposte window. Poise regenerates after 3s of no hits via GE_PoiseRegen.
- **Stamina management**: Every action costs stamina (light attack 20, heavy 35, dodge 25, block variable, sprint 10/sec). After any spend, pause regen 0.8s then regen at 30/sec. When empty: attacks are weak, dodge fails, guard breaks.
- **I-frame dodge**: GA_Dodge grants brief invulnerability (0.2s window at frames 4-16 of roll montage) via State.Invulnerable tag. Use AbilityTask_PlayMontageAndWait with OnBlendOut.
- **Bonfire checkpoints**: Save respawn point, refill Estus charges, reset non-boss enemies via respawn manager subsystem.
- **Lock-on targeting**: UTargetingComponent with sphere trace, cycle targets with mouse wheel, orbit camera with spring arm offset.
- **Attack commitment**: Once an attack montage begins, it cannot be cancelled except by dodge (and only during specific cancel windows defined by GAS tags).`,
  },

  'character-action-combat': {
    id: 'character-action-combat',
    label: 'Character Action Combat',
    context: `## Skill: Character Action Combat Systems
- **Style ranking**: Track combo variety, hit timing, and damage-without-taking-damage. Map to ranks D→SSS via StyleScore. Rank decays without combat. Higher ranks give XP/loot multiplier.
- **Launcher + Air combos**: GA_Launcher applies upward impulse (300 units). While airborne, allow jump-cancel into air attacks. Air attacks apply slight upward force for juggle. Create 3-hit air combo chain.
- **Combo strings**: Define combo windows via GAS tags (ComboWindow.Open). Input buffering: queue next attack during current montage. Branch to heavy/light/special based on input during window. Combo counter tracks hits for style score.
- **Cancel hierarchy**: Attacks can cancel into dodge, dodge can cancel into jump, specials cancel everything. Use ability tags: Ability.Cancel.Dodge, Ability.Cancel.Jump.
- **Weapon switching**: Instant switch between 2-4 weapon loadouts, each with unique combo trees. Switch during combos for style bonus.`,
  },

  'loot-itemization': {
    id: 'loot-itemization',
    label: 'Loot & Itemization',
    context: `## Skill: Loot & Itemization Systems
- **Affix generation**: Prefix/Suffix pools with tiers T1-T5. Higher item level unlocks higher tiers. Roll affixes weighted by zone type (fire zone → more fire damage). Each affix: FItemAffix { AffixId, Tier, Value, AffixType (Prefix/Suffix) }.
- **Rarity system**: Common(1 affix) → Magic(2) → Rare(4) → Legendary(6 + unique passive). Rarity determines max affix count and base stat multiplier.
- **Drop rate formulas**: BaseDropChance * (1 + MagicFind/100) * ZoneModifier. Diminishing returns above 300% MF. Boss drops use separate guaranteed table + bonus roll table.
- **Loot tables**: TArray<FLootEntry> with weight-based selection. Each entry: ItemClass, MinLevel, MaxLevel, Weight, RarityOverride. Nested tables for tiered drops.
- **Socket/Gem system**: Items have 1-3 sockets based on rarity. Gems provide stats (Ruby=damage, Sapphire=mana, Emerald=crit). Socketing permanent; removing destroys gem. 3 same-tier gems combine to next tier.
- **Item comparison**: Tooltip shows stat deltas vs equipped item in green/red. DPS calculation for weapons, EHP calculation for armor.`,
  },

  'projectile-systems': {
    id: 'projectile-systems',
    label: 'Projectile & Ranged Combat',
    context: `## Skill: Projectile & Ranged Combat
- **Weapon classes**: Rifle (medium fire rate, accurate), Shotgun (slow, spread pattern with 8 pellets), SMG (fast, high spread), Sniper (very slow, scope zoom, no spread). Each has: FireRate, MagSize, ReloadTime, SpreadCone, RecoilPattern.
- **Projectile pooling**: Use object pool for AProjectileBase. Pre-allocate 50-100 projectiles. On fire: dequeue, set velocity, enable collision. On hit/timeout: return to pool, disable.
- **Spread patterns**: Base spread + per-shot bloom + recoil recovery. ADS reduces spread by 60%. Moving increases spread by 40%. Crouching reduces by 20%.
- **Hit detection**: For hitscan weapons use line trace with ServerSideRewind for multiplayer. For projectile weapons use AProjectileMovementComponent with predicted client-side spawn.
- **Cover system**: Line trace to detect cover objects. Snap-to-cover on input. Peek-and-shoot with accuracy bonus. Blind fire with reduced accuracy. AI uses EQS FindCoverPosition.`,
  },

  'squad-tactics': {
    id: 'squad-tactics',
    label: 'Squad & Tactical AI',
    context: `## Skill: Squad Tactics & Companion AI
- **Companion system**: ACompanionCharacter extends enemy base but follows player. Behavior modes: Aggressive/Defensive/Support. Commands: Follow Me, Hold Position, Attack Target, Use Ability.
- **Tactical pause**: On Tab: SetGlobalTimeDilation(0.1). Show tactical overlay with companion positions and enemy highlights. Queue up to 3 actions per companion. On unpause: execute queued actions.
- **Formation system**: Leader-follower with offset positions. Formations: Line, Wedge, Circle. Companions pathfind to formation slots using NavMesh. Break formation on combat engagement.
- **AI coordination**: Squad manager tracks threat priorities. Companions call out enemy positions. Heal/buff priorities based on health percentage. Tank/DPS/Healer role assignment.
- **EQS for positioning**: Custom EQS generators for flanking positions, cover evaluation, and healing range checks. Weight by distance-to-player and threat level.`,
  },

  'open-world-streaming': {
    id: 'open-world-streaming',
    label: 'Open World & Streaming',
    context: `## Skill: Open World Systems
- **World partition**: Use UE5 World Partition with OFPA. Define streaming distances per actor type. Data layers for conditional content (quest-gated areas). Level instancing for dungeons. Custom HLODs for injecting optimized representations (UE 5.7+).
- **POI system**: Discoverable map markers (Camp/Dungeon/Shrine/Vista/Chest). States: undiscovered/discovered/completed. Compass indicator at screen edge. Fog-of-war map reveal on Vista discovery.
- **Mount system**: AARPGMount with mounted movement (speed 1200, sprint 1800). Mount/dismount animation with socket attachment. Basic combat while mounted (light attacks only). Whistle summon from anywhere.
- **Dynamic events**: World event manager spawns timed encounters (caravan attacks, wandering bosses, resource nodes). Events visible on map with countdown timer. Shared rewards for participation.
- **Fast travel**: Discovered POIs become fast travel points. Fade-to-black transition with loading screen. Save player state before teleport. Cooldown between uses.
- **Nanite Foliage (5.7+)**: Use Nanite Assemblies for dense foliage within 60fps budget. Nanite Skinning for skeletal mesh-driven dynamic wind via Dynamic Wind plugin. USD importer support with DCC markup schemas. TSR thin geometry detection for distant vegetation.`,
  },

  'roguelite-procedural': {
    id: 'roguelite-procedural',
    label: 'Roguelite & Procedural',
    context: `## Skill: Roguelite Procedural Systems
- **Meta-progression**: MetaCurrency earned per run (enemies killed, rooms cleared, boss kills). Persists across deaths. Spend at hub to unlock: new abilities (expand pool), stat bonuses, new item types in loot tables.
- **Procedural rooms**: Room templates: Combat, Elite, Shop, Treasure, Boss. Generate run as graph: 5-7 rooms/floor, 3 floors, branching paths. Room selection weighted by difficulty curve. Load as streaming sub-levels.
- **Run state**: FRunState tracks: current floor, rooms cleared, items collected, currency, seed. On death: save meta-currency, clear run state, return to hub. On boss clear: advance floor, offer upgrade choices.
- **Blessing/curse system**: After each room, choose 1 of 3 random upgrades. Upgrades stack multiplicatively. Curse rooms offer powerful upgrades with drawbacks. Synergy detection between upgrades.
- **Seed-based RNG**: FRandomStream seeded per run. All procedural decisions use the stream for deterministic runs. Allow seed sharing for challenge runs.`,
  },

  'survival-crafting': {
    id: 'survival-crafting',
    label: 'Survival & Crafting',
    context: `## Skill: Survival & Crafting Systems
- **Crafting recipes**: UCraftingRecipe data assets: required materials (TArray<FItemQuantity>), output item, station type (None/Workbench/Forge/Alchemy), craft time. UI shows available recipes, highlights craftable, greys out missing materials.
- **Resource gathering**: AHarvestableResource: health pool, required tool type (Axe/Pickaxe/None), TArray<FLootEntry> drops, respawn timer (5 min). Child classes: Tree→Wood, Rock→Stone, Ore→Iron/Gold.
- **Building system**: Snap-based placement with grid alignment. Foundation/Wall/Roof/Door pieces. Material tiers (Wood→Stone→Metal) with increasing health. Structure integrity system: unsupported pieces collapse.
- **Survival stats**: Hunger (decays 1/min, eat food to restore), Thirst (decays 1.5/min), Temperature (environmental + clothing). Debuffs when stats are low: Starving (-50% stamina regen), Dehydrated (-30% max health).
- **Storage/containers**: AStorageChest with inventory grid. Permissions: private/team/public. Auto-sort by item type. Stack splitting and merging.`,
  },

  'networking-replication': {
    id: 'networking-replication',
    label: 'Multiplayer Networking',
    context: `## Skill: UE5 Multiplayer & Replication
- **Legacy replication**: Mark properties with UPROPERTY(Replicated). Use GetLifetimeReplicatedProps with DOREPLIFETIME. For conditional replication use DOREPLIFETIME_CONDITION (COND_OwnerOnly for inventory, COND_SkipOwner for cosmetics).
- **Iris replication (5.7+ Beta)**: Cleaner API replacing UReplicationBridge. Use StartActorReplication as entry point, OnBeginReplication for lifecycle hooks. Actor Factory Overrides via StartReplicationParams. Supports seamless travel for persistent player data across world transitions. Consistent behavior with legacy networking.
- **RPC validation**: Server RPCs (UFUNCTION(Server, Reliable)): validate all inputs server-side, never trust client. Client RPCs: for cosmetic feedback only. Multicast: for effects visible to all (explosions, deaths).
- **NetCullDistance**: Set per actor class. NPCs: 10000. Projectiles: 5000. Cosmetic effects: 3000. Players: 0 (always relevant). Use NetUpdateFrequency to control bandwidth.
- **Ability prediction**: GAS supports client-side prediction via FPredictionKey. Predicted abilities play immediately on owning client, server confirms/corrects. Use AbilityTask_WaitConfirmCancel for charge-up abilities.
- **Session management**: Use UE Online Subsystem. Create/Find/Join sessions. Host migration for listen servers. Dedicated server: stateless, clients connect via lobby matchmaking.`,
  },

  'pcg-procedural': {
    id: 'pcg-procedural',
    label: 'PCG Procedural Generation',
    context: `## Skill: Procedural Content Generation (PCG) Framework (5.7+ Production-Ready)
- **PCG graphs**: Build content-generation graphs in the PCG editor. Nodes operate on point/mesh/spline data. Graphs can execute standalone without world context. Backward compatibility maintained across engine updates.
- **Vegetation (PVE)**: Procedural Vegetation Editor — graph-based tool for high-quality foliage assets. 2x performance vs 5.5. Combine with Nanite Foliage for dense rendering.
- **Custom data types**: Register custom data types for PCG graphs. Built-in Polygon2D type with intersection, union, difference, and offset operators for zone-based generation.
- **GPU acceleration**: GPU Fast Geo Interop leverages FastGeometry for improved game thread performance. Scene Capture node for sampling scene color/depth. Save Texture to Asset node for baking to UTexture2D.
- **Parameter system**: GPU nodes support parameter overrides. Min/max values and units for designer tuning. Type-based pin coloring matching Blueprint visual language.
- **Room/dungeon generation**: Use PCG graph to define room templates (Combat, Elite, Shop, Treasure, Boss). Generate run layouts as point graphs. Connect via spline paths. Spawn as streaming sub-levels.`,
  },

  'state-tree-ai': {
    id: 'state-tree-ai',
    label: 'State Tree AI',
    context: `## Skill: State Tree AI Systems (5.7+)
- **State Tree basics**: Alternative to Behavior Trees for AI logic. Hierarchical state machine with tasks, conditions, and transitions. Preferred for new 5.7+ projects due to better debugging tools.
- **ExecutionRuntimeData**: Persistent, long-lived node data across state transitions. Avoids re-initialization overhead when re-entering states.
- **Re-Enter State Behavior**: Opt-in support for states that need to reset on re-entry. Configure per-state whether to restart or continue.
- **Live Property Binding**: Output Properties enable real-time property binding between states and external systems. Eliminates polling patterns.
- **Rewind Debugger**: Full integration with Rewind Debugger for owner- and instance-oriented debugging. Step backward through state transitions. Preferred over legacy State Tree debugger.
- **Copy/paste workflow**: Cross-asset copy/paste for tasks, conditions, and transitions with intelligent binding handling. Property-level copy/paste preserves references.
- **Migration from BT**: State Tree states map to BT subtrees. Tasks map to BTTasks. Conditions map to Decorators. Services become state-level tasks with tick. EQS queries work identically in both systems.`,
  },

  'performance-optimization': {
    id: 'performance-optimization',
    label: 'Performance Optimization',
    context: `## Skill: UE5 Performance Optimization
- **Actor tick budgeting**: Disable tick on actors that don't need it (SetActorTickEnabled(false)). Use tick intervals for distant actors (SetActorTickInterval(0.5f) for actors >5000 units away). SignificanceManager for LOD-based tick frequency.
- **Niagara optimization**: GPU particle simulation for high counts. Distance-based quality scaling. Shared material instances. Pool emitter components. Budget: max 50k GPU particles, 5k CPU particles. Niagara Particle Lights supported by MegaLights (5.7+).
- **Draw call reduction**: Instanced Static Meshes for repeated objects (debris). Nanite for high-poly meshes. Nanite Foliage (5.7+) for dense vegetation within 60fps budget. Virtual Textures for terrain. Merge actors for non-Nanite static geometry.
- **MegaLights (5.7+ Beta)**: Many dynamic lights with improved performance — ideal for dungeon/interior scenes. Supports directional lights, Niagara particle lights, translucency, and hair strands. Replaces manual light budget limits for supported hardware.
- **Memory budgets**: Texture streaming pool size per platform. LOD groups for skeletal meshes. Audio attenuation to cull distant sounds. Garbage collection interval tuning.
- **Profiling workflow**: Use Unreal Insights for frame timing. stat unit, stat gpu for real-time. CSV profiling for automated regression tests. Target: 16.6ms frame time (60fps), 11.1ms (90fps VR). Build Health Tracking dashboard (5.7+) for monitoring BuildGraph errors.`,
  },
};

// ── Sub-genre → skill mapping ──────────────────────────────────────────────

const SUB_GENRE_SKILLS: Record<SubGenreId, SkillId[]> = {
  'souls-like': ['souls-combat'],
  'character-action': ['character-action-combat'],
  'diablo-like': ['loot-itemization'],
  'arpg-shooter': ['projectile-systems'],
  'tactical-arpg': ['squad-tactics'],
  'open-world-arpg': ['open-world-streaming'],
  'roguelite-arpg': ['roguelite-procedural'],
  'survival-arpg': ['survival-crafting'],
};

/** Standalone patterns that always inject a skill regardless of sub-genre */
const PATTERN_SKILLS: Partial<Record<GameplayPattern, SkillId>> = {
  'multiplayer-sync': 'networking-replication',
  'performance-intensive': 'performance-optimization',
  'procedural-generation': 'pcg-procedural',
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a prompt prefix containing all enabled skill context.
 * Called by useTaskQueue before every new-session prompt.
 */
export function buildSkillsPrompt(skillIds: SkillId[]): string {
  if (skillIds.length === 0) return '';

  const sections = skillIds
    .map((id) => SKILL_PACKS[id])
    .filter(Boolean)
    .map((pack) => pack.context);

  if (sections.length === 0) return '';

  return sections.join('\n\n') + '\n\n';
}

/**
 * Determine which skills should be active based on detected patterns.
 * Uses the genre-evolution-engine's pattern detections and accepted sub-genres.
 *
 * @param patterns — detected gameplay patterns with confidence scores
 * @param acceptedSubGenres — sub-genres the user has accepted (from genre evolution)
 * @param confidenceThreshold — minimum confidence to auto-activate (default 60)
 */
export function resolveSkillsFromPatterns(
  patterns: { pattern: GameplayPattern; confidence: number }[],
  acceptedSubGenres: SubGenreId[],
  confidenceThreshold = 60,
): SkillId[] {
  const skills = new Set<SkillId>();

  // 1. Skills from accepted sub-genres (always active)
  for (const genreId of acceptedSubGenres) {
    const genreSkills = SUB_GENRE_SKILLS[genreId];
    if (genreSkills) {
      for (const s of genreSkills) skills.add(s);
    }
  }

  // 2. Skills from high-confidence pattern detections
  for (const det of patterns) {
    if (det.confidence < confidenceThreshold) continue;

    // Direct pattern → skill mapping
    const directSkill = PATTERN_SKILLS[det.pattern];
    if (directSkill) skills.add(directSkill);

    // Pattern → sub-genre → skills (for patterns that trigger a sub-genre)
    for (const [genreId, genreSkills] of Object.entries(SUB_GENRE_SKILLS)) {
      const template = SUB_GENRE_TEMPLATES_TRIGGER.get(genreId as SubGenreId);
      if (template?.includes(det.pattern)) {
        for (const s of genreSkills) skills.add(s);
      }
    }
  }

  return Array.from(skills);
}

/** Quick lookup: sub-genre ID → trigger patterns */
const SUB_GENRE_TEMPLATES_TRIGGER = new Map<SubGenreId, GameplayPattern[]>([
  ['souls-like', ['dodge-roll-heavy', 'gas-combo-chains']],
  ['character-action', ['gas-combo-chains']],
  ['diablo-like', ['loot-driven', 'inventory-crafting']],
  ['arpg-shooter', ['projectile-dominant']],
  ['tactical-arpg', ['ai-squad-tactics']],
  ['open-world-arpg', ['exploration-heavy', 'dialogue-branching']],
  ['roguelite-arpg', ['permadeath-rogue']],
  ['survival-arpg', ['inventory-crafting']],
]);

/** Get the display label for a skill ID */
export function getSkillLabel(id: SkillId): string {
  return SKILL_PACKS[id]?.label ?? id;
}

/** Get all available skill IDs */
export function getAllSkillIds(): SkillId[] {
  return Object.keys(SKILL_PACKS) as SkillId[];
}
