import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// scan-sweep night 2026-11-08 cli-terminal-shell — `@/x/foo` resolves to `foo.ts`
// before `foo/index.ts`, so a directory index beside a same-named module is
// unreachable through its natural import path. src/components/cli/skills/index.ts
// (a second SkillId union with different ids, 0 importers) sat behind skills.ts
// that way. Nothing in src may be shadowed like this.

const SRC = join(__dirname, '..', '..', '..');

function shadowed(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const hasIndex = ['index.ts', 'index.tsx'].some((f) => existsSync(join(full, f)));
    const sibling = ['.ts', '.tsx'].map((e) => `${full}${e}`).find((p) => existsSync(p));
    if (hasIndex && sibling) out.push(relative(SRC, sibling).replace(/\\/g, '/'));
    shadowed(full, out);
  }
  return out;
}

describe('[guard] no module shadows a same-named directory index', () => {
  it('src has no foo.ts beside foo/index.ts', () => {
    expect(shadowed(SRC, [])).toEqual([]);
  });
});
