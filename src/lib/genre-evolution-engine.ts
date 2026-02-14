/**
 * Genre Evolution Engine
 *
 * Analyzes telemetry signals from the UE5 project to detect gameplay patterns,
 * then suggests sub-genre template transitions with checklist reordering.
 */

import type {
  TelemetrySignals,
  PatternDetection,
  GameplayPattern,
  SubGenreTemplate,
  SubGenreId,
  GenreEvolutionSuggestion,
  GenreChecklistItem,
} from '@/types/telemetry';
import type { DynamicProjectContext } from '@/lib/prompt-context';

// ─── Sub-Genre Template Definitions ──────────────────────────────────────────

export const SUB_GENRE_TEMPLATES: SubGenreTemplate[] = [
  {
    id: 'souls-like',
    label: 'Souls-like',
    description: 'Precise dodge-based combat with punishing difficulty, stamina management, and deliberate attack timing. Think Dark Souls, Elden Ring.',
    triggerPatterns: ['dodge-roll-heavy', 'gas-combo-chains'],
    priorityItems: ['acb-6', 'acb-5', 'ac-3', 'acb-8', 'ae-4'],
    deprioritizeItems: ['ai-7', 'ap-5'],
    additionalItems: [
      { id: 'sl-stagger', label: 'Implement stagger/poise system', description: 'Each hit accumulates stagger on the target. When poise breaks, play a long stagger animation enabling a critical riposte.', prompt: 'Implement a poise/stagger system for my Souls-like aRPG using GAS. Add Poise and MaxPoise attributes. Each hit reduces poise by a StaggerDamage value. When Poise reaches 0: apply State.Staggered tag, play long stagger animation, enable a riposte window. Poise regenerates after 3 seconds of no hits. Heavy attacks deal more stagger. Bosses have higher poise thresholds.' },
      { id: 'sl-stamina', label: 'Implement Souls-style stamina management', description: 'All combat actions (attack, dodge, block, sprint) consume stamina. Stamina regen pauses briefly after each action.', prompt: 'Refactor my stamina system for Souls-like feel. Every combat action costs stamina: light attack (20), heavy attack (35), dodge (25), block-per-hit (variable), sprint (10/sec). After any stamina spend, pause regen for 0.8 seconds then regen at 30/sec. When stamina is empty: attacks are slow and weak, dodge fails, guard breaks. Show stamina bar below health bar with a delayed ghost bar.' },
      { id: 'sl-bonfires', label: 'Create checkpoint/bonfire system', description: 'Rest points that refill health/estus, reset enemies, and serve as respawn points on death.', prompt: 'Create a bonfire/checkpoint system for my Souls-like. ABonfireActor: interactable rest point. On activate: heal to full, refill "Estus Flask" charges (consumable heal item, 5 charges), set respawn point, respawn all non-boss enemies. On death: respawn at last bonfire, lose accumulated currency (recoverable at death location). Show a "bonfire lit" animation and UI prompt.' },
    ],
  },
  {
    id: 'character-action',
    label: 'Character Action',
    description: 'Stylish combo-heavy combat with air juggles, style rankings, and flashy abilities. Think Devil May Cry, Bayonetta.',
    triggerPatterns: ['gas-combo-chains'],
    priorityItems: ['acb-1', 'acb-2', 'acb-8', 'aa-4', 'aa-6'],
    deprioritizeItems: ['al-7', 'aw-5'],
    additionalItems: [
      { id: 'ca-style', label: 'Implement style ranking meter', description: 'Track combo variety and timing to display a dynamic style rank (D through SSS) that affects XP multiplier.', prompt: 'Implement a style ranking system for my character action game. Track: combo hit count, time between hits, variety of moves used, damage dealt without taking damage. Calculate a StyleScore that maps to ranks: D (boring), C, B, A, S, SS, SSS (Smokin Sexy Style). Higher ranks give XP/loot multiplier. Rank decays over time without combat. Show the rank prominently on screen with flashy VFX per rank-up.' },
      { id: 'ca-launcher', label: 'Create launch and air combo system', description: 'Launcher attacks that send enemies airborne, enabling air combos with juggle physics.', prompt: 'Create a launcher and air combo system. GA_Launcher: upward attack that applies upward impulse to hit enemies (launch them 300 units up). While an enemy is airborne: allow the player to jump-cancel into air attacks. Air attacks apply slight upward force to keep enemies suspended. Gravity pulls them down slowly. Create 3-hit air combo with different animations. Landing after air combo plays a slam animation.' },
    ],
  },
  {
    id: 'diablo-like',
    label: 'Diablo-like ARPG',
    description: 'Loot-driven isometric combat with deep itemization, procedural affixes, and build diversity. Think Diablo, Path of Exile.',
    triggerPatterns: ['loot-driven', 'inventory-crafting'],
    priorityItems: ['al-1', 'al-3', 'ai-7', 'ai-4', 'ap-1'],
    deprioritizeItems: ['ae-5', 'aw-6'],
    additionalItems: [
      { id: 'dl-affixes', label: 'Implement deep affix system', description: 'Prefix/suffix system with hundreds of possible affixes, tier-based rolling, and affix weighting by zone/enemy type.', prompt: 'Create a deep affix system for my Diablo-like. Define affix pools: Prefixes (Damage, Life, Resistance) and Suffixes (Speed, Crit, Leech). Each affix has tiers (T1-T5) with increasing value ranges. Items roll affixes based on item level — higher ilvl unlocks higher tiers. Zone-specific affixes: fire zone drops more fire damage affixes. Create a rerolling system for one affix at a cost.' },
      { id: 'dl-sockets', label: 'Create gem/socket system', description: 'Items can have sockets that accept gems providing additional stats or ability modifications.', prompt: 'Create a socket and gem system. Items can have 1-3 sockets based on rarity. Create gem types: Ruby (+damage), Sapphire (+mana), Emerald (+crit), Diamond (+armor). Gems have quality tiers (Chipped→Flawless). Socketing is permanent; removing destroys the gem. Implement a gem combining recipe: 3 of same tier = 1 of next tier. Show sockets visually on the item tooltip.' },
    ],
  },
  {
    id: 'arpg-shooter',
    label: 'ARPG Shooter',
    description: 'Ranged-focused combat with projectile variety, spread patterns, and ability synergies. Think Remnant, Outriders.',
    triggerPatterns: ['projectile-dominant'],
    priorityItems: ['acb-3', 'acb-4', 'ag-5', 'ae-3'],
    deprioritizeItems: ['acb-2', 'aa-6'],
    additionalItems: [
      { id: 'as-weapons', label: 'Create weapon class system', description: 'Multiple ranged weapon types with unique firing patterns, reload mechanics, and mod slots.', prompt: 'Create a weapon class system for my ARPG shooter. Weapon types: Rifle (medium fire rate, medium damage, accurate), Shotgun (slow fire rate, high damage, spread pattern), SMG (fast fire rate, low damage, high spread), Sniper (very slow, very high damage, scope zoom). Each has: fire rate, magazine size, reload time, spread pattern. Implement ammo and reload via GAS. Weapon switching on number keys.' },
      { id: 'as-cover', label: 'Implement cover system', description: 'Context-sensitive cover mechanics with peek-and-shoot and blind fire options.', prompt: 'Implement a cover system for my ARPG shooter. Detect cover objects via line trace. When near cover and pressing crouch: snap to cover position, reduce hitbox. Peek with aim: character leans out to shoot with accuracy bonus. Blind fire: shoot over cover with reduced accuracy. Transition animations between in-cover and out-of-cover. AI should also use cover (integrate with EQS FindCoverPosition).' },
    ],
  },
  {
    id: 'tactical-arpg',
    label: 'Tactical ARPG',
    description: 'Squad-based combat with AI companion management, formation control, and strategic ability synergies. Think Dragon Age.',
    triggerPatterns: ['ai-squad-tactics'],
    priorityItems: ['ae-1', 'ae-4', 'ae-5', 'ae-7', 'ag-3'],
    deprioritizeItems: ['al-4', 'al-7'],
    additionalItems: [
      { id: 'ta-companions', label: 'Create companion AI system', description: 'Recruit and manage AI party members with unique abilities, personality, and behavior customization.', prompt: 'Create a companion AI system for my tactical ARPG. ACompanionCharacter extends AARPGEnemyCharacter but follows the player. Each companion has: a unique ability set, a Behavior mode (Aggressive/Defensive/Support), Follow distance setting, and ability usage priority. Player can issue commands: Follow Me, Hold Position, Attack Target, Use Ability. Show companion health bars in the HUD party frame.' },
      { id: 'ta-tactics', label: 'Implement tactical pause', description: 'Pause combat to issue orders, queue abilities, and coordinate companion actions.', prompt: 'Implement a tactical pause system. On Tab press: slow time to 10% speed (SetGlobalTimeDilation), show tactical overlay with companion positions and enemy highlights. Player can click companions and assign: target to attack, ability to use, position to move to. Queue up to 3 actions per companion. On unpause: all queued actions execute. Show action queue icons above each companion.' },
    ],
  },
  {
    id: 'open-world-arpg',
    label: 'Open World ARPG',
    description: 'Large explorable world with zone streaming, dynamic events, and environmental storytelling. Think Elden Ring\'s open world.',
    triggerPatterns: ['exploration-heavy', 'dialogue-branching'],
    priorityItems: ['aw-1', 'aw-5', 'aw-3', 'aw-4', 'as-5'],
    deprioritizeItems: ['apl-5'],
    additionalItems: [
      { id: 'ow-discovery', label: 'Create point-of-interest system', description: 'Discoverable map markers that reveal when explored, with different POI types and rewards.', prompt: 'Create a point-of-interest (POI) system for my open world. POI types: Camp (enemy encounter), Dungeon (instanced zone), Shrine (stat boost), Vista (map reveal), Chest (loot). Each POI has: undiscovered/discovered/completed state, map marker icon, compass indicator at screen edge. Discovery triggers a brief notification. POIs persist to save data. Create 10-15 POIs for the starting zone.' },
      { id: 'ow-mount', label: 'Implement mount/vehicle system', description: 'Rideable mount for faster overworld traversal with mount combat and summon/dismiss.',  prompt: 'Implement a mount system for my open world ARPG. Create AARPGMount actor with skeletal mesh, mounted movement (speed 1200, sprint 1800). Mount/dismount with keybind: plays mount/dismount animation, attaches player to mount socket. Allow basic combat while mounted (light attacks only). Mount takes damage and can be killed. Summon mount with whistle from anywhere in overworld (spawns nearby with run-to-player).' },
    ],
  },
  {
    id: 'roguelite-arpg',
    label: 'Roguelite ARPG',
    description: 'Run-based progression with procedural elements, permanent unlocks, and high replayability. Think Hades.',
    triggerPatterns: ['permadeath-rogue'],
    priorityItems: ['aw-1', 'al-1', 'al-3', 'ap-4', 'acb-8'],
    deprioritizeItems: ['as-6', 'aw-5'],
    additionalItems: [
      { id: 'rl-meta', label: 'Create meta-progression system', description: 'Permanent currency earned across runs that unlocks new starting abilities, stat boosts, and item pools.', prompt: 'Create a meta-progression system for my roguelite ARPG. MetaCurrency earned per run based on: enemies killed, rooms cleared, boss kills, and run completion. Persists across deaths. Spend at a hub between runs to permanently unlock: new abilities (expand the pool), stat bonuses (+5% base health per tier), new item types in loot tables, and cosmetics. Create a skill tree UI for meta unlocks.' },
      { id: 'rl-rooms', label: 'Implement procedural room system', description: 'Randomly assembled room layouts with encounter variety, reward choices, and branching paths.', prompt: 'Implement a procedural room system for my roguelite. Define room templates: Combat Room (fight enemies, clear to proceed), Elite Room (harder fight, better reward), Shop Room (buy items with run currency), Treasure Room (free loot), Boss Room (end of floor). Generate a run as a graph: 5-7 rooms per floor, 3 floors, with branching paths showing room types. Player chooses which path to take. Load rooms as streaming sub-levels.' },
    ],
  },
  {
    id: 'survival-arpg',
    label: 'Survival ARPG',
    description: 'Resource gathering, crafting, base building with ARPG combat. Think Valheim, V Rising.',
    triggerPatterns: ['inventory-crafting'],
    priorityItems: ['ai-1', 'ai-3', 'ai-6', 'aw-4', 'as-1'],
    deprioritizeItems: ['ap-5', 'ap-7'],
    additionalItems: [
      { id: 'sv-crafting', label: 'Create crafting system', description: 'Recipe-based crafting with resource gathering, workstations, and tiered progression.', prompt: 'Create a crafting system for my survival ARPG. Define CraftingRecipe data assets: required materials (TArray<FItemQuantity>), output item, crafting station type (None/Workbench/Forge/Alchemy), craft time. Create ACraftingStation interactable actors. UI shows available recipes, highlights craftable ones, greys out missing materials. Craft button starts a timer then produces the item. Auto-consume materials from inventory.' },
      { id: 'sv-gather', label: 'Implement resource gathering', description: 'Harvestable world objects (trees, rocks, ore) with tool requirements and respawn timers.', prompt: 'Implement resource gathering for my survival ARPG. Create AHarvestableResource base class: health pool, required tool type (Axe/Pickaxe/None), TArray<FLootEntry> drops on destruction, respawn timer. Child classes: Tree (drops Wood, requires Axe), Rock (drops Stone, requires Pickaxe), Ore Vein (drops Iron/Gold, requires Pickaxe), Bush (drops Berries, no tool). Each hit plays a chop/mine sound and spawns particle debris. Resources respawn after 5 minutes.' },
    ],
  },
];

