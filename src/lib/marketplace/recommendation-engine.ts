import type { SubModuleId } from '@/types/modules';
import type {
  AssetCategory,
  AssetRecommendation,
  FeatureGap,
  MarketplaceAsset,
  ScoredAsset,
  RecommendationResponse,
  UnreviewedModule,
} from '@/types/marketplace';
import { FEATURE_STATUSES, type FeatureStatus } from '@/types/feature-matrix';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import { ASSET_CATALOG } from './asset-catalog';

// ── Module → Asset category mapping ─────────────────────────────────────────

const MODULE_CATEGORY_MAP: Record<string, AssetCategory> = {
  'arpg-character': 'character',
  'arpg-animation': 'animation',
  'arpg-gas': 'combat',
  'arpg-combat': 'combat',
  'arpg-enemy-ai': 'ai',
  'arpg-inventory': 'inventory',
  'arpg-loot': 'inventory',
  'arpg-ui': 'ui',
  'arpg-progression': 'framework',
  'arpg-world': 'environment',
  'arpg-save': 'save-system',
  'arpg-polish': 'vfx',
  'models': 'environment',
  'animations': 'animation',
  'materials': 'vfx',
  'level-design': 'environment',
  'ui-hud': 'ui',
  'audio': 'audio',
  'ai-behavior': 'ai',
  'physics': 'other',
  'multiplayer': 'multiplayer',
  'save-load': 'save-system',
  'input-handling': 'other',
  'dialogue-quests': 'dialogue',
  'packaging': 'other',
};

// ── DIY hour estimates per module (from typical checklist effort) ────────────

const MODULE_DIY_HOURS: Record<string, number> = {
  'arpg-character': 4,
  'arpg-animation': 6,
  'arpg-gas': 8,
  'arpg-combat': 8,
  'arpg-enemy-ai': 6,
  'arpg-inventory': 6,
  'arpg-loot': 4,
  'arpg-ui': 8,
  'arpg-progression': 6,
  'arpg-world': 8,
  'arpg-save': 4,
  'arpg-polish': 4,
};

// ── Feature → tag keywords for matching ──────────────────────────────────────

function featureToTags(featureName: string, moduleId: SubModuleId): string[] {
  const tags: string[] = [];
  const lower = featureName.toLowerCase();

  // Extract keywords from feature name
  const words = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  tags.push(...words);

  // Add module-specific tags
  if (moduleId.includes('combat')) tags.push('combat', 'melee', 'damage');
  if (moduleId.includes('animation')) tags.push('animation', 'montage');
  if (moduleId.includes('inventory')) tags.push('inventory', 'items');
  if (moduleId.includes('gas')) tags.push('gas', 'gameplay-abilities');
  if (moduleId.includes('ai') || moduleId.includes('enemy')) tags.push('ai', 'behavior');
  if (moduleId.includes('save')) tags.push('save', 'load', 'persistence');
  if (moduleId.includes('loot')) tags.push('loot', 'drops', 'items');
  if (moduleId.includes('ui') || moduleId.includes('hud')) tags.push('ui', 'hud', 'widget');
  if (moduleId.includes('progression')) tags.push('xp', 'level', 'progression');
  if (moduleId.includes('dialogue') || moduleId.includes('quest')) tags.push('dialogue', 'quest');

  return [...new Set(tags)];
}

// ── Score an asset against a feature gap ──────────────────────────────────────

