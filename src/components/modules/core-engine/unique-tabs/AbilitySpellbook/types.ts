import type { Cpu } from 'lucide-react';
import type { FeatureRow } from '@/types/feature-matrix';
import type { TagNode, TagDepNode, TagDepEdge, AuditCategory, TagDetail } from './data';

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

export interface SpellbookLiveData {
  isLive: boolean;
  isSyncing: boolean;
  parsedAt: string | null;
  refresh: () => void;
  CORE_ATTRIBUTES: string[];
  DERIVED_ATTRIBUTES: string[];
  TAG_TREE: TagNode[];
  ABILITY_RADAR_DATA: { name: string; color: string; values: number[] }[];
  TAG_DEP_NODES: TagDepNode[];
  TAG_DEP_EDGES: TagDepEdge[];
  COOLDOWN_ABILITIES: { name: string; cd: number; remaining: number; color: string }[];
  TAG_AUDIT_CATEGORIES: AuditCategory[];
  TAG_USAGE_FREQUENCY: { tag: string; count: number }[];
  TAG_AUDIT_SCORE: number;
  TAG_DETAIL_MAP: Record<string, TagDetail>;
}
