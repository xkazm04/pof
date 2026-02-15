import type { FeatureStatus } from './feature-matrix';

// ── Asset Categories & Types ────────────────────────────────────────────────

export type MarketplaceSource = 'fab' | 'ue-marketplace';

export type AssetCategory =
  | 'character'
  | 'animation'
  | 'combat'
  | 'inventory'
  | 'ai'
  | 'ui'
  | 'vfx'
  | 'audio'
  | 'environment'
  | 'save-system'
  | 'multiplayer'
  | 'dialogue'
  | 'input'
  | 'framework'
  | 'other';

export type IntegrationDifficulty = 'drop-in' | 'adapter' | 'deep-rewrite';

// ── Marketplace Asset ───────────────────────────────────────────────────────

export interface MarketplaceAsset {
  id: string;
  name: string;
  publisher: string;
  source: MarketplaceSource;
  category: AssetCategory;
  description: string;
  /** Estimated rating out of 5 */
  rating: number;
  /** Number of ratings */
  ratingCount: number;
  /** Price in USD, 0 = free */
  price: number;
  /** UE versions supported, e.g. ["5.4", "5.5"] */
  ueVersions: string[];
  /** Whether the asset includes C++ source */
  hasSource: boolean;
  /** Whether GAS integration exists */
  gasCompatible: boolean;
  /** Tags for matching: e.g. ['inventory', 'grid', 'drag-drop'] */
  tags: string[];
  /** Integration difficulty for a typical project */
  difficulty: IntegrationDifficulty;
  /** Estimated integration time in minutes */
  integrationTimeMinutes: number;
}

// ── Feature Gap ─────────────────────────────────────────────────────────────

export interface FeatureGap {
  moduleId: string;
  moduleLabel: string;
  featureName: string;
  status: FeatureStatus;
  description: string;
  /** Estimated DIY hours from checklist */
  diyHours: number;
  /** Category for marketplace matching */
  category: AssetCategory;
}

// ── Recommendation ──────────────────────────────────────────────────────────

export interface AssetRecommendation {
  gap: FeatureGap;
  assets: ScoredAsset[];
}

export interface ScoredAsset {
  asset: MarketplaceAsset;
  /** 0–100 match score */
  matchScore: number;
  /** Why this asset matches */
  matchReasons: string[];
  /** Estimated integration time in minutes */
  integrationMinutes: number;
  /** DIY time from checklist in minutes */
  diyMinutes: number;
  /** Time saved = diyMinutes - integrationMinutes */
  timeSavedMinutes: number;
}

// ── Integration Code ────────────────────────────────────────────────────────

export interface IntegrationSpec {
  assetId: string;
  assetName: string;
  moduleId: string;
  /** Generated adapter header (.h) */
  adapterHeader: string;
  /** Generated adapter implementation (.cpp) */
  adapterSource: string;
  /** Build.cs module dependencies to add */
  buildDependencies: string[];
  /** Plugin dependencies to enable */
  pluginDependencies: string[];
  /** Step-by-step integration instructions */
  steps: IntegrationStep[];
}

export interface IntegrationStep {
  order: number;
  title: string;
  description: string;
  /** Optional file to create/modify */
  filePath?: string;
  /** Code snippet for this step */
  code?: string;
}

// ── Acquired Asset (user-tracked) ───────────────────────────────────────────

export interface AcquiredAsset {
  assetId: string;
  assetName: string;
  acquiredAt: string;
  /** Local Content/ path if installed */
  contentPath?: string;
  /** Whether integration code was generated */
  integrationGenerated: boolean;
  /** Integration spec if generated */
  integration?: IntegrationSpec;
}

// ── API request/response shapes ─────────────────────────────────────────────

export interface RecommendationRequest {
  moduleId?: string;
  statusFilter?: FeatureStatus[];
}

export interface RecommendationResponse {
  recommendations: AssetRecommendation[];
  totalGaps: number;
  totalAssets: number;
  estimatedTimeSaved: number;
}

export interface GenerateIntegrationRequest {
  assetId: string;
  moduleId: string;
  projectName: string;
  apiMacro: string;
  existingClasses: string[];
}

export interface GenerateIntegrationResponse {
  integration: IntegrationSpec;
}
