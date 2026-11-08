import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import {
  getProfiles, getProfile, upsertProfile, deleteProfile,
  type BuildProfile,
} from '@/lib/packaging/build-profiles-db';
import { PLATFORM_IDS } from '@/lib/packaging/build-profiles';
import { generateUATCommand } from '@/lib/packaging/uat-command-generator';
import { SettingsBlobCorruptError } from '@/lib/settings/settings-blob';

const BUILD_CONFIGS = ['Development', 'DebugGame', 'Shipping', 'Test'];
const isStringArray = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === 'string');

/**
 * What a profile must carry for generateUATCommand to read it. A shapeless save used to
 * persist and then throw at every later generate-command or cook. Returns the problem.
 */
function profileError(p: unknown): string | null {
  if (typeof p !== 'object' || p === null || Array.isArray(p)) return 'profile must be an object';
  const o = p as Record<string, unknown>;
  if (typeof o.name !== 'string') return 'profile.name must be a string';
  if (!(PLATFORM_IDS as unknown[]).includes(o.platform)) return `profile.platform must be one of: ${PLATFORM_IDS.join(', ')}`;
  if (!BUILD_CONFIGS.includes(o.config as string)) return `profile.config must be one of: ${BUILD_CONFIGS.join(', ')}`;
  const cook = o.cookSettings as Record<string, unknown> | null | undefined;
  if (typeof cook !== 'object' || cook === null) return 'profile.cookSettings must be an object';
  if (!isStringArray(cook.mapsToInclude)) return 'profile.cookSettings.mapsToInclude must be an array of strings';
  const platform = o.platformSettings as Record<string, unknown> | null | undefined;
  if (typeof platform !== 'object' || platform === null) return 'profile.platformSettings must be an object';
  if (!isStringArray(platform.customFlags)) return 'profile.platformSettings.customFlags must be an array of strings';
  return null;
}

export const GET = withRoute(async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const profile = getProfile(id);
    if (!profile) return apiError('Profile not found', 404);
    return apiSuccess({ profile });
  }

  const profiles = getProfiles();
  return apiSuccess({ profiles });
}, 'Failed to read profiles');

export const POST = withRoute(async (request: NextRequest) => {
  const body = await request.json().catch(() => undefined);
  // A body that is not a JSON object is the caller's error (400), not a server fault.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return apiError('Request body must be a JSON object', 400);
  }
  const action = body.action ?? 'save';

  switch (action) {
    case 'save': {
      const invalid = profileError(body.profile);
      if (invalid) return apiError(invalid, 400);
      try {
        return apiSuccess({ profile: upsertProfile(body.profile) });
      } catch (e) {
        // An unreadable stored list is refused (bytes quarantined): a store problem, not a server fault.
        if (e instanceof SettingsBlobCorruptError) return apiError(e.message, 409);
        throw e;
      }
    }
    case 'generate-command': {
      const profile = body.profile as BuildProfile;
      const { projectPath, projectName, ueVersion } = body;
      if (!profile || !projectPath || !projectName || !ueVersion) {
        return apiError('profile, projectPath, projectName, and ueVersion are required', 400);
      }
      const invalid = profileError(profile);
      if (invalid) return apiError(invalid, 400);
      const command = generateUATCommand(profile, projectPath, projectName, ueVersion);
      return apiSuccess({ command });
    }
    default:
      return apiError(`Unknown action: ${action}`, 400);
  }
}, 'Failed to save profile');

export const DELETE = withRoute(async (request: NextRequest) => {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return apiError('id is required', 400);

  const deleted = deleteProfile(id);
  if (!deleted) return apiError('Profile not found', 404);
  return apiSuccess({ deleted: true });
}, 'Failed to delete profile');
