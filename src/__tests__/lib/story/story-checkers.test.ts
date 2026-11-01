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
  STORY_SLICE_CODES,
} from '@/lib/catalog/acceptance/storyCheckers';
import { STRUCTURAL_CODES, validateStoryGraph } from '@/lib/story/validate';
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
      // Blocking codes only: UNKNOWN_KIND and STRING_VAR_NO_VALUES are `info` and never fail a slice.
      'Story graph structurally sound': ['DANGLING_EDGE', 'DUPLICATE_ID', 'CONTAINMENT_CYCLE', 'ORPHAN_NODE', 'GATE_WITHOUT_CONDITION', 'PARENT_CONTAINS_MISMATCH', 'INFLUENCES_UNSUPPORTED'],
      'Story endings attainable': ['ENDING_UNREACHABLE', 'NO_ENDING_REACHABLE', 'UNDECLARED_TERMINAL', 'PRECEDENCE_NOT_TOTAL'],
      'Story variables declared': ['VAR_UNDECLARED', 'VAR_NO_REACHING_WRITE', 'VAR_DOMAIN_VIOLATION', 'VAR_WRITER_NOT_OWNER', 'VAR_SINGLETON', 'UNTYPED_CONDITION'],
      'Story choices real': ['FALSE_CHOICE', 'CHOICE_TOO_FEW_OPTIONS'],
      'Story text budgets held': ['TEXT_BUDGET_EXCEEDED'],
    };
    for (const s of slices) {
      const r = s()({ storyGraph: seeded });
      expect(r.status).toBe('fail');
      const codes = [...r.detail.matchAll(/([A-Z_]{5,}) ×\d+/g)].map((m) => m[1]).sort();
      expect(codes).toEqual([...own[r.label]].sort());
    }
  });

  it('every structural code is owned by EXACTLY one slice (the wave-4 codes and INFLUENCES_UNSUPPORTED included)', () => {
    const owned = Object.values(STORY_SLICE_CODES).flat();
    expect(new Set(owned).size).toBe(owned.length);
    expect([...owned].sort()).toEqual([...STRUCTURAL_CODES].sort());
    for (const c of ['CHOICE_TOO_FEW_OPTIONS', 'GATE_WITHOUT_CONDITION', 'UNKNOWN_KIND', 'PARENT_CONTAINS_MISMATCH', 'STRING_VAR_NO_VALUES', 'PRECEDENCE_NOT_TOTAL', 'INFLUENCES_UNSUPPORTED']) {
      expect(owned).toContain(c);
    }
  });

  it('info findings pass their slice and are counted in the detail', () => {
    const g = structuredClone(clean) as typeof clean & { variables: (typeof clean.variables)[number][] };
    g.variables.push({ name: 'callsign', type: 'string', domain: {}, initial: '', writers: [], scope: 'playthrough', external: false });
    expect(validateStoryGraph(g).map((f) => f.code)).toEqual(['STRING_VAR_NO_VALUES']);
    const r = storyVariablesDeclared()({ storyGraph: g });
    expect(r.status).toBe('pass');
    expect(r.detail).toContain('(1 info)');
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
