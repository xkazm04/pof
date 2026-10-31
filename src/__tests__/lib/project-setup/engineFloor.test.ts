import { describe, it, expect } from 'vitest';
import {
  parseRelease, compareReleases, engineFit, orderByEngineFit, engineFitNote,
} from '@/lib/project-setup/engineFloor';

// Paired A/B: arm A is the replaced rule, inlined (SetupWizard's startsWith filter and the
// browse route's localeCompare engine sort); arm B is engineFloor.
const armAList = <T extends { engineVersion: string | null }>(ps: readonly T[], selected: string) => {
  const mm = selected.split('.').slice(0, 2).join('.');
  return ps.filter((p) => !!p.engineVersion && p.engineVersion.startsWith(mm));
};
const armASortNewest = (vs: string[]) => [...vs].sort((a, b) => b.localeCompare(a));

const PILLS = ['5.5.4', '5.6.1', '5.7.3', '5.8.0'];

// The two projects detected on the authoring machine (Documents/Unreal Projects, 2026-10-31),
// installed engine UE_5.8 (Build.version 5.8.3).
const REAL = [
  { name: 'PoF', engineVersion: '5.8' },
  { name: 'jinx', engineVersion: '5.8' },
];
// Scripted cases: an older-engine project, a source-build GUID, no association, a full version.
const SCRIPTED = [
  { name: 'Legacy55', engineVersion: '5.5' },
  { name: 'SourceBuild', engineVersion: '{4B2C9E1A-0D3F-4A6B-9C1E-7F00A1B2C3D4}' },
  { name: 'NoAssoc', engineVersion: null },
  { name: 'Full571', engineVersion: '5.7.1' },
];

function score(projects: { name: string; engineVersion: string | null }[]) {
  let opensListedA = 0, opensListedB = 0, opens = 0;
  let newerWarnedA = 0, newerWarnedB = 0, newer = 0;
  let unknownListedA = 0, unknownListedB = 0, unknown = 0;
  let silentViolations = 0, matchPrefixIdentical = 0;
  for (const pill of PILLS) {
    const a = armAList(projects, pill);
    const b = orderByEngineFit(projects, pill);
    for (const p of projects) {
      const fit = engineFit(p.engineVersion, pill);
      const inA = a.includes(p);
      const row = b.find((r) => r.name === p.name)!;
      const note = engineFitNote(row.fit, p.engineVersion, pill);
      if (fit.kind === 'match' || fit.kind === 'older') {
        opens++; if (inA) opensListedA++; if (row) opensListedB++;
        if (note) silentViolations++;
      } else if (fit.kind === 'newer') {
        newer++; if (inA) newerWarnedA++; if (row && note) newerWarnedB++;
      } else {
        unknown++; if (inA) unknownListedA++; if (row && note) unknownListedB++;
      }
    }
    // Floor: arm A's list (the exact matches) is arm B's head, in the same order.
    if (JSON.stringify(b.slice(0, a.length).map((r) => r.name)) === JSON.stringify(a.map((r) => r.name))) {
      matchPrefixIdentical++;
    }
  }
  return { opens, opensListedA, opensListedB, newer, newerWarnedA, newerWarnedB,
    unknown, unknownListedA, unknownListedB, silentViolations, matchPrefixIdentical };
}

describe('engine floors (paired A/B)', () => {
  it('real projects: every pill lists them; under an older pill they are warned, not hidden', () => {
    expect(score(REAL)).toEqual({
      opens: 2, opensListedA: 2, opensListedB: 2,          // only the 5.8 pill: A and B agree
      newer: 6, newerWarnedA: 0, newerWarnedB: 6,          // 5.5/5.6/5.7 pills: A hides both
      unknown: 0, unknownListedA: 0, unknownListedB: 0,
      silentViolations: 0, matchPrefixIdentical: 4,
    });
  });

  it('scripted cases: older opens are listed silently, unknown is labelled, never hidden', () => {
    expect(score(SCRIPTED)).toEqual({
      opens: 6, opensListedA: 2, opensListedB: 6,          // Legacy55 x4 pills + Full571 x2; A lists each under one
      newer: 2, newerWarnedA: 0, newerWarnedB: 2,          // Full571 under the 5.5 and 5.6 pills
      unknown: 8, unknownListedA: 0, unknownListedB: 8,
      silentViolations: 0, matchPrefixIdentical: 4,
    });
  });

  it('newest engine is chosen by parsed release, not text', () => {
    const installed = ['5.9.0', '5.10.0', '5.8.3'];
    expect(armASortNewest(installed)[0]).toBe('5.9.0');
    expect([...installed].sort((a, b) => compareReleases(b, a))[0]).toBe('5.10.0');
  });

  it('a prefix is not a match: 5.10 is not 5.1', () => {
    expect(armAList([{ engineVersion: '5.10' }], '5.1.0')).toHaveLength(1);
    expect(engineFit('5.10', '5.1.0').kind).toBe('newer');
  });

  it('parses the release part and drops decoration', () => {
    expect(parseRelease('5.8.3-custom+cl58210709')).toEqual([5, 8, 3]);
    expect(parseRelease('5.8')).toEqual([5, 8, 0]);
    expect(parseRelease('{4B2C9E1A-0D3F-4A6B-9C1E-7F00A1B2C3D4}')).toBeNull();
    expect(parseRelease(null)).toBeNull();
  });

  it('says "major" across a major gap and stays silent above the floor', () => {
    expect(engineFitNote(engineFit('6.0', '5.8.0'), '6.0', '5.8.0')).toMatch(/a major version newer/);
    expect(engineFitNote(engineFit('5.5', '5.8.0'), '5.5', '5.8.0')).toBeNull();
    expect(engineFitNote(engineFit(null, '5.8.0'), null, '5.8.0')).toBe('No engine version recorded');
  });
});
