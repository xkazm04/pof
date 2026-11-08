/**
 * Server code in `src/app/api/visual-gen` must not depend on the component tree. The status
 * route used to import `projectCritique` from the asset-forge component folder; the pure
 * projection now lives in `src/lib/visual-gen/forgeJobStatus.ts`, shared by server and client.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'app', 'api', 'visual-gen');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('visual-gen API routes do not import from src/components', () => {
  it('has no @/components import anywhere under src/app/api/visual-gen', () => {
    const offenders = sources(ROOT).filter((file) => /from\s+['"]@\/components\//.test(readFileSync(file, 'utf8')));
    expect(offenders.map((f) => f.slice(ROOT.length))).toEqual([]);
  });
});
