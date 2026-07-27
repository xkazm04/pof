import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ProjectContext } from '@/lib/prompt-context';
import { formatGotchas } from '@/lib/knowledge/ue-gotchas';
import { formatKnowledgeTips } from '@/lib/knowledge/knowledge-tips';
import { formatKnownAssets } from '@/lib/knowledge/ue-known-assets';
import { knownAssetDomainsForModule } from '@/lib/knowledge/ue-known-assets';
import { moduleKnowledge } from '@/lib/prompts/module-knowledge';
import { STANDALONE_BUILDERS } from './builder-fixtures';

/**
 * Direction 1 rail: the standalone builders in `src/lib/prompts/` join the SAME
 * knowledge routing the CLITask path already had. One parameterized suite over
 * the whole builder table — never one copy per builder.
 *
 * Each case asserts, for the builder's own module:
 *  - a module-scoped UE pitfall block is present AND contains the exact text the
 *    routing layer would produce for that module (so a superset/unscoped
 *    regression fails);
 *  - the module's authored KnowledgeTips reach the prompt when it has any;
 *  - the module's known UE asset paths reach the prompt when it owns any.
 */
const CTX: ProjectContext = {
  projectName: 'PoF',
  projectPath: 'C:\\proj\\PoF',
  ueVersion: '5.8.0',
};

describe('standalone builders join module knowledge routing', () => {
  for (const testCase of STANDALONE_BUILDERS) {
    describe(testCase.name, () => {
      const prompt = testCase.build(CTX);

      it('carries the module-scoped UE pitfalls block', () => {
        const expected = formatGotchas('ue-cpp', testCase.module);
        // Every module resolves at least the universal (untagged) pitfalls.
        expect(expected).not.toBe('');
        expect(prompt).toContain('## Known UE Pitfalls');
        expect(prompt).toContain(expected);
      });

      it('does not haul pitfalls from unrelated domains', () => {
        const superset = formatGotchas('ue-cpp');
        const scoped = formatGotchas('ue-cpp', testCase.module);
        if (superset === scoped) return; // module legitimately owns every domain
        // The superset text must NOT appear verbatim — proof the module scoping applied.
        expect(prompt).not.toContain(superset);
      });

      it('carries the module KnowledgeTips when the module authors any', () => {
        const tips = formatKnowledgeTips(testCase.module, 'ue-cpp');
        if (!tips) return;
        expect(prompt).toContain(tips);
      });

      it('carries the module known-asset paths when the module owns any', () => {
        const assets = formatKnownAssets(knownAssetDomainsForModule(testCase.module));
        if (!assets) return;
        expect(prompt).toContain(assets);
      });

      it('routes through the shared moduleKnowledge seam', () => {
        const opts = moduleKnowledge(testCase.module);
        expect(opts).toEqual({
          promptKind: 'ue-cpp',
          module: testCase.module,
          knownAssetDomains: knownAssetDomainsForModule(testCase.module),
        });
      });
    });
  }

  it('every standalone builder file is represented in the table', () => {
    const dir = path.join(process.cwd(), 'src', 'lib', 'prompts');
    // Files excluded on purpose: shared helpers + builders that live on the
    // CLITask path (ability-forge / visual-check / quality) rather than a module UI.
    const EXCLUDED = new Set([
      '_shared.ts',
      'prompt-builder.ts',
      'prompt-knowledge-summary.ts',
      'module-knowledge.ts',
      'ability-forge.ts',
      'visual-check.ts',
    ]);
    const files = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && !EXCLUDED.has(e.name))
      .map((e) => e.name.replace(/\.ts$/, ''))
      .sort();
    const covered = STANDALONE_BUILDERS.map((b) => b.name).sort();
    expect(covered).toEqual(files);
  });
});
