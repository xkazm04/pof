import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The grading spine runs server-side (verify-static, settle, bind-icons). It must not
// reach into the UI tree: a layout-lab refactor would then break the grader.
const ROOT = join(process.cwd(), 'src', 'lib', 'catalog', 'acceptance');

describe('catalog acceptance lib', () => {
  it('imports nothing from @/components', () => {
    const offenders = readdirSync(ROOT)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /from\s+['"]@\/components\//.test(readFileSync(join(ROOT, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
