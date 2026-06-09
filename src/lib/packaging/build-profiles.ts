// Client-safe types, constants, and helpers for build profiles.
// Database functions live in build-profiles-db.ts (server-only).

export type PlatformId = 'Win64' | 'Linux' | 'Android' | 'IOS' | 'Mac';
export type BuildConfig = 'Development' | 'DebugGame' | 'Shipping' | 'Test';

export interface CookSettings {
  /** Maps to include (empty = all maps) */
  mapsToInclude: string[];
  /** Plugins to disable during cook */
  pluginsToDisable: string[];
  /** Use PAK file packaging */
  usePak: boolean;
  /** Compress PAK files */
  compressPak: boolean;
  /** Encrypt PAK files */
  encryptPak: boolean;
  /** Enable IoStore (UE5 optimized loading) */
  useIoStore: boolean;
  /** Iterative cooking (faster re-cooks) */
  iterativeCooking: boolean;
  /** Cook on-the-fly (development only) */
  cookOnTheFly: boolean;
  /** Texture streaming budget (MB, 0 = no limit) */
  textureStreamingBudgetMB: number;
  /** Compress textures */
  compressTextures: boolean;
}

export interface PlatformSettings {
  /** Target architecture (e.g., x64, arm64) */
  architecture: string;
  /** Android-specific: minimum SDK version */
  androidMinSdk?: number;
  /** Android-specific: target SDK version */
  androidTargetSdk?: number;
  /** iOS-specific: signing team ID */
  iosTeamId?: string;
  /** iOS-specific: provisioning profile */
  iosProvisionProfile?: string;
  /** Custom UAT flags for this platform */
  customFlags: string[];
}

export interface BuildProfile {
  id: string;
  name: string;
  platform: PlatformId;
  config: BuildConfig;
  isDefault: boolean;
  cookSettings: CookSettings;
  platformSettings: PlatformSettings;
  /** Output directory override (empty = default) */
  outputDir: string;
  /** Stage the build (copy to staging dir) */
  stage: boolean;
  /** Archive the build */
  archive: boolean;
  /** Archive directory */
  archiveDir: string;
  /** Run after packaging */
  runAfterPackage: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_COOK_SETTINGS: CookSettings = {
  mapsToInclude: [],
  pluginsToDisable: [],
  usePak: true,
  compressPak: true,
  encryptPak: false,
  useIoStore: true,
  iterativeCooking: false,
  cookOnTheFly: false,
  textureStreamingBudgetMB: 0,
  compressTextures: true,
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  architecture: 'x64',
  customFlags: [],
};

const PLATFORM_DEFAULTS: Record<PlatformId, Partial<PlatformSettings>> = {
  Win64: { architecture: 'x64' },
  Linux: { architecture: 'x64' },
  Mac: { architecture: 'arm64' },
  Android: { architecture: 'arm64', androidMinSdk: 26, androidTargetSdk: 34 },
  IOS: { architecture: 'arm64' },
};

export function createDefaultProfile(platform: PlatformId, config: BuildConfig = 'Shipping'): Omit<BuildProfile, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: `${platform} ${config}`,
    platform,
    config,
    isDefault: false,
    cookSettings: { ...DEFAULT_COOK_SETTINGS },
    platformSettings: { ...DEFAULT_PLATFORM_SETTINGS, ...PLATFORM_DEFAULTS[platform] },
    outputDir: '',
    stage: true,
    archive: false,
    archiveDir: '',
    runAfterPackage: false,
  };
}

// ── Canonical platform identity ──────────────────────────────────────────────
// The UE `PlatformId` token (Win64, IOS, …) is the single canonical id used for
// storage, budget lookup and history filtering. `PLATFORM_LABELS` is the one
// id→label map; `normalizePlatformId` collapses any historical spelling (a
// friendly name like "Windows", or a differently-cased token) back to the
// canonical id, and `platformLabel` resolves any spelling to its display label.

/** All canonical platform ids, in display order. */
export const PLATFORM_IDS: PlatformId[] = ['Win64', 'Linux', 'Mac', 'Android', 'IOS'];

/** The single source of truth for platform display names. */
export const PLATFORM_LABELS: Record<PlatformId, string> = {
  Win64: 'Windows',
  Linux: 'Linux',
  Mac: 'macOS',
  Android: 'Android',
  IOS: 'iOS',
};

const PLATFORM_ICONS: Record<PlatformId, string> = {
  Win64: 'Monitor',
  Linux: 'Terminal',
  Mac: 'Laptop',
  Android: 'Smartphone',
  IOS: 'Tablet',
};

// Friendly names and token spellings that map to a canonical id (lower-cased keys).
const PLATFORM_ALIASES: Record<string, PlatformId> = {
  win64: 'Win64', windows: 'Win64', win: 'Win64', pc: 'Win64',
  linux: 'Linux',
  mac: 'Mac', macos: 'Mac', osx: 'Mac', macosx: 'Mac',
  android: 'Android',
  ios: 'IOS',
};

/**
 * Collapse any historical platform spelling (friendly name or UE token, any
 * case/whitespace) to the canonical `PlatformId`. Unknown values pass through
 * unchanged so custom platforms keep working.
 */
export function normalizePlatformId(raw: string): string {
  if (!raw) return raw;
  return PLATFORM_ALIASES[raw.trim().toLowerCase()] ?? raw;
}

/** Display label for any platform spelling; unknown values pass through unchanged. */
export function platformLabel(raw: string): string {
  const id = normalizePlatformId(raw);
  return (PLATFORM_LABELS as Record<string, string>)[id] ?? raw;
}

export const SUPPORTED_PLATFORMS: Array<{ id: PlatformId; label: string; icon: string }> =
  PLATFORM_IDS.map((id) => ({ id, label: PLATFORM_LABELS[id], icon: PLATFORM_ICONS[id] }));
