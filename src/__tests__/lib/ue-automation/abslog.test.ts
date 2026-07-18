import { describe, it, expect } from 'vitest';
import { readAbslogFacts, scopeAbslogPerTest, ZERO_MATCH_DETAIL } from '@/lib/ue-automation/abslog';

describe('readAbslogFacts — the ONE marker parser', () => {
  it('counts Result={Passed|Success} and Result={Failed|Fail|Failure}', () => {
    const f = readAbslogFacts('Result={Passed} Name={A}\nResult={Success} Name={B}\nResult={Failure} Name={C}');
    expect(f.resultPass).toBe(2);
    expect(f.resultFail).toBe(1);
    expect(f.passed).toBe(2);
    expect(f.failed).toBe(1);
    expect(f.total).toBe(3);
  });

  it('folds [gate] RESULT=PASS/FAIL into the pass/fail totals', () => {
    expect(readAbslogFacts('[gate] RESULT=PASS').passed).toBe(1);
    expect(readAbslogFacts('[gate] RESULT=FAIL').failed).toBe(1);
  });

  it('flags the zero-match signals (listed set / completed / fatal / empty)', () => {
    const f = readAbslogFacts('LogAutomationController: 8621 tests available\nLogExit: Exiting.');
    expect(f.listedTestSet).toBe(true);
    expect(f.completed).toBe(false);
    expect(f.fatal).toBe(false);
    expect(f.total).toBe(0);
    expect(readAbslogFacts('').empty).toBe(true);
    expect(readAbslogFacts('Test Completed. Result={Success}').completed).toBe(true);
    expect(readAbslogFacts('Fatal error! crash').fatal).toBe(true);
  });
});

describe('scopeAbslogPerTest — per-test verdicts, no batch smear', () => {
  it('credits each test only by its OWN Name={…} marker', () => {
    const log = [
      'Test Completed. Result={Success} Name={Project.Maps.Arena.VSItemsTest}',
      'Test Completed. Result={Failure} Name={Project.Maps.Arena.VSLootTest}',
    ].join('\n');
    const m = scopeAbslogPerTest(log, ['VSItemsTest', 'VSLootTest']);
    expect(m.get('VSItemsTest')!.status).toBe('pass');
    expect(m.get('VSLootTest')!.status).toBe('fail');
  });

  it('a test that started but produced no marker (crash) is `none`, never a sibling\'s pass', () => {
    const log = [
      'Test Completed. Result={Success} Name={Project.VSAlphaTest}',
      'Beginning test Project.VSBetaTest',
      'Fatal error!',
    ].join('\n');
    const m = scopeAbslogPerTest(log, ['VSAlphaTest', 'VSBetaTest']);
    expect(m.get('VSAlphaTest')!.status).toBe('pass');
    expect(m.get('VSBetaTest')!.status).toBe('none');
    expect(m.get('VSBetaTest')!.detail).toMatch(/mentioned but no per-test result/);
  });

  it('a test absent from the log is `none` (not observed)', () => {
    const m = scopeAbslogPerTest('Result={Success} Name={Project.VSAlphaTest}', ['VSGhostTest']);
    expect(m.get('VSGhostTest')!.status).toBe('none');
    expect(m.get('VSGhostTest')!.detail).toMatch(/not observed/);
  });

  it('does NOT mis-credit: a Name-carrying pass line for A never leaks to B', () => {
    // The line names VSAlphaTest; even though it also textually contains "test", B is not credited.
    const m = scopeAbslogPerTest('Result={Success} Name={Project.VSAlphaTest}', ['VSAlphaTest', 'VSBetaTest']);
    expect(m.get('VSAlphaTest')!.status).toBe('pass');
    expect(m.get('VSBetaTest')!.status).toBe('none');
  });

  it('falls back to a raw mention for a marker line with no Name={…} (e.g. a [gate] line)', () => {
    const m = scopeAbslogPerTest('[gate] RESULT=PASS for VSPythonGate', ['VSPythonGate']);
    expect(m.get('VSPythonGate')!.status).toBe('pass');
  });

  it('attributes a LEAF marker (Name={NPCConfig}) to its dotted declared name when the leaf is unique', () => {
    // UE marker lines often carry only the leaf test name while the artifact declares the
    // full dotted spec — the exact Vael drain gap.
    const m = scopeAbslogPerTest(
      'Test Completed. Result={Success} Name={NPCConfig}',
      ['PoF.CharacterVael.NPCConfig'],
    );
    expect(m.get('PoF.CharacterVael.NPCConfig')!.status).toBe('pass');
  });

  it('attributes a dotted marker ending in the leaf to the dotted declared name', () => {
    const m = scopeAbslogPerTest(
      'Test Completed. Result={Failure} Name={Tests.NPCConfig}',
      ['PoF.CharacterVael.NPCConfig'],
    );
    expect(m.get('PoF.CharacterVael.NPCConfig')!.status).toBe('fail');
  });

  it('NEVER leaf-attributes when two requested tests share the leaf — both stay unobserved', () => {
    const m = scopeAbslogPerTest(
      'Test Completed. Result={Success} Name={NPCConfig}',
      ['PoF.CharacterVael.NPCConfig', 'PoF.CharacterBoss.NPCConfig'],
    );
    expect(m.get('PoF.CharacterVael.NPCConfig')!.status).toBe('none');
    expect(m.get('PoF.CharacterBoss.NPCConfig')!.status).toBe('none');
  });

  it('leaf matching never fires on a mere substring (Name={MyNPCConfig} ≠ leaf NPCConfig)', () => {
    const m = scopeAbslogPerTest(
      'Test Completed. Result={Success} Name={MyNPCConfig}',
      ['PoF.CharacterVael.NPCConfig'],
    );
    expect(m.get('PoF.CharacterVael.NPCConfig')!.status).toBe('none');
  });
});

describe('ZERO_MATCH_DETAIL', () => {
  it('is the documented shared zero-match phrase', () => {
    expect(ZERO_MATCH_DETAIL).toMatch(/planned, not registered/);
  });
});