export function scoreAsset(asset: MarketplaceAsset, gap: FeatureGap): ScoredAsset | null {
  let score = 0;
  const reasons: string[] = [];
  const gapTags = featureToTags(gap.featureName, gap.moduleId);

  // Category match (0-30 points)
  if (asset.category === gap.category) {
    score += 30;
    reasons.push(`Category match: ${asset.category}`);
  }

  // Tag overlap (0-40 points)
  const tagOverlap = asset.tags.filter((t) => gapTags.includes(t));
  const tagScore = Math.min(40, tagOverlap.length * 10);
  if (tagScore > 0) {
    score += tagScore;
    reasons.push(`${tagOverlap.length} tag matches: ${tagOverlap.join(', ')}`);
  }

  // GAS compatibility bonus (0-10 points) — only for a GAS-compatible asset, on a
  // module that actually uses GAS (gas or combat).
  if (asset.gasCompatible && (gap.moduleId.includes('gas') || gap.moduleId.includes('combat'))) {
    score += 10;
    reasons.push('GAS compatible');
  }

  // Source available bonus (0-5 points)
  if (asset.hasSource) {
    score += 5;
    reasons.push('C++ source included');
  }

  // Rating bonus (0-10 points)
  score += Math.round((asset.rating / 5) * 10);
  if (asset.rating >= 4.5) reasons.push(`Highly rated (${asset.rating}/5)`);

  // Free asset bonus (0-5 points)
  if (asset.price === 0) {
    score += 5;
    reasons.push('Free');
  }

  // Minimum threshold: skip irrelevant assets
  if (score < 25) return null;

  const diyMinutes = gap.diyHours * 60;
  const integrationMinutes = asset.integrationTimeMinutes;

  return {
    asset,
    matchScore: Math.min(100, score),
    matchReasons: reasons,
    integrationMinutes,
    diyMinutes,
    timeSavedMinutes: Math.max(0, diyMinutes - integrationMinutes),
  };
}

// ── Module label lookup ──────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  'arpg-character': 'Character & Movement',
  'arpg-animation': 'Animation System',
  'arpg-gas': 'Gameplay Ability System',
  'arpg-combat': 'Combat System',
  'arpg-enemy-ai': 'Enemy AI',
  'arpg-inventory': 'Inventory & Items',
  'arpg-loot': 'Loot System',
  'arpg-ui': 'UI / HUD',
  'arpg-progression': 'Progression & XP',
  'arpg-world': 'World Building',
  'arpg-save': 'Save System',
  'arpg-polish': 'Polish & Debug',
  'models': '3D Models',
  'animations': 'Animations',
  'materials': 'Materials',
  'level-design': 'Level Design',
  'ui-hud': 'UI / HUD',
  'audio': 'Audio',
  'ai-behavior': 'AI Behavior',
  'multiplayer': 'Multiplayer',
  'save-load': 'Save / Load',
  'dialogue-quests': 'Dialogue & Quests',
};

// ── Partition the feature matrix: gaps vs unreviewed ──────────────────────────

/** Default gap filter: only features a review found missing or partial. An absent or
 *  'unknown' status is UNMEASURED, not missing — it is reported as unreviewed. */
export const DEFAULT_GAP_STATUSES: FeatureStatus[] = ['missing', 'partial'];

const KNOWN_STATUSES = new Set<string>(FEATURE_STATUSES);

export interface FeatureMatrixPartition {
  /** Features whose status passes the gap filter (default missing|partial). */
  gaps: FeatureGap[];
  /** Per module, features with no review verdict (absent / unknown) that are not gaps. */
  unreviewed: UnreviewedModule[];
}

/**
 * Split every defined feature three ways: status in `statusFilter` → gap; absent or
 * 'unknown' (and not filtered in as a gap) → unreviewed; anything else (implemented,
 * improved) → excluded. An unrecognised status string reads as 'unknown'.
 */
