import path from 'path';
import { describe, it, expect } from 'vitest';
import { planNewProject, type NewProjectPlanInput } from '@/lib/project-setup/newProjectPlan';
import { defaultBuildRequest } from '@/lib/ue5-bridge/build-run';

const ROOT = 'C:\\Users\\me\\Documents\\Unreal Projects';
const UE55 = { version: '5.5.4', path: 'C:\\Program Files\\Epic Games\\UE_5.5' };

function plan(over: Partial<NewProjectPlanInput>) {
  return planNewProject({ name: 'FreshGame', root: ROOT, entries: [], ueVersion: '5.5.4', engines: [UE55], ...over });
}

const codes = (p: ReturnType<typeof plan>) => p.issues.map((i) => i.code);

describe('planNewProject — name rule', () => {
  it("refuses 'My Game' as a UE identifier and suggests 'MyGame'", () => {
    const p = plan({ name: 'My Game' });
    expect(p.canCreate).toBe(false);
    expect(codes(p)).toContain('not-an-identifier');
    expect(p.suggestion).toBe('MyGame');
    expect(p.projectPath).toBeNull();
  });

  it.each([
    ['..', ['escapes-root', 'not-an-identifier']],
    ['3DGame', ['starts-with-digit']],
    ['CON', ['reserved-name']],
    ['A'.repeat(21), ['too-long']],
  ])('refuses %j with a named issue and no projectPath', (name, expected) => {
    const p = plan({ name });
    expect(p.canCreate).toBe(false);
    expect(p.projectPath).toBeNull();
    expect(expected.some((c) => codes(p).includes(c as never))).toBe(true);
  });
});

describe('planNewProject — collision against the real root', () => {
  const P = `${ROOT}\\arena`;

  it('an existing UE project of the same name (case-insensitive) blocks with openExisting', () => {
    const p = plan({ name: 'Arena', entries: [{ name: 'arena', hasUProject: true, path: P }] });
    expect(p.canCreate).toBe(false);
    expect(p.projectPath).toBeNull();
    const issue = p.issues.find((i) => i.code === 'project-exists');
    expect(issue?.openExisting?.path).toBe(P);
  });

  it('a foreign folder of the same name blocks (the scaffold would write into it)', () => {
    const p = plan({ name: 'Arena', entries: [{ name: 'Arena', hasUProject: false, path: `${ROOT}\\Arena` }] });
    expect(p.canCreate).toBe(false);
    expect(codes(p)).toContain('folder-exists');
  });

  it('fails closed when the root listing is unreadable — never assumes no collision', () => {
    const p = plan({ root: null, entries: null, rootError: 'list failed: 500' });
    expect(p.canCreate).toBe(false);
    expect(p.projectPath).toBeNull();
    expect(codes(p)).toContain('root-unreadable');
  });
});

describe('planNewProject — engine advisories', () => {
  it('a version that is not installed is an advisory with the installed version suggested', () => {
    const p = plan({ ueVersion: '5.8.0', engines: [UE55] });
    expect(p.canCreate).toBe(true);
    const adv = p.advisories.find((a) => a.code === 'engine-not-installed');
    expect(adv?.suggestedVersion).toBe('5.5.4');
  });

  it('no engine at all is a no-engine advisory', () => {
    const p = plan({ ueVersion: '5.8.0', engines: [] });
    expect(p.advisories.map((a) => a.code)).toContain('no-engine');
  });
});

describe('planNewProject — containment', () => {
  it('a valid name is a direct child of the root', () => {
    const p = plan({ name: 'FreshGame' });
    expect(p.canCreate).toBe(true);
    expect(p.projectPath).toBe(`${ROOT}\\FreshGame`);
    expect(path.win32.relative(ROOT, p.projectPath!)).toBe('FreshGame');
  });
});

describe('planNewProject — one name rule with Build Health', () => {
  const SAMPLES = ['My Game', 'my-game', 'A_1', 'Ünicode', 'FreshGame', '3DGame', 'CON', '..', '_Lead', 'Game.Name',
    'a/b', 'C:', 'lpt1', 'A'.repeat(20), 'A'.repeat(21), '  Padded  ', 'x'];

  it('every accepted name also passes defaultBuildRequest; every suggestion is itself accepted', () => {
    for (const name of SAMPLES) {
      const p = plan({ name });
      if (p.canCreate) {
        const build = defaultBuildRequest({ projectPath: p.projectPath!, projectName: p.identifier, ueVersion: '5.5.4' });
        expect(build.ok, `${name} accepted by the plan but refused by Build Health`).toBe(true);
      }
      if (p.suggestion) {
        const s = plan({ name: p.suggestion });
        expect(s.canCreate, `suggestion ${p.suggestion} for ${name} is not itself valid`).toBe(true);
      }
    }
  });
});
