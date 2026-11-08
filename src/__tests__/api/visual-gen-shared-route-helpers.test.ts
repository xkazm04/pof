/**
 * One definition per shared helper across the visual-gen serve and listing routes: `dirStamp`
 * (the listing cache's revalidation stamp) and the image MIME table were copied between routes,
 * so a new image type had to be added in several places. They live in `_lib/generatedFiles.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'app', 'api', 'visual-gen');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.ts$/.test(name) ? [full] : [];
  });
}

const count = (pattern: RegExp) =>
  sources(ROOT).reduce((n, file) => n + (readFileSync(file, 'utf8').match(pattern)?.length ?? 0), 0);

describe('visual-gen route helpers are defined once', () => {
  it('has exactly one dirStamp definition', () => {
    expect(count(/function dirStamp\(/g)).toBe(1);
  });

  it('has exactly one image MIME table (jpg/jpeg/png/webp)', () => {
    expect(count(/jpeg: 'image\/jpeg'/g)).toBe(1);
  });
});
