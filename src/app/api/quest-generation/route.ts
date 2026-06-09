import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateQuests } from '@/lib/quest-generator';
import { getAllDocs, getDoc } from '@/lib/level-design-db';
import { logger } from '@/lib/logger';

interface ScanResponse {
  classes: Array<{ name: string; prefix: string; headerPath: string }>;
}

// Validate the request body shape before trusting it. projectPath/levelDocId are
// both optional, but when present they must be a string / integer respectively
// (unknown extra fields are ignored). Falsy values (""/0) are handled downstream
// as "not provided", matching the original graceful behaviour.
const questGenerationBodySchema = z.object({
  projectPath: z.string().optional(),
  levelDocId: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError('Request body must be valid JSON', 400);
    }

    const parsed = questGenerationBodySchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      return apiError(
        'Invalid request body',
        400,
        parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }
    const body = parsed.data;

    // Get scanned classes from project scan (or empty if no project)
    let classes: Array<{ name: string; prefix: string; headerPath: string }> = [];
    if (body.projectPath) {
      try {
        // Read from the dynamic context if available, or scan fresh
        const scanUrl = new URL('/api/filesystem/scan-project', req.url);
        const scanRes = await fetch(scanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath: body.projectPath }),
        });
        const scanJson = (await scanRes.json()) as { success: boolean; data?: ScanResponse; error?: string };
        if (scanJson.success && scanJson.data) {
          classes = scanJson.data.classes || [];
        } else {
          // Scan ran but reported a problem (e.g. missing moduleName, bad path).
          // Non-fatal — quests can still be generated from the level doc — but make
          // the reason traceable instead of silently dropping it.
          logger.warn(
            `[api/quest-generation] project scan returned no usable data: ${scanJson.error ?? 'unknown reason'}`,
          );
        }
      } catch (scanErr) {
        // The internal scan request itself failed (network / non-JSON response).
        // Surface the reason in the error payload instead of swallowing it.
        const reason = scanErr instanceof Error ? scanErr.message : String(scanErr);
        logger.warn(`[api/quest-generation] project scan request failed: ${reason}`);
        return apiError('Project scan failed', 502, reason);
      }
    }

    // Get level design doc
    let levelDoc = null;
    if (body.levelDocId) {
      levelDoc = getDoc(body.levelDocId);
    } else {
      // Use first available doc
      const allDocs = getAllDocs();
      if (allDocs.length > 0) levelDoc = allDocs[0];
    }

    const result = generateQuests(classes, levelDoc);
    return apiSuccess({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`[api/quest-generation] quest generation failed: ${message}`);
    return apiError('Quest generation failed', 500, message);
  }
}

// GET to list available level docs for the dropdown
export async function GET() {
  try {
    const docs = getAllDocs();
    return apiSuccess({
      docs: docs.map(d => ({ id: d.id, name: d.name, roomCount: d.rooms.length })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`[api/quest-generation] failed to load level docs: ${message}`);
    return apiError('Failed to load level docs', 500);
  }
}
