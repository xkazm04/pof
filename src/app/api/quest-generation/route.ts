import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { generateQuests } from '@/lib/quest-generator';
import { getAllDocs, getDoc } from '@/lib/level-design-db';

interface ScanResponse {
  classes: Array<{ name: string; prefix: string; headerPath: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      projectPath?: string;
      levelDocId?: number;
    };

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
        const scanJson = (await scanRes.json()) as { success: boolean; data?: ScanResponse };
        if (scanJson.success && scanJson.data) {
          classes = scanJson.data.classes || [];
        }
      } catch {
        // Scan failed — proceed with empty classes
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
    console.error('Quest generation error:', e);
    return apiError('Quest generation failed', 500, String(e));
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
    console.error('Quest generation GET error:', e);
    return apiError('Failed to load level docs', 500);
  }
}
