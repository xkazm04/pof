import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import {
  getBuilds, getBuild, insertBuild, deleteBuild,
  getBuildStats, getSizeTrend, getPlatforms,
  type BuildRecordInput,
} from '@/lib/packaging/build-history-store';
import { getCurrentVersion, bumpVersion, formatVersion, autoIncrementOnSuccess } from '@/lib/packaging/version-manager';

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action') ?? 'list';

    switch (action) {
      case 'list': {
        const limit = Number(request.nextUrl.searchParams.get('limit') ?? '100');
        const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');
        const builds = getBuilds(limit, offset);
        return apiSuccess({ builds });
      }
      case 'get': {
        const id = Number(request.nextUrl.searchParams.get('id'));
        if (!id) return apiError('id is required', 400);
        const build = getBuild(id);
        if (!build) return apiError('Build not found', 404);
        return apiSuccess({ build });
      }
      case 'stats': {
        const stats = getBuildStats();
        return apiSuccess({ stats });
      }
      case 'trend': {
        const platform = request.nextUrl.searchParams.get('platform') ?? undefined;
        const limit = Number(request.nextUrl.searchParams.get('limit') ?? '30');
        const trend = getSizeTrend(platform, limit);
        return apiSuccess({ trend });
      }
      case 'platforms': {
        const platforms = getPlatforms();
        return apiSuccess({ platforms });
      }
      case 'version': {
        const version = getCurrentVersion();
        return apiSuccess({ version: formatVersion(version), parsed: version });
      }
      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Packaging history GET error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to read build history',
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action ?? 'record';

    switch (action) {
      case 'record': {
        const input: BuildRecordInput = {
          platform: body.platform,
          config: body.config ?? 'Development',
          status: body.status,
          sizeBytes: body.sizeBytes ?? null,
          durationMs: body.durationMs ?? null,
          version: body.version ?? null,
          outputPath: body.outputPath ?? null,
          errorSummary: body.errorSummary ?? null,
          cookTimeMs: body.cookTimeMs ?? null,
          warningCount: body.warningCount ?? 0,
          errorCount: body.errorCount ?? 0,
          notes: body.notes ?? null,
        };

        if (!input.platform || !input.status) {
          return apiError('platform and status are required', 400);
        }

        // Auto-version on success if no explicit version provided
        if (input.status === 'success' && !input.version) {
          input.version = autoIncrementOnSuccess();
        }

        const record = insertBuild(input);
        return apiSuccess({ build: record });
      }
      case 'bump-version': {
        const type = body.type as 'major' | 'minor' | 'patch';
        if (!['major', 'minor', 'patch'].includes(type)) {
          return apiError('type must be major, minor, or patch', 400);
        }
        const version = bumpVersion(type);
        return apiSuccess({ version: formatVersion(version), parsed: version });
      }
      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Packaging history POST error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to record build',
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!id) return apiError('id is required', 400);

    const deleted = deleteBuild(id);
    if (!deleted) return apiError('Build not found', 404);
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error('Packaging history DELETE error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to delete build',
      500,
    );
  }
}
