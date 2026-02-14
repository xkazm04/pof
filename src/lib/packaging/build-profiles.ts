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

export const SUPPORTED_PLATFORMS: Array<{ id: PlatformId; label: string; icon: string }> = [
  { id: 'Win64', label: 'Windows', icon: 'Monitor' },
  { id: 'Linux', label: 'Linux', icon: 'Terminal' },
  { id: 'Mac', label: 'macOS', icon: 'Laptop' },
  { id: 'Android', label: 'Android', icon: 'Smartphone' },
  { id: 'IOS', label: 'iOS', icon: 'Tablet' },
];
