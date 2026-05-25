import type { SpellbookAbility } from '@/components/modules/core-engine/sub_ability/_shared/data';
import type { ItemData } from '@/components/modules/core-engine/sub_inventory/_shared/data';
import type { EnemyLootBinding } from '@/components/modules/core-engine/sub_loot/_shared/data-binding';
import type { ArchetypeConfig } from '@/components/modules/core-engine/sub_bestiary/_shared/data';
import type { ComboSequence } from '@/components/modules/core-engine/sub_combat/_shared/data-metrics';
import type { ArenaSliceSpec } from './arena-slice';
import type { GraphNode } from '@/types/unique-tab-improvements';
import type { ZoneRecord } from '@/components/modules/core-engine/sub_world/_shared/data';
import type { MontageEntry } from '@/components/modules/core-engine/sub_animation/_shared/data';

/** Where a catalog entity is in the generate-into-UE pipeline. */
export type LifecycleState =
  | 'planned' | 'scaffolded' | 'generated' | 'wired' | 'verified' | 'failed';

/** Functional-test verdict from the verify step. */
export type TestResult = 'pass' | 'fail';

/** A typed cross-catalog reference (e.g. a Bestiary entry → its abilities/loot). */
export interface CatalogLink {
  catalogId: string;
  entityId: string;
  role: string;
}

/** The shared envelope every catalog entity carries. */
export interface CatalogEntityBase {
  id: string;
  catalogId: string;        // 'spellbook' (more catalogs added by later 09 steps)
  name: string;
  categoryPath: string[];   // e.g. ['Offensive','Fire'] — the future L4 hierarchy
  tags: string[];           // e.g. ['basic']
  lifecycle: LifecycleState;
  // ── Generation outputs (added by the Round-1 generation engine). Optional so
  //    statically-seeded entities remain valid without them. ──
  /** UE asset paths this entity owns once generated. */
  ueAssets?: string[];
  /** Last functional-test verdict from the verify step. */
  lastTestResult?: TestResult;
  /** ISO timestamp of the last passing verify. */
  lastVerifiedAt?: string;
  /** Cross-catalog references (e.g. Bestiary → Abilities + Loot). */
  links?: CatalogLink[];
}

/** Ability catalog entity — payload reuses the existing UI shape, rendered unchanged. */
export interface AbilityEntry extends CatalogEntityBase {
  catalogId: 'spellbook';
  data: SpellbookAbility;
}

/** Items catalog entity — payload reuses the existing ItemCatalog UI shape. */
export interface ItemEntry extends CatalogEntityBase {
  catalogId: 'items';
  data: ItemData;
}

/** Loot-table catalog entity — payload reuses the existing enemy→loot binding shape. */
export interface LootTableEntry extends CatalogEntityBase {
  catalogId: 'loot-tables';
  data: EnemyLootBinding;
}

/** Bestiary catalog entity — composes abilities + loot via `links` (resolved at seed time). */
export interface BestiaryEntry extends CatalogEntityBase {
  catalogId: 'bestiary';
  data: ArchetypeConfig;
}

/** Combat Map catalog entity — combo/interaction shape from CombatActionMap. */
export interface CombatInteractionEntry extends CatalogEntityBase {
  catalogId: 'combat-map';
  data: ComboSequence;
}

/**
 * Combat Map catalog entity — tactical encounter arena. Shares the `combat-map`
 * catalog with `CombatInteractionEntry`; the `data.kind === 'arena-slice'`
 * discriminator tells the two apart (see `arena-slice.ts`).
 */
export interface ArenaSliceEntry extends CatalogEntityBase {
  catalogId: 'combat-map';
  data: ArenaSliceSpec;
}

/** Screen Flow catalog entity — one screen node from FLOW_NODES. */
export interface ScreenEntry extends CatalogEntityBase {
  catalogId: 'screen-flow';
  data: GraphNode;
}

/** Zone Map catalog entity — one zone from ZoneMap. */
export interface ZoneEntry extends CatalogEntityBase {
  catalogId: 'zone-map';
  data: ZoneRecord;
}

/** State Graph catalog entity — one montage from ALL_MONTAGES (AnimBP graph stays manual). */
export interface AnimationEntry extends CatalogEntityBase {
  catalogId: 'state-graph';
  data: MontageEntry;
}

/**
 * Design spec for a material-instance entity: a parameter set layered over the
 * shared surface master (`/Game/Materials/M_ARPG_Surface_Master`). The UE Python
 * builder (`Content/Python/build_weathered_stone.py`) mirrors these values — the
 * app is the SYNC SOURCE (the `seed_ability_catalog.py` convention). Most fields
 * are optional so a thin material can omit them; the catalog-pipeline target
 * "Weathered Stone" populates the full set.
 */