export const SUB_GENRE_MAP = new Map(
  SUB_GENRE_TEMPLATES.map(t => [t.id, t])
);

// ─── Signal Extraction ───────────────────────────────────────────────────────
// In production, this scans actual UE5 project files. For now, we extract
// signals from the DynamicProjectContext scan data.

export function extractSignals(
  dynamic: DynamicProjectContext | null,
  projectPath: string,
): TelemetrySignals {
  const classes = dynamic?.classes ?? [];
  const plugins = dynamic?.plugins ?? [];
  const deps = dynamic?.buildDependencies ?? [];

  // Count class types by prefix/name patterns
  const classNames = classes.map(c => c.name.toLowerCase());
  const headerPaths = classes.map(c => c.headerPath.toLowerCase());
  const depModules = deps.map(d => d.module.toLowerCase());

  const gasAbilityCount = classNames.filter(n =>
    n.includes('gameplayability') || n.includes('ga_') || n.startsWith('ga')
  ).length;

  const gameplayEffectCount = classNames.filter(n =>
    n.includes('gameplayeffect') || n.includes('ge_') || n.startsWith('ge')
  ).length;

  const behaviorTreeCount = classNames.filter(n =>
    n.includes('bttask') || n.includes('btservice') || n.includes('btdecorator') || n.includes('behaviortree')
  ).length;

  const eqsQueryCount = classNames.filter(n =>
    n.includes('eqs') || n.includes('envquery')
  ).length;

  const widgetClassCount = classNames.filter(n =>
    n.includes('widget') || n.includes('hud') || n.includes('umg')
  ).length;

  const saveGameFieldCount = classNames.filter(n =>
    n.includes('savegame')
  ).length;

  // Pattern detection from class names and paths
  const hasDodgeAbility = classNames.some(n =>
    n.includes('dodge') || n.includes('roll') || n.includes('dash') || n.includes('evade')
  );
  const hasComboSystem = classNames.some(n =>
    n.includes('combo') || n.includes('combowindow')
  );
  const hasProjectileSystem = classNames.some(n =>
    n.includes('projectile') || n.includes('bullet') || n.includes('ranged')
  );
  const hasLootTables = classNames.some(n =>
    n.includes('loottable') || n.includes('lootdrop') || n.includes('itemdrop')
  );
  const hasDialogueSystem = classNames.some(n =>
    n.includes('dialogue') || n.includes('conversation') || n.includes('quest')
  );
  const hasCraftingSystem = classNames.some(n =>
    n.includes('crafting') || n.includes('recipe') || n.includes('workstation')
  );
  const hasMultiplayerReplication = depModules.some(m =>
    m.includes('onlinesubsystem') || m.includes('netcore')
  ) || classNames.some(n => n.includes('replicated') || n.includes('rpc'));
  const hasProceduralGeneration = classNames.some(n =>
    n.includes('procedural') || n.includes('generator') || n.includes('randomize')
  );
  const hasStealthMechanics = classNames.some(n =>
    n.includes('stealth') || n.includes('detection') || n.includes('sneak')
  );

  // Structural signals
  const niagaraSystemCount = classNames.filter(n =>
    n.includes('niagara') || n.includes('vfx') || n.includes('particl')
  ).length;

  return {
    gasAbilityCount,
    gameplayEffectCount,
    behaviorTreeCount,
    eqsQueryCount,
    widgetClassCount,
    saveGameFieldCount,
    hasDodgeAbility,
    hasComboSystem,
    hasProjectileSystem,
    hasLootTables,
    hasDialogueSystem,
    hasCraftingSystem,
    hasMultiplayerReplication,
    hasProceduralGeneration,
    hasStealthMechanics,
    estimatedActorCount: classes.length,
    niagaraSystemCount,
    totalSourceFiles: dynamic?.sourceFileCount ?? 0,
    totalHeaderFiles: Math.floor((dynamic?.sourceFileCount ?? 0) * 0.5),
    moduleCount: new Set(deps.map(d => d.module)).size,
  };
}

