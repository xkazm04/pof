import type { BuildProfile, CookSettings, PlatformId } from './build-profiles';
import { getEnginePath } from '@/lib/prompt-context';

// ── What a cook setting actually does ────────────────────────────────────────
//
// Three `CookSettings` fields were persisted by the profile editor and emitted by
// NOTHING: `compressTextures`, `pluginsToDisable`, `textureStreamingBudgetMB` appeared
// nowhere in this file. A user who typed `OnlineSubsystemSteam` into "Plugins to exclude
// from the build" and waited 40 minutes got a build with Steam in it — and the profile
// card ADVERTISED the phantom, rendering a "Tex Compress" badge beside a UAT preview
// containing nothing about textures. All 9 saved profiles carry `compressTextures: true`,
// so all 9 contradicted themselves on the same card.
//
// This table is the ONE map from a cook setting to the argument it emits, or to the
// recorded reason `BuildCookRun` cannot carry it. The generator emits from it and the UI
// discloses from it, so the command and the card can no longer disagree. Nothing here
// invents a flag: plugin enablement and texture compression are `.uproject`/`.ini`/
// target-rules concerns, and a command-line argument that does not exist would be a
// worse lie than the silent drop.

export interface CookSettingApplication {
  /** The label the editor and the profile card use for this setting. */
  label: string;
  /** How the setting reaches the build, or `null` when this command cannot carry it. */
  appliedAs: string | null;
  /** Required whenever `appliedAs` is null: why BuildCookRun cannot apply it. */
  reason?: string;
}

export const COOK_SETTING_APPLICATION: Record<keyof CookSettings, CookSettingApplication> = {
  usePak: { label: 'Use PAK files', appliedAs: '-pak' },
  compressPak: { label: 'Compress PAK', appliedAs: '-compressed' },
  encryptPak: { label: 'Encrypt PAK', appliedAs: '-encryptpakindex' },
  useIoStore: { label: 'IoStore (UE5)', appliedAs: '-iostore' },
  iterativeCooking: { label: 'Iterative cooking', appliedAs: '-iterativecooking' },
  cookOnTheFly: { label: 'Cook on the fly', appliedAs: '-cookonthefly' },
  mapsToInclude: { label: 'Maps to include', appliedAs: '-map=<Map1+Map2>' },
  compressTextures: {
    label: 'Compress textures',
    appliedAs: null,
    reason:
      'BuildCookRun has no texture-compression argument. Compression is decided per texture by '
      + 'the platform TextureFormat in Config/DefaultEngine.ini and each texture asset\'s own '
      + 'compression settings — the cook applies whatever those say, whatever this toggle is set to.',
  },
  pluginsToDisable: {
    label: 'Plugins to disable',
    appliedAs: null,
    reason:
      'Plugin enablement is declared in the .uproject Plugins array (or the target rules\' '
      + 'DisablePlugins), not on the UAT command line. BuildCookRun has no -disableplugin '
      + 'argument, so names listed here are NOT excluded from the build.',
  },
  textureStreamingBudgetMB: {
    label: 'Texture streaming budget',
    appliedAs: null,
    reason:
      'The streaming pool is the runtime cvar r.Streaming.PoolSize, set from '
      + 'Config/DefaultEngine.ini or a Device Profile — it is not a cook argument, so this '
      + 'number does not reach the packaged build.',
  },
};

/**
 * The boolean cook flags, in the order the command has always emitted them. Declared
 * so the emission order is a stated contract rather than an accident of object literal
 * ordering, and so a new boolean setting must be added here to reach the command.
 */
const BOOLEAN_COOK_FLAG_ORDER: (keyof CookSettings)[] = [
  'usePak', 'compressPak', 'encryptPak', 'useIoStore', 'iterativeCooking', 'cookOnTheFly',
];

/** Cook-setting keys the generated command genuinely carries. */
export const APPLIED_COOK_SETTING_KEYS = (Object.keys(COOK_SETTING_APPLICATION) as (keyof CookSettings)[])
  .filter((k) => COOK_SETTING_APPLICATION[k].appliedAs !== null);

/** Cook-setting keys `BuildCookRun` cannot carry, each with a recorded reason. */
export const NOT_APPLIED_COOK_SETTING_KEYS = (Object.keys(COOK_SETTING_APPLICATION) as (keyof CookSettings)[])
  .filter((k) => COOK_SETTING_APPLICATION[k].appliedAs === null);

/** True when the user has actually engaged a setting (a `false`/empty/0 field asks for nothing). */
export function isCookSettingEngaged(settings: CookSettings, key: keyof CookSettings): boolean {
  const v = settings[key];
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return v > 0;
  return false;
}

export interface UnappliedCookSetting {
  key: keyof CookSettings;
  label: string;
  reason: string;
  /** What the profile stores, rendered for the disclosure. */
  value: string;
}

