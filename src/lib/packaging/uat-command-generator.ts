import type { BuildProfile, PlatformId } from './build-profiles';
import { getEnginePath } from '@/lib/prompt-context';

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

  if (profile.cookSettings.usePak) {
    args.push('-pak');
  }

  if (profile.cookSettings.compressPak) {
    args.push('-compressed');
  }

  if (profile.cookSettings.encryptPak) {
    args.push('-encryptpakindex');
  }

  if (profile.cookSettings.useIoStore) {
    args.push('-iostore');
  }

  if (profile.cookSettings.iterativeCooking) {
    args.push('-iterativecooking');
  }

  if (profile.cookSettings.cookOnTheFly) {
    args.push('-cookonthefly');
  }

  // Map selection
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