// ─── Pattern Detection ───────────────────────────────────────────────────────

type PatternRule = (s: TelemetrySignals) => { confidence: number; evidence: string[] } | null;

const PATTERN_RULES: Record<GameplayPattern, PatternRule> = {
  'dodge-roll-heavy': (s) => {
    if (!s.hasDodgeAbility) return null;
    const evidence: string[] = ['Dodge/roll ability class detected'];
    let conf = 60;
    if (s.gasAbilityCount >= 3) { conf += 15; evidence.push(`${s.gasAbilityCount} GAS abilities suggest deep combat`); }
    if (s.hasComboSystem) { conf += 10; evidence.push('Combo system present'); }
    return { confidence: Math.min(conf, 95), evidence };
  },
  'gas-combo-chains': (s) => {
    if (!s.hasComboSystem) return null;
    const evidence: string[] = ['Combo system class detected'];
    let conf = 55;
    if (s.gasAbilityCount >= 5) { conf += 20; evidence.push(`${s.gasAbilityCount} GAS abilities = deep ability chains`); }
    if (s.gameplayEffectCount >= 3) { conf += 10; evidence.push(`${s.gameplayEffectCount} gameplay effects`); }
    return { confidence: Math.min(conf, 95), evidence };
  },
  'projectile-dominant': (s) => {
    if (!s.hasProjectileSystem) return null;
    const evidence: string[] = ['Projectile system detected'];
    let conf = 50;
    if (s.gasAbilityCount >= 2) { conf += 15; evidence.push('Ranged abilities via GAS'); }
    if (!s.hasComboSystem && !s.hasDodgeAbility) { conf += 15; evidence.push('No melee combo or dodge — likely ranged focus'); }
    return { confidence: Math.min(conf, 90), evidence };
  },
  'ai-squad-tactics': (s) => {
    if (s.behaviorTreeCount < 3 && s.eqsQueryCount < 2) return null;
    const evidence: string[] = [];
    let conf = 40;
    if (s.behaviorTreeCount >= 3) { conf += 25; evidence.push(`${s.behaviorTreeCount} BT nodes suggest complex AI`); }
    if (s.eqsQueryCount >= 2) { conf += 20; evidence.push(`${s.eqsQueryCount} EQS queries for tactical positioning`); }
    return { confidence: Math.min(conf, 85), evidence };
  },
  'inventory-crafting': (s) => {
    if (!s.hasCraftingSystem) return null;
    const evidence: string[] = ['Crafting system detected'];
    let conf = 65;
    if (s.hasLootTables) { conf += 15; evidence.push('Loot tables for resource drops'); }
    return { confidence: Math.min(conf, 90), evidence };
  },
  'loot-driven': (s) => {
    if (!s.hasLootTables) return null;
    const evidence: string[] = ['Loot table system detected'];
    let conf = 50;
    if (s.gameplayEffectCount >= 5) { conf += 20; evidence.push(`${s.gameplayEffectCount} GE = deep itemization`); }
    if (s.gasAbilityCount >= 4) { conf += 10; evidence.push('Many abilities suggest build diversity'); }
    return { confidence: Math.min(conf, 90), evidence };
  },
  'exploration-heavy': (s) => {
    if (s.totalSourceFiles < 30) return null;
    const evidence: string[] = [];
    let conf = 30;
    if (s.moduleCount >= 3) { conf += 20; evidence.push(`${s.moduleCount} modules suggest large scope`); }
    if (s.behaviorTreeCount >= 2) { conf += 10; evidence.push('Multiple AI types for populated world'); }
    if (s.hasDialogueSystem) { conf += 15; evidence.push('Dialogue system for NPC interactions'); }
    if (conf <= 30) return null;
    return { confidence: Math.min(conf, 85), evidence };
  },
  'dialogue-branching': (s) => {
    if (!s.hasDialogueSystem) return null;
    const evidence: string[] = ['Dialogue/quest system detected'];
    let conf = 60;
    if (s.widgetClassCount >= 3) { conf += 15; evidence.push('Multiple UI widgets for dialogue display'); }
    return { confidence: Math.min(conf, 85), evidence };
  },
  'permadeath-rogue': (s) => {
    if (!s.hasProceduralGeneration) return null;
    const evidence: string[] = ['Procedural generation detected'];
    let conf = 55;
    if (s.hasLootTables) { conf += 15; evidence.push('Random loot for run variety'); }
    if (s.saveGameFieldCount === 0) { conf += 10; evidence.push('No save game = possible permadeath'); }
    return { confidence: Math.min(conf, 85), evidence };
  },
  'performance-intensive': (s) => {
    if (s.niagaraSystemCount < 3 && s.estimatedActorCount < 50) return null;
    const evidence: string[] = [];
    let conf = 40;
    if (s.niagaraSystemCount >= 5) { conf += 25; evidence.push(`${s.niagaraSystemCount} VFX systems`); }
    if (s.estimatedActorCount >= 50) { conf += 20; evidence.push(`${s.estimatedActorCount} actor classes`); }
    return { confidence: Math.min(conf, 90), evidence };
  },
  'multiplayer-sync': (s) => {
    if (!s.hasMultiplayerReplication) return null;
    return { confidence: 70, evidence: ['Multiplayer replication dependencies detected'] };
  },
  'stealth-mechanics': (s) => {
    if (!s.hasStealthMechanics) return null;
    return { confidence: 65, evidence: ['Stealth/detection system classes detected'] };
  },
};

