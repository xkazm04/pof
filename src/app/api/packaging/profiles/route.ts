import { NextRequest } from 'next/server';
import { apiSuccess, apiError, withRoute } from '@/lib/api-utils';
import {
  getProfiles, getProfile, upsertProfile, deleteProfile,
  type BuildProfile,
} from '@/lib/packaging/build-profiles-db';
import { generateUATCommand } from '@/lib/packaging/uat-command-generator';

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
  const body = await request.json();
  const action = body.action ?? 'save';

  switch (action) {
    case 'save': {
      const profile = upsertProfile(body.profile);
      return apiSuccess({ profile });
    }
    case 'generate-command': {
      const profile = body.profile as BuildProfile;
      const { projectPath, projectName, ueVersion } = body;
      if (!profile || !projectPath || !projectName || !ueVersion) {
        return apiError('profile, projectPath, projectName, and ueVersion are required', 400);
      }
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
