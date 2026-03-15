/** ── Item Genome (DNA) Schema ──────────────────────────────────────────────── *
 * Portable JSON schema encoding the DNA of any ARPG item archetype.
 * The genome biases affix rolling toward coherent item identities while
 * maintaining randomness through mutation, inheritance, and evolution.
 * ────────────────────────────────────────────────────────────────────────── */

/** The four trait axes that define an item's DNA */
export type TraitAxis = 'offensive' | 'defensive' | 'utility' | 'economic';

/** A single trait gene with weight and associated affix tags */
export interface TraitGene {
  /** Trait axis this gene belongs to */
  axis: TraitAxis;
  /** Weight 0-1 determining how strongly this axis influences affix rolls */
  weight: number;
  /** Gameplay tags that this gene biases toward (e.g. 'Stat.Strength', 'Stat.CritChance') */
  affinityTags: string[];
}

/** Mutation configuration — rare off-type affix chance */
export interface MutationConfig {
  /** Base chance (0-1) of rolling an off-type affix */
  mutationRate: number;
  /** Maximum number of mutations per roll session */
  maxMutations: number;
  /** If true, mutations can pull from any axis regardless of DNA */
  wildMutation: boolean;
}

/** Evolution tracking — items develop stronger versions of used affixes */
export interface EvolutionState {
  /** Number of times this item has been used in combat */
  usageCount: number;
  /** XP accumulated toward next evolution tier */
  evolutionXP: number;
  /** Current evolution tier (0 = base, 1-3 = evolved) */
  tier: number;
  /** Affix tags that have been most activated, driving evolution direction */
  dominantTraits: string[];
}

/** Inheritance result from combining two item genomes */
export interface InheritanceResult {
  /** Blended trait weights from both parents */
  traits: TraitGene[];
  /** Which parent was dominant (higher total weight) */
  dominantParent: 'A' | 'B';
  /** Chance of bonus trait from crossover */
  crossoverBonus: number;
}

/** Complete Item Genome — portable, shareable */
export interface ItemGenome {
  /** Unique id for this genome instance */
  id: string;
  /** Display name of the archetype (e.g. "Warrior Sword", "Mage Staff") */
  name: string;
  /** Short description of the item's identity */
  description: string;
  /** Author / creator name */
  author: string;
  /** Semantic version */
  version: string;
  /** Accent color for UI display */
  color: string;
  /** ISO timestamp of creation/last edit */
  updatedAt: string;

  /** The four trait axes with their weights and affinities */
  traits: TraitGene[];
  /** Mutation configuration */
  mutation: MutationConfig;
  /** Item type this genome applies to */
  itemType: 'Weapon' | 'Armor' | 'Consumable' | 'Material' | 'Accessory';
  /** Rarity floor — minimum rarity where this genome activates */
  minRarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

  /** Optional evolution state (only for instanced items) */
  evolution?: EvolutionState;
  /** Optional tags for filtering */
  tags?: string[];
}

/** Affix definition used in the DNA-biased roller */
export interface DNAAffix {
  id: string;
  name: string;
  isPrefix: boolean;
  /** Which trait axis this affix belongs to */
  axis: TraitAxis;
  /** Gameplay tags for matching against gene affinities */
  tags: string[];
  minValue: number;
  maxValue: number;
  baseWeight: number;
  minRarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
}

/** Result of a DNA-biased affix roll */
export interface DNARollResult {
  /** The rolled affixes */
  affixes: RolledAffix[];
  /** Whether any mutations occurred */
  hasMutations: boolean;
  /** Indices of mutated affixes */
  mutationIndices: number[];
  /** DNA coherence score (0-1) — how well affixes match the genome */
  coherenceScore: number;
}

/** A single rolled affix with its final values */
export interface RolledAffix {
  affix: DNAAffix;
  rolledValue: number;
  isMutation: boolean;
  /** Effective weight after DNA bias */
  effectiveWeight: number;
}

/** Radar axis config for genome visualization */
export interface GenomeRadarAxis {
  key: TraitAxis;
  label: string;
  color: string;
}