export function partitionFeatureMatrix(
  statusMap: ReadonlyMap<string, string>,
  moduleFilter?: string,
  statusFilter: readonly FeatureStatus[] = DEFAULT_GAP_STATUSES,
): FeatureMatrixPartition {
  const gaps: FeatureGap[] = [];
  const unreviewed: UnreviewedModule[] = [];

  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    if (moduleFilter && moduleId !== moduleFilter) continue;
    const defs = features ?? [];
    const moduleLabel = MODULE_LABELS[moduleId] ?? moduleId;
    const unreviewedNames: string[] = [];

    for (const feat of defs) {
      const raw = statusMap.get(`${moduleId}::${feat.featureName}`);
      const status: FeatureStatus = raw && KNOWN_STATUSES.has(raw) ? (raw as FeatureStatus) : 'unknown';

      if (statusFilter.includes(status)) {
        gaps.push({
          moduleId: moduleId as SubModuleId,
          moduleLabel,
          featureName: feat.featureName,
          featureNames: [feat.featureName],
          status,
          description: feat.description,
          diyHours: (MODULE_DIY_HOURS[moduleId] ?? 4) / (defs.length || 1),
          category: MODULE_CATEGORY_MAP[moduleId] ?? 'other',
        });
      } else if (status === 'unknown') {
        unreviewedNames.push(feat.featureName);
      }
    }

    if (unreviewedNames.length > 0) {
      unreviewed.push({ moduleId: moduleId as SubModuleId, moduleLabel, featureNames: unreviewedNames });
    }
  }

  return { gaps, unreviewed };
}

/** The gap half of {@link partitionFeatureMatrix}. */
export function buildFeatureGaps(
  statusMap: ReadonlyMap<string, string>,
  moduleFilter?: string,
  statusFilter: readonly FeatureStatus[] = DEFAULT_GAP_STATUSES,
): FeatureGap[] {
  return partitionFeatureMatrix(statusMap, moduleFilter, statusFilter).gaps;
}

// ── Generate recommendations ─────────────────────────────────────────────────

export function generateRecommendations(
  gaps: FeatureGap[],
  catalog: MarketplaceAsset[] = ASSET_CATALOG,
  unreviewed: UnreviewedModule[] = [],
): RecommendationResponse {
  const recommendations: AssetRecommendation[] = [];
  let totalTimeSaved = 0;

  // Group gaps by module for cleaner results
  const gapsByModule = new Map<string, FeatureGap[]>();
  for (const gap of gaps) {
    const existing = gapsByModule.get(gap.moduleId) ?? [];
    existing.push(gap);
    gapsByModule.set(gap.moduleId, existing);
  }

  for (const [, moduleGaps] of gapsByModule) {
    // Score each asset against the aggregate of gaps in this module
    const assetScores = new Map<string, ScoredAsset>();

    for (const gap of moduleGaps) {
      for (const asset of catalog) {
        const scored = scoreAsset(asset, gap);
        if (!scored) continue;

        const existing = assetScores.get(asset.id);
        if (!existing || scored.matchScore > existing.matchScore) {
          assetScores.set(asset.id, scored);
        }
      }
    }

    // Sort by score and take top 5 per module-gap group
    const topAssets = [...assetScores.values()]
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    if (topAssets.length > 0) {
      // One group per module: the typed list of its gap features (definition order).
      const featureNames = moduleGaps.flatMap((g) => g.featureNames);
      const representativeGap: FeatureGap = {
        ...moduleGaps[0],
        featureName: `${featureNames.length} feature ${featureNames.length === 1 ? 'gap' : 'gaps'}`,
        featureNames,
        description: `${featureNames.length} missing or partial in ${moduleGaps[0].moduleLabel}`,
        diyHours: moduleGaps.reduce((sum, g) => sum + g.diyHours, 0),
      };

      recommendations.push({
        gap: representativeGap,
        assets: topAssets,
      });

      totalTimeSaved += topAssets[0]?.timeSavedMinutes ?? 0;
    }
  }

  // Sort recommendations by number of gaps addressed
  recommendations.sort((a, b) => b.gap.featureNames.length - a.gap.featureNames.length);

  return {
    recommendations,
    totalGaps: gaps.length,
    totalAssets: catalog.length,
    estimatedTimeSaved: totalTimeSaved,
    unreviewed,
    totalUnreviewed: unreviewed.reduce((n, m) => n + m.featureNames.length, 0),
  };
}
