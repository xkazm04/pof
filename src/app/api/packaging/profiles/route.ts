import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getProfiles, getProfile, upsertProfile, deleteProfile,
  type BuildProfile,
} from '@/lib/packaging/build-profiles-db';
import { generateUATCommand } from '@/lib/packaging/uat-command-generator';

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (id) {
      const profile = getProfile(id);
      if (!profile) return apiError('Profile not found', 404);
      return apiSuccess({ profile });
    }

    const profiles = getProfiles();
    return apiSuccess({ profiles });
  } catch (error) {
    console.error('Profiles GET error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to read profiles',
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Profiles POST error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to save profile',
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) return apiError('id is required', 400);

    const deleted = deleteProfile(id);
    if (!deleted) return apiError('Profile not found', 404);
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('Profiles DELETE error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to delete profile',
      500,
    );
  }
}
