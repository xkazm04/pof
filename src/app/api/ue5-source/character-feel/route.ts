import fs from 'fs/promises';
import path from 'path';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api-utils';
import { parseFeelDefaults, type UESourceFile } from '@/lib/character/feel-ue-sync';

/**
 * POST /api/ue5-source/character-feel — READ-ONLY. Reads the literal feel defaults
 * from the character sources of the UE project (`Source/<Module>`, module taken
 * from the .uproject) so the AI Feel tab can show what UE holds before Apply.
 * Nothing is written. Validation mirrors /api/ue5-source/parse.
 */

const MAX_FILES = 64;
const SOURCE_EXT = /\.(h|cpp)$/i;
const FEEL_PATH = /Character|Dodge|Camera/i;

async function listSources(root: string, rel = ''): Promise<string[]> {
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(path.join(root, rel), { withFileTypes: true });
  } catch {
    return []; // no Source/<Module> — every field reads absent, scannedFiles 0
  }
  const out: string[] = [];
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await listSources(root, child));
    else if (SOURCE_EXT.test(e.name) && FEEL_PATH.test(child)) out.push(child);
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body ?? {};

    if (!projectPath || typeof projectPath !== 'string') {
      return apiError('projectPath is required', 400);
    }

    // Validate: must be absolute and contain no path traversal components
    const normalized = path.resolve(projectPath);
    if (normalized !== path.normalize(projectPath) || projectPath.includes('..')) {
      return apiError('projectPath must be an absolute path with no traversal (..)', 400);
    }

    const entries = await fs.readdir(normalized).catch(() => null);
    if (!entries) return apiError(`projectPath not readable: ${normalized}`, 404);
    const uproject = entries.find((e) => e.endsWith('.uproject'));
    if (!uproject) return apiError(`No .uproject in ${normalized}`, 404);
    const moduleName = uproject.replace(/\.uproject$/, '');

    const sourceDir = path.join(normalized, 'Source', moduleName);
    const matched = (await listSources(sourceDir)).sort();
    const picked = matched.slice(0, MAX_FILES);
    const files: UESourceFile[] = await Promise.all(picked.map(async (rel) => ({
      path: rel,
      text: await fs.readFile(path.join(sourceDir, rel), 'utf-8'),
    })));

    return apiSuccess({
      moduleName,
      sourceDir,
      scannedFiles: files.length,
      truncated: matched.length > picked.length,
      files: picked,
      fields: parseFeelDefaults(files),
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Failed to read UE character sources');
  }
}