/**
 * The settings this profile has ENGAGED that the generated command silently drops.
 * Empty when the profile asks for nothing the command cannot do — that is the only
 * state in which the card and the preview say the same thing without a disclosure.
 */
export function unappliedCookSettings(settings: CookSettings): UnappliedCookSetting[] {
  return NOT_APPLIED_COOK_SETTING_KEYS
    .filter((key) => isCookSettingEngaged(settings, key))
    .map((key) => {
      const entry = COOK_SETTING_APPLICATION[key];
      const raw = settings[key];
      return {
        key,
        label: entry.label,
        reason: entry.reason ?? 'no reason recorded',
        value: Array.isArray(raw) ? raw.join(', ') : String(raw),
      };
    });
}

/**
 * Generate a UAT BuildCookRun command from a build profile.
 */
export function generateUATCommand(
  profile: BuildProfile,
  projectPath: string,
  projectName: string,
  ueVersion: string,
): string {
  const enginePath = getEnginePath(ueVersion);
  const uatPath = `"${enginePath}\\Engine\\Build\\BatchFiles\\RunUAT.bat"`;
  const uprojectPath = `"${projectPath}\\${projectName}.uproject"`;

  const args: string[] = [
    'BuildCookRun',
    `-project=${uprojectPath}`,
    `-platform=${profile.platform}`,
    `-clientconfig=${profile.config}`,
  ];

  // Cook settings
  args.push('-cook');

  // Emitted FROM the application table, in its declared order, so a setting the UI
  // advertises and a flag the command carries cannot drift apart. A key whose
  // `appliedAs` is null emits nothing here — by design, and the UI discloses it.
  for (const key of BOOLEAN_COOK_FLAG_ORDER) {
    const flag = COOK_SETTING_APPLICATION[key].appliedAs;
    if (flag && profile.cookSettings[key] === true) {
      args.push(flag);
    }
  }

  // Map selection (the one applied setting whose argument carries a value)
  if (profile.cookSettings.mapsToInclude.length > 0) {
    args.push(`-map=${profile.cookSettings.mapsToInclude.join('+')}`);
  }

  // Staging
  if (profile.stage) {
    args.push('-stage');
  }

  // Archive
  if (profile.archive) {
    args.push('-archive');
    if (profile.archiveDir) {
      args.push(`-archivedirectory="${profile.archiveDir}"`);
    }
  }

  // Output dir
  if (profile.outputDir) {
    args.push(`-stagingdirectory="${profile.outputDir}"`);
  }

  // Run after package
  if (profile.runAfterPackage) {
    args.push('-run');
  }

  // Build flags
  args.push('-build');
  args.push('-unattended');
  args.push('-utf8output');

  // Platform-specific flags
  if (profile.platform === 'Android') {
    if (profile.platformSettings.androidMinSdk) {
      args.push(`-SetMinSDKVersion=${profile.platformSettings.androidMinSdk}`);
    }
  }

  // Custom flags
  for (const flag of profile.platformSettings.customFlags) {
    if (flag.trim()) {
      args.push(flag.trim());
    }
  }

  return `${uatPath} ${args.join(' ')}`;
}

/**
 * Generate a CLI prompt that wraps the UAT command for execution.
 */
export function generatePackagePrompt(
  profile: BuildProfile,
  projectPath: string,
  projectName: string,
  ueVersion: string,
): string {
  const command = generateUATCommand(profile, projectPath, projectName, ueVersion);

  return `Execute this UE5 packaging command. This is a BuildCookRun operation for ${profile.platform} ${profile.config}.

## Command
\`\`\`
${command}
\`\`\`

Run this command using the Bash tool. The build may take 10-60 minutes depending on project size.

Important:
- Do NOT modify the command
- Let the build run to completion
- Report the final status (success/failure)
- If it fails, summarize the error
- Report the output path and package size if successful`;
}

/**
 * Platform-specific notes for the UI.
 */
export const PLATFORM_NOTES: Record<PlatformId, string[]> = {
  Win64: [
    'Requires Visual Studio 2022 with C++ workload',
    'DirectX shader compilation may take significant time on first cook',
  ],
  Linux: [
    'Requires cross-compilation toolchain (clang)',
    'Server builds use -server flag',
  ],
  Mac: [
    'Requires Xcode with Metal support',
    'Universal binaries (x64 + arm64) use -specifiedarchitecture flag',
  ],
  Android: [
    'Requires Android Studio with NDK installed',
    'Set ANDROID_HOME and NDKROOT environment variables',
    'Minimum SDK 26 (Android 8.0) recommended',
  ],
  IOS: [
    'Requires macOS with Xcode',
    'Signing certificate and provisioning profile required',
    'Remote build from Windows via SSH is supported',
  ],
};