export interface MaterialSpec {
  /** Display name (kept from the Phase-8 substrate shape). */
  displayName: string;
  /** Surface-type classification (pipeline step 2). */
  surfaceType?: 'stone' | 'metal' | 'wood' | 'cloth' | 'glass' | 'organic' | 'fabric';
  /** Hex swatch for the catalog UI (kept from the Phase-8 substrate shape). */
  baseColor?: string;
  /** Master material this instance derives from. */
  parentMaterial?: string;
  /** Content path of the generated MaterialInstanceConstant. */
  instancePath?: string;
  /** Texture-parameter assignments (pipeline step 5). */
  textures?: {
    albedo?: string;
    normal?: string;
    roughness?: string;
    detailNormal?: string;
  };
  /** `BaseColorTint` VectorParameter as linear RGB (pipeline step 4). */
  baseColorTint?: [number, number, number];
  /** Scalar-parameter overrides (pipeline steps 4 / 8 / 9). */
  scalars?: {
    tilingScale?: number;
    detailTiling?: number;
    emissiveStrength?: number;
  };
}

/** Materials catalog entity — a parameter set over the shared surface master. */
export interface MaterialCatalogEntry extends CatalogEntityBase {
  catalogId: 'materials';
  data: MaterialSpec;
}

/** Audio catalog entity (Phase 8b — substrate only; data lift in Phase 10). */
export interface AudioCatalogEntry extends CatalogEntityBase {
  catalogId: 'audio';
  data: {
    setName: string;
    surface?: string;
    license?: string;
  };
}

/** Animation-Assets catalog entity (Phase 8b — separate from state-graph; tracks
 *  the skeletal-mesh + retargeted montage assets, not the AnimBP graph). */
export interface AnimationAssetCatalogEntry extends CatalogEntityBase {
  catalogId: 'animation-assets';
  data: {
    assetName: string;
    skeleton?: string;
    source?: 'mixamo' | 'authored' | 'imported';
  };
}

/** NPC role — mirrors UE `EARPGNPCRole` (Dialogue/ARPGNPCActor.h). */
export type CharacterNPCRole =
  | 'None' | 'QuestGiver' | 'Merchant' | 'Trainer' | 'Innkeeper' | 'Lorekeeper';

/**
 * Base attribute stats — mirrors UE `FARPGAttributeInitRow`
 * (AbilitySystem/ARPGAttributeInitData.h), the row struct of `DT_AttributeDefaults`.
 * These are the Level-1 base values; per-level scaling is a Curve Table in UE.
 */
export interface CharacterAttributeRow {
  health: number; maxHealth: number; mana: number; maxMana: number;
  strength: number; dexterity: number; intelligence: number;
  armor: number; attackPower: number; criticalChance: number; criticalDamage: number;
  characterLevel: number;
}

/** Character/NPC design payload — drives the `AARPGNPCActor` + attribute-row artifacts. */
export interface CharacterData {
  description: string;
  /** → `AARPGNPCActor.NPCID` (FName); the TalkTo objective key. */
  npcId: string;
  /** → `AARPGNPCActor.NPCRole`. */
  role: CharacterNPCRole;
  /** Short archetype/fantasy tag for design grouping. */
  archetype: string;
  /** → `AARPGNPCActor.bFacePlayerInDialogue`. */
  facePlayerInDialogue: boolean;
  /** Row name to author into `DT_AttributeDefaults` (the shared stat source). */
  attributeRowName: string;
  attributes: CharacterAttributeRow;
  /** Ability names granted; resolved to `spellbook` cross-catalog links at seed time. */
  abilities: string[];
  /** Skeletal-mesh + AnimBP targets (reuse the `setup_characters_ue.py` mannequin path). */
  bodyMesh?: { skeletalMesh: string; animClass: string };
}

/** Characters catalog entity — a playable/named NPC with presentation + behavior. */
export interface CharacterEntry extends CatalogEntityBase {
  catalogId: 'characters';
  data: CharacterData;
}

/**
 * Generic stored shape used by the entity-generic dispatch path: any catalog
 * entity carries a `data` blob opaque to the dispatch (each section's recipe
 * knows how to interpret its own `data`).
 */
export type StoredCatalogEntity = CatalogEntityBase & { data?: unknown };

/**
 * A lifecycle/generation record persisted server-side (DB) and merged over the
 * statically-seeded entities at load time. The DB owns lifecycle/ueAssets/test
 * results; the static seed owns the design `data`.
 */
export interface LifecycleRecord {
  catalogId: string;
  entityId: string;
  lifecycle: LifecycleState;
  ueAssets: string[];
  lastTestResult?: TestResult;
  lastVerifiedAt?: string;
}
