/**
 * Lens-file linter — every craft lens (src/lib/craft/lenses/*.md) must be a complete,
 * versioned, citation-grounded rubric: frontmatter pinned to lens-versions.ts, named
 * benchmark anchors, ≥6 kebab-case criteria EACH carrying a Source citation, scoring
 * guidance and a ceiling statement. This is what keeps "AAA" auditable instead of an
 * LLM's vibe: a criterion with no source does not ship.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LENS_IDS } from '@/lib/craft/lens-map';
import { LENS_VERSIONS } from '@/lib/craft/lens-versions';
import { A_LADDER } from '@/lib/status/craft';

const LENS_DIR = path.resolve(__dirname, '../../../lib/craft/lenses');

function frontmatter(src: string): Record<string, string> {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

describe('craft lens library', () => {
  it('every lens id has a rubric file', () => {
    for (const lens of LENS_IDS) {
      expect(fs.existsSync(path.join(LENS_DIR, `${lens}.md`)), `missing lens file: ${lens}.md`).toBe(true);
    }
  });

  it('no orphan lens files outside LENS_IDS', () => {
    const files = fs.readdirSync(LENS_DIR).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      expect(LENS_IDS as readonly string[], `orphan lens file: ${f}`).toContain(f.replace(/\.md$/, ''));
    }
  });

  for (const lens of LENS_IDS) {
    describe(lens, () => {
      const file = path.join(LENS_DIR, `${lens}.md`);
      const src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      const fm = frontmatter(src);

      it('frontmatter pins id, version and ceiling', () => {
        expect(fm.lensId).toBe(lens);
        expect(Number(fm.lensVersion)).toBe(LENS_VERSIONS[lens]);
        expect(A_LADDER as readonly string[]).toContain(fm.ceiling);
        expect(fm.appliesTo?.length ?? 0).toBeGreaterThan(0);
      });

      it('has anchors, scoring guidance and a ceiling statement', () => {
        expect(src).toContain('## Benchmark anchors');
        expect(src).toContain('## Scoring guidance');
        expect(src).toContain('## Ceiling statement');
        // Anchors name all four gauged levels (A0 is absence and never described).
        for (const level of ['A4', 'A3', 'A2', 'A1']) expect(src).toContain(`**${level}`);
      });

      it('carries ≥6 kebab-case criteria, each with a Source citation', () => {
        const criteria = [...src.matchAll(/^### ([a-z0-9]+(?:-[a-z0-9]+)+) — /gm)].map((m) => m[1]);
        expect(criteria.length, `criteria found: ${criteria.join(', ')}`).toBeGreaterThanOrEqual(6);
        expect(new Set(criteria).size).toBe(criteria.length);
        const sources = [...src.matchAll(/^Source: .{10,}$/gm)];
        expect(sources.length, 'every criterion needs a Source line').toBeGreaterThanOrEqual(criteria.length);
      });

      it('stays within the authoring bound (≤190 lines)', () => {
        expect(src.split(/\r?\n/).length).toBeLessThanOrEqual(190);
      });
    });
  }
});
