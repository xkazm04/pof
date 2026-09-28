import type { Cpu } from 'lucide-react';
import type { FeatureRow } from '@/types/feature-matrix';
import type {
  TagNode, TagDepNode, TagDepEdge, AuditCategory, TagDetail, SpellbookAbility, GameplayEffectEntry,
} from './data';
import type { TagAuditBreakdown } from '@/lib/ability/tag-audit';

export type SpellbookSubtab =
  | 'features' | 'core' | 'abilities' | 'effects' | 'tags' | 'combos'
  | 'blueprint' | 'balance' | 'forge';

export interface SpellbookSubtabDef {
  key: SpellbookSubtab;
  label: string;
  icon: typeof Cpu;
  narrative: string;
  subtitle: string;
}

export type SectionId = 'core' | 'attributes' | 'tags' | 'abilities' | 'effects'
  | 'tag-deps' | 'effects-timeline' | 'damage-calc' | 'tag-audit' | 'loadout';

export interface SectionConfig {
  id: SectionId;
  label: string;
  icon: typeof Cpu;
  color: string;
  featureNames: string[];
}

export interface SectionProps {
  featureMap: Map<string, FeatureRow>;
  defs: { featureName: string; description: string; dependsOn?: string[] }[];
  expanded: string | null;
  onToggle: (name: string) => void;
}

/**
 * Where a spellbook dataset comes from. The catalog owns the numbers (cooldown,
 * radar); parsed C++ owns the vocabulary (tags, deps, attributes, audit); an
 * `illustrative` dataset is a hand-written example shown until a source is parsed.
 */
export type SpellbookProvenance = 'catalog' | 'ue-source' | 'illustrative';

/**
 * One Cooldown Flow row. `cd` is the catalog cooldown in seconds; `null` means the
 * ability exists in C++ but has no catalog entry, so its duration lives only in a
 * GE blueprint - an unknown, never a 0.
 */
export interface SpellbookCooldownRow {
  id: string;
  name: string;
  cd: number | null;
  color: string;
}

/** The pure spellbook projection built by `buildSpellbookView` (`_shared/spellbookView.ts`). */
export interface SpellbookView {
  isLive: boolean;
  parsedAt: string | null;
  CORE_ATTRIBUTES: string[];
  DERIVED_ATTRIBUTES: string[];
  TAG_TREE: TagNode[];
  ABILITY_RADAR_DATA: { name: string; color: string; values: number[] }[];
  TAG_DEP_NODES: TagDepNode[];
  TAG_DEP_EDGES: TagDepEdge[];
  COOLDOWN_ABILITIES: SpellbookCooldownRow[];
  TAG_AUDIT_CATEGORIES: AuditCategory[];
  TAG_USAGE_FREQUENCY: { tag: string; count: number }[];
  /** Derived tag-hygiene audit; `null` when no live source has been parsed. */
  TAG_AUDIT: TagAuditBreakdown | null;
  TAG_DETAIL_MAP: Record<string, TagDetail>;
  /** The spellbook catalog's abilities (seed + persisted rows). */
  ABILITIES: SpellbookAbility[];
  /** The gameplay-effect list the Effects tab shows. */
  EFFECTS: GameplayEffectEntry[];
  provenance: Record<SpellbookDatasetKey, SpellbookProvenance>;
}

export type SpellbookDatasetKey = Exclude<keyof SpellbookView, 'isLive' | 'parsedAt' | 'provenance'>;

export interface SpellbookLiveData extends SpellbookView {
  isSyncing: boolean;
  refresh: () => void;
}
