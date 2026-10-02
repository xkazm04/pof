/* ------------------------------------------------------------------ */
/*  Localization Pipeline — read a UE project's Source/ (server-only)  */
/* ------------------------------------------------------------------ */
/*                                                                     */
/*  Walks <projectPath>/Source with the shared read-only walker,       */
/*  extracts string units from every .h/.cpp, and reports what it      */
/*  read. Read-only: opens files for reading, never writes. Never      */
/*  leaves the project: a listed file whose real path is outside the   */
/*  real Source/ (a file link, a junction named *.cpp) is skipped, and  */
/*  every unit's filePath is POSIX, project-relative, under Source/.   */
/* ------------------------------------------------------------------ */

import fsPromises from 'fs/promises';
import path from 'path';
import { collectSourceFiles } from '@/lib/ue-source/collect-headers';
import { extractStrings } from '@/lib/localization/extract';
import { ok, err, type Result } from '@/types/result';
import type { ExcludedLiteralClass, RawStringUnit, ScanProvenance } from '@/types/localization-pipeline';

const SOURCE_EXTS = ['.h', '.cpp'] as const;
/** Caps keep a huge Source/ tree from stalling the request; `truncated` reports a hit. */
export const MAX_SOURCE_FILES = 3000;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;

export interface ProjectUnits {
  units: RawStringUnit[];
  provenance: ScanProvenance;
}

function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export async function readProjectUnits(projectPath: string): Promise<Result<ProjectUnits, string>> {
  const sourceDir = path.join(projectPath, 'Source');
  let realSource: string;
  try {
    const stat = await fsPromises.stat(sourceDir);
    if (!stat.isDirectory()) return err(`No Source/ directory under ${projectPath}`);
    realSource = await fsPromises.realpath(sourceDir);
  } catch {
    return err(`No Source/ directory under ${projectPath}`);
  }

  const files = (await collectSourceFiles(sourceDir, SOURCE_EXTS)).sort();
  const units: RawStringUnit[] = [];
  const excluded: Partial<Record<ExcludedLiteralClass, number>> = {};
  let filesScanned = 0;
  let literalsSeen = 0;
  let totalBytes = 0;
  let truncated = files.length > MAX_SOURCE_FILES;

  for (const file of files.slice(0, MAX_SOURCE_FILES)) {
    let content: string;
    try {
      const real = await fsPromises.realpath(file);
      if (!isInside(realSource, real)) continue;
      const stat = await fsPromises.stat(real);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
      if (totalBytes + stat.size > MAX_TOTAL_BYTES) {
        truncated = true;
        break;
      }
      totalBytes += stat.size;
      content = await fsPromises.readFile(real, 'utf8');
    } catch {
      continue; // unreadable file: skipped, not counted as scanned
    }

    const rel = path.relative(sourceDir, file).split(path.sep);
    if (rel.includes('..')) continue;
    const result = extractStrings(['Source', ...rel].join('/'), content);
    filesScanned++;
    literalsSeen += result.literalsSeen;
    units.push(...result.units);
    for (const e of result.excluded) excluded[e.class] = (excluded[e.class] ?? 0) + 1;
  }

  return ok({
    units,
    provenance: { kind: 'project', root: projectPath, filesScanned, literalsSeen, excluded, truncated },
  });
}
