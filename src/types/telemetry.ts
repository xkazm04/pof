// ─── Gameplay Telemetry & Genre Evolution Types ──────────────────────────────

/** Detected gameplay pattern from UE5 profiling data or project scan. */
export type GameplayPattern =
  | 'dodge-roll-heavy'       // Frequent dodge/i-frame usage → Souls-like
  | 'gas-combo-chains'       // Extended GAS ability combos → Character Action
  | 'projectile-dominant'    // Ranged attacks > melee → ARPG Shooter or Twin-stick
  | 'ai-squad-tactics'       // Group AI coordination → Tactical ARPG
  | 'inventory-crafting'     // Deep inventory + craft → Survival ARPG
  | 'loot-driven'            // High loot table variety → Diablo-like
  | 'exploration-heavy'      // Large world, zone streaming → Open-world ARPG
  | 'dialogue-branching'     // Dialogue system depth → RPG-heavy
  | 'permadeath-rogue'       // Save/load with run-based resets → Roguelite ARPG
  | 'performance-intensive'  // High actor counts, VFX → Needs optimization pass
  | 'multiplayer-sync'       // Replication + sessions → Online ARPG
  | 'stealth-mechanics'      // AI perception tuning, low aggro → Stealth ARPG
  | 'procedural-generation'; // PCG graphs, proc dungeons → PCG-heavy project

/** Confidence of a detected pattern (0–100). */
export interface PatternDetection {
  pattern: GameplayPattern;
  confidence: number;
  evidence: string[];       // What signals triggered this detection
  detectedAt: string;
}

/** A sub-genre template the system can suggest evolving toward. */
export type SubGenreId =
  | 'souls-like'
  | 'character-action'
  | 'arpg-shooter'
  | 'diablo-like'
  | 'tactical-arpg'
  | 'open-world-arpg'
  | 'roguelite-arpg'
  | 'survival-arpg';

export interface SubGenreTemplate {
  id: SubGenreId;
  label: string;
  description: string;
  /** Which patterns strongly indicate this sub-genre */
  triggerPatterns: GameplayPattern[];
  /** Checklist items to add/prioritize when this template is active */
  priorityItems: string[];
  /** Checklist items to de-prioritize or mark optional */
  deprioritizeItems: string[];
  /** New checklist items unique to this sub-genre */
  additionalItems: GenreChecklistItem[];
}

export interface GenreChecklistItem {
  id: string;
  label: string;
  description: string;
  prompt: string;
}

/** A telemetry snapshot from scanning project files or profiling output. */
export interface TelemetrySnapshot {
  id: string;
  scannedAt: string;
  projectPath: string;
  /** Raw signals extracted from the project */
  signals: TelemetrySignals;
  /** Patterns detected from the signals */
  detectedPatterns: PatternDetection[];
}

export interface TelemetrySignals {
  /** From scanning .h/.cpp files for class declarations */
  gasAbilityCount: number;
  gameplayEffectCount: number;
  behaviorTreeCount: number;
  eqsQueryCount: number;
  widgetClassCount: number;
  saveGameFieldCount: number;
  /** From scanning specific patterns in code */
  hasDodgeAbility: boolean;
  hasComboSystem: boolean;
  hasProjectileSystem: boolean;
  hasLootTables: boolean;
  hasDialogueSystem: boolean;
  hasCraftingSystem: boolean;
  hasMultiplayerReplication: boolean;
  hasProceduralGeneration: boolean;
  hasStealthMechanics: boolean;
  /** Performance signals from build output or profiling */
  estimatedActorCount: number;
  niagaraSystemCount: number;
  /** File structure signals */
  totalSourceFiles: number;
  totalHeaderFiles: number;
  moduleCount: number;
}

/** A suggestion to evolve the genre template. */
export interface GenreEvolutionSuggestion {
  id: string;
  subGenre: SubGenreId;
  label: string;
  description: string;
  confidence: number;        // 0–100
  patterns: PatternDetection[];
  status: 'pending' | 'accepted' | 'dismissed';
  /** Which checklist items would be added/reordered */
  proposedChanges: {
    prioritize: string[];
    deprioritize: string[];
    add: GenreChecklistItem[];
  };
  createdAt: string;
  resolvedAt: string | null;
}

/** Summary stats for the telemetry dashboard. */
export interface TelemetryStats {
  totalScans: number;
  lastScanAt: string | null;
  detectedPatterns: PatternDetection[];
  activeSuggestions: GenreEvolutionSuggestion[];
  acceptedSubGenres: SubGenreId[];
}

// ─── API Payloads ────────────────────────────────────────────────────────────

export interface ScanTelemetryPayload {
  projectPath: string;
}

export interface ResolveSuggestionPayload {
  suggestionId: string;
  action: 'accept' | 'dismiss';
}
