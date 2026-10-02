/**
 * Guard: a CLI @@CALLBACK descriptor that targets a PROJECT-SCOPED route must
 * carry the run's project in its `staticFields`.
 *
 * pof-mcp's `project-scope-guard.test.ts` enumerates the MCP tools — one door
 * into the scoped routes. The CLI callback registry is the second door: the
 * server settles each `@@CALLBACK` by POSTing `{ ...payload, ...staticFields }`
 * to the descriptor's own-origin `/api/` path, and adds nothing else. A
 * descriptor that forgets the project therefore writes unattributed (`''`)
 * rows — the feature-review and feature-fix callbacks did exactly that.
 *
 * "Scoped route" = its `route.ts` uses one of the scoping primitives from
 * `@/lib/project-id`. "Carries the project" = `projectId` or `projectPath`
 * appears as a key in the descriptor's `staticFields` literal.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HANDLERS = path.join(ROOT, 'src', 'lib', 'cli-task-handlers.ts');
const SCOPE_PRIMITIVES = /\b(normalizeProjectId|projectScopeSql|isInProjectScope)\b/;

interface Descriptor {
  apiPath: string;
  staticFields: string;
}

/** The balanced `{ ... }` starting at `open` (an index of `{`). */
function balanced(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces at ${open}`);
}

function descriptors(): Descriptor[] {
  const src = fs.readFileSync(HANDLERS, 'utf8');
  const out: Descriptor[] = [];
  const re = /registerCallback\(\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const obj = balanced(src, m.index + m[0].length - 1);
    const url = /url:\s*`\$\{[^}]+\}\/api\/([^`?]+)`/.exec(obj);
    if (!url) throw new Error(`registerCallback without a resolvable /api/ url:\n${obj.slice(0, 200)}`);
    const sfAt = obj.indexOf('staticFields:');
    const staticFields = sfAt >= 0 ? balanced(obj, obj.indexOf('{', sfAt)) : '{}';
    out.push({ apiPath: url[1], staticFields });
  }
  return out;
}

const routeFile = (apiPath: string) => path.join(ROOT, 'src', 'app', 'api', ...apiPath.split('/'), 'route.ts');
const isScoped = (apiPath: string) => SCOPE_PRIMITIVES.test(fs.readFileSync(routeFile(apiPath), 'utf8'));
const carriesProject = (d: Descriptor) => /\b(projectId|projectPath)\s*[:,}]/.test(d.staticFields);

describe('CLI callback descriptors carry the project into scoped routes', () => {
  const all = descriptors();

  it('the scanner sees every descriptor and every target route exists (not blind)', () => {
    expect(all.length).toBeGreaterThanOrEqual(16);
    for (const d of all) expect(fs.existsSync(routeFile(d.apiPath)), d.apiPath).toBe(true);
  });

  it('every descriptor whose route uses the scoping primitives stamps projectId/projectPath', () => {
    const scoped = all.filter((d) => isScoped(d.apiPath));
    const targets = [...new Set(scoped.map((d) => d.apiPath))].sort();
    expect(targets).toEqual(expect.arrayContaining(['feature-matrix', 'feature-matrix/import']));
    const missing = scoped.filter((d) => !carriesProject(d)).map((d) => d.apiPath);
    expect(missing, `scoped callback targets with no project in staticFields: ${missing.join(', ')}`).toEqual([]);
  });

  it('enumerates the unscoped targets (no scoping primitive in the route today)', () => {
    const unscoped = [...new Set(all.filter((d) => !isScoped(d.apiPath)).map((d) => d.apiPath))].sort();
    expect(unscoped).toEqual(
      expect.arrayContaining([
        'ability-spec',
        'ability-spec/codegen',
        'ai-testing',
        'animations/mixamo-result',
        'audio/import-result',
        'catalog',
        'checklist/complete',
        'level-design/procgen-result',
        'level-design/scatter-result',
        'level-design/sync-result',
        'module-scan/import',
        'pipeline',
        'pipeline-artifacts',
      ]),
    );
  });
});
