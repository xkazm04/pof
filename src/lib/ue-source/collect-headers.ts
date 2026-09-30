/**
 * Every `.h` under a UE project's `Source/` directory — the one walker the header-reading
 * routes share (semantic verify, save-schema audit).
 *
 * Read-only: lists directories, never opens or writes a file. Skips `ThirdParty`,
 * `Intermediate` and `Binaries`, stops at `maxDepth`, silently skips unreadable
 * directories, and returns `[]` when `sourceDir` does not exist.
 */
import fsPromises from 'fs/promises';
import path from 'path';

const SKIPPED_DIRS = new Set(['ThirdParty', 'Intermediate', 'Binaries']);

export async function collectHeaders(sourceDir: string, maxDepth = 6): Promise<string[]> {
  const headers: string[] = [];

  try {
    await fsPromises.access(sourceDir);
  } catch {
    return headers;
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
        } else if (entry.name.endsWith('.h')) {
          headers.push(fullPath);
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(sourceDir, 0);
  return headers;
}
