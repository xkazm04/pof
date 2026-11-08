/**
 * ONE server-row -> local-artifact projection (`labCatalogRefresh.toLabArtifacts`). Its own doc
 * says it is "shared with the per-entity refresh in Baseline/useBaseline.ts", but useBaseline
 * hand-rolled the same mapping twice more (the hydrate effect and the drift adopt), so a field
 * added to the projection (a new verdict field the server returns) reached the refresh and was
 * silently dropped by hydration and adopt. The Baseline must project through the shared helper.
 *
 * Source scan, comments stripped first (a comment describing the rule must not satisfy it).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = stripComments(readFileSync(join(process.cwd(), 'src/components/layout-lab/Baseline/useBaseline.ts'), 'utf8'));

describe('useBaseline projects server rows through toLabArtifacts only', () => {
  it('the scan sees a hand-rolled projection (self-test)', () => {
    expect(/\.updatedAt\s*\?\?/.test(stripComments('const at = a.updatedAt ?? now; // a.updatedAt ?? x'))).toBe(true);
    expect(/\.updatedAt\s*\?\?/.test(stripComments('// a.updatedAt ?? now'))).toBe(false);
  });

  it('builds no artifact from a server row by hand', () => {
    expect(code.match(/\.updatedAt\s*\?\?/g) ?? []).toEqual([]);
  });

  it('calls the shared projection at every site that turns a server row into an artifact', () => {
    expect((code.match(/toLabArtifacts\(/g) ?? []).length).toBe(3); // hydrate, drift adopt, refresh
  });
});