export function detectPatterns(signals: TelemetrySignals): PatternDetection[] {
  const patterns: PatternDetection[] = [];
  const now = new Date().toISOString();

  for (const [pattern, rule] of Object.entries(PATTERN_RULES)) {
    const result = rule(signals);
    if (result && result.confidence >= 40) {
      patterns.push({
        pattern: pattern as GameplayPattern,
        confidence: result.confidence,
        evidence: result.evidence,
        detectedAt: now,
      });
    }
  }

  // Sort by confidence descending
  patterns.sort((a, b) => b.confidence - a.confidence);
  return patterns;
}

// ─── Suggestion Generation ───────────────────────────────────────────────────

export function generateSuggestions(
  patterns: PatternDetection[],
  acceptedSubGenres: SubGenreId[],
): GenreEvolutionSuggestion[] {
  const suggestions: GenreEvolutionSuggestion[] = [];
  const now = new Date().toISOString();
  const acceptedSet = new Set(acceptedSubGenres);

  for (const template of SUB_GENRE_TEMPLATES) {
    // Skip already-accepted templates
    if (acceptedSet.has(template.id)) continue;

    // Check if any trigger pattern is detected
    const matchingPatterns = patterns.filter(p =>
      template.triggerPatterns.includes(p.pattern)
    );

    if (matchingPatterns.length === 0) continue;

    // Compute combined confidence
    const avgConfidence = Math.round(
      matchingPatterns.reduce((sum, p) => sum + p.confidence, 0) / matchingPatterns.length
    );

    // Only suggest if confidence is high enough
    if (avgConfidence < 50) continue;

    suggestions.push({
      id: `sug-${template.id}-${Date.now()}`,
      subGenre: template.id,
      label: `Evolve toward ${template.label}`,
      description: template.description,
      confidence: avgConfidence,
      patterns: matchingPatterns,
      status: 'pending',
      proposedChanges: {
        prioritize: template.priorityItems,
        deprioritize: template.deprioritizeItems,
        add: template.additionalItems,
      },
      createdAt: now,
      resolvedAt: null,
    });
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}
