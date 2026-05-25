import { describe, it, expect } from 'vitest';
import { GLOSSARY, lookupGlossary } from '@/lib/ecw/glossary';

describe('glossary', () => {
  it('contains seed entries for GAS terminology', () => {
    expect(GLOSSARY.GAS).toBeDefined();
    expect(GLOSSARY.GA).toBeDefined();
    expect(GLOSSARY.GE).toBeDefined();
    expect(GLOSSARY.ASC).toBeDefined();
    expect(GLOSSARY.CDO).toBeDefined();
  });

  it('contains entries for all 6 lifecycle states', () => {
    for (const state of ['planned', 'scaffolded', 'generated', 'wired', 'verified', 'failed']) {
      expect(GLOSSARY[state]).toBeDefined();
      expect(GLOSSARY[state]!.length).toBeGreaterThan(10);
    }
  });

  it('contains catalog terminology', () => {
    expect(GLOSSARY.catalog).toBeDefined();
    expect(GLOSSARY.facet).toBeDefined();
    expect(GLOSSARY.recipe).toBeDefined();
  });

  it('lookupGlossary returns the definition', () => {
    expect(lookupGlossary('GAS')).toContain('Gameplay Ability System');
  });

  it('lookupGlossary returns undefined for unknown terms', () => {
    expect(lookupGlossary('totally-not-a-term')).toBeUndefined();
  });
});
