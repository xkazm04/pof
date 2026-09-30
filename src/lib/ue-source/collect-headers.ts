/**
 * The one read-only walker over a UE project's `Source/` directory, shared by the routes
 * that read project code: semantic verify and save-schema audit (`collectHeaders`, `.h`
 * only) and the localization scan (`collectSourceFiles` with `.h` + `.cpp`).
 *
 * Read-only: lists directories, never opens or writes a file. Skips `ThirdParty`,
 * `Intermediate` and `Binaries`, stops at `maxDepth`, silently skips unreadable
 * directories, and returns `[]` when `sourceDir` does not exist. Directory symlinks and
 * junctions are not descended (a Dirent for a link is not a directory); callers that open
 * the listed files still check containment, since a file link can point anywhere.
 */
import fsPromises from 'fs/promises';
import path from 'path';

const SKIPPED_DIRS = new Set(['ThirdParty', 'Intermediate', 'Binaries']);

/** Every file under `sourceDir` whose name ends with one of `exts` (e.g. `['.h', '.cpp']`). */
export async function collectSourceFiles(sourceDir: string, exts: readonly string[], maxDepth = 6): Promise<string[]> {
  const files: string[] = [];

  try {
    await fsPromises.access(sourceDir);
  } catch {
    return files;
  }

  async function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (SKIPPED_DIRS.has(entry.name)) continue;
          await walk(fullPath, depth + 1);
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(sourceDir, 0);
  return files;
}

const HEADER_EXTS = ['.h'] as const;

/** Every `.h` under `sourceDir`. */
export async function collectHeaders(sourceDir: string, maxDepth = 6): Promise<string[]> {
  return collectSourceFiles(sourceDir, HEADER_EXTS, maxDepth);
}
