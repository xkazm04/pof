/**
 * WP2 — the story acceptance checkers, tested directly (not yet registered in any pipeline).
 */
import { describe, it, expect } from 'vitest';
import { generateStoryGraph } from '@/lib/story/fixtures';
import { seedStructuralDefects } from '@/lib/story/defect-fixtures';
import {
  storyBudgetsHeld,
  storyChoicesReal,
  storyEndingsAttainable,
  storyGraphAcceptance,
  storyGraphParses,
  storyStructurallySound,
  storyVariablesDeclared,
} from '@/lib/catalog/acceptance/storyCheckers';
import { allOfMembers } from '@/lib/catalog/acceptance/combinators';
import { isContentInvariant } from '@/lib/catalog/acceptance/contentInvariant';

const clean = generateStoryGraph({ nodes: 120, seed: 4 });
const seeded = seedStructuralDefects(clean, 4).graph;
const slices = [storyStructurallySound, storyEndingsAttainable, storyVariablesDeclared, storyChoicesReal, storyBudgetsHeld];

describe('story checkers', () => {
  it('a clean graph passes every checker and the composition, at L0', () => {
    for (const c of [storyGraphParses(), ...slices.map((s) => s()), storyGraphAcceptance()]) {
      const r = c({ storyGraph: clean });
      expect(r.status, `${r.label}: ${r.reason ?? ''}`).toBe('pass');
      expect(r.tier).toBe('L0');
    }
  });

  it('accepts the document as JSON text too, and reads a named field', () => {
    expect(storyGraphParses('arc')({ arc: JSON.stringify(clean) }).status).toBe('pass');
  });

  it('absent field is pending with a reason; an invalid document fails with the importer reason', () => {
    const p = storyStructurallySound()({});
    expect(p.status).toBe('pending');
    expect(p.reason).toContain('storyGraph');
    const bad = { ...clean, variables: [{ name: 'v' }] };
    const f = storyGraphParses()({ storyGraph: bad });
    expect(f.status).toBe('fail');
    expect(f.reason).toContain('variables block failed to parse');
    expect(storyChoicesReal()({ storyGraph: bad }).status).toBe('fail');
  });

  it('each slice fails on the seeded graph and names its own codes only', () => {
    const own: Record<string, string[]> = {
      'Story graph structurally sound': ['DANGLING_EDGE', 'DUPLICATE_ID', 'CONTAINMENT_CYCLE', 'ORPHAN_NODE'],
      'Story endings attainable': ['ENDING_UNREACHABLE', 'NO_ENDING_REACHABLE', 'UNDECLARED_TERMINAL'],
      'Story variables declared': ['VAR_UNDECLARED', 'VAR_NO_REACHING_WRITE', 'VAR_DOMAIN_VIOLATION', 'VAR_WRITER_NOT_OWNER', 'VAR_SINGLETON', 'UNTYPED_CONDITION'],
      'Story choices real': ['FALSE_CHOICE'],
      'Story text budgets held': ['TEXT_BUDGET_EXCEEDED'],
    };
    for (const s of slices) {
      const r = s()({ storyGraph: seeded });
      expect(r.status).toBe('fail');
      const codes = [...r.detail.matchAll(/([A-Z_]{5,}) ×\d+/g)].map((m) => m[1]).sort();
      expect(codes).toEqual([...own[r.label]].sort());
    }
  });

  it('the composition is allOf over all six, reports the first non-pass, and is a content invariant', () => {
    const acc = storyGraphAcceptance();
    expect(allOfMembers(acc)).toHaveLength(6);
    expect(isContentInvariant(acc)).toBe(true);
    const r = acc({ storyGraph: seeded });
    expect(r.status).toBe('fail');
    expect(r.label).toBe('Story graph structurally sound');
  });
});
