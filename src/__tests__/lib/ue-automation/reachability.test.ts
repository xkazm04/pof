import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditReachability,
  drainVerdictNames,
  formatReachabilityReport,
  parseAutomationList,
  scanDeclaredTests,
  scanPlacementEvidence,
  type Finding,
  type LastDrain,
  type SourceFile,
} from '@/lib/ue-automation/reachability';
import { parseAutomationReport } from '@/lib/test-gate-runner/batchAutomation';

// ---- fixtures -----------------------------------------------------------------------------

const PREFIX = '[2026.05.24-12.43.17:768][593]LogAutomationCommandLine: Display: ';
const header = (n: number) => `${PREFIX}Found ${n} Automation Tests`;
const nameLine = (n: string) => `${PREFIX}\t'${n}'`;
/** A well-formed capture: the header count matches the names. */
const capture = (names: string[]) => [header(names.length), ...names.map(nameLine)].join('\n');

const simple = (cls: string, name: string) =>
  `IMPLEMENT_SIMPLE_AUTOMATION_TEST(\n\t${cls},\n\t"${name}",\n\tEAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)\n`;
const actor = (cls: string, base = 'AFunctionalTest', spec = '') =>
  `UCLASS(${spec})\nclass POF_API ${cls} : public ${base}\n{\n\tGENERATED_BODY()\npublic:\n\t${cls}();\n};\n`;
const cpp = (path: string, text: string): SourceFile => ({ path, text });

describe('parseAutomationList', () => {
  // Verbatim lines 1070-1075 and 4231 of the real capture Saved/Logs/vs_list.log (UE, 2026-05-24).
  const real = [
    '[2026.05.24-12.43.17:768][593]LogAutomationCommandLine: Display: Found 4985 Automation Tests',
    "[2026.05.24-12.43.17:768][593]LogAutomationCommandLine: Display: \t'Audio.Metasound.Asset.FindAssetClassInfo'",
    "[2026.05.24-12.43.17:768][593]LogAutomationCommandLine: Display: \t'Audio.Metasound.AutomatedNodeTest.Bind.AbsoluteValue.Abs.Audio v1.0'",
    "[2026.05.24-12.43.17:807][593]LogAutomationCommandLine: Display: \t'Project.Functional Tests.Maps.VerticalSlice.VSArenaBoundsTest'",
  ].join('\n');

  it('reads the real engine format: spaces, dots and versions survive in the name', () => {
    const p = parseAutomationList(real);
    expect(p.names).toEqual([
      'Audio.Metasound.Asset.FindAssetClassInfo',
      'Audio.Metasound.AutomatedNodeTest.Bind.AbsoluteValue.Abs.Audio v1.0',
      'Project.Functional Tests.Maps.VerticalSlice.VSArenaBoundsTest',
    ]);
    expect(p.declaredCounts).toEqual([4985]);
  });

  it('an excerpt whose header declares more names than it carries reads as truncated', () => {
    expect(parseAutomationList(real).truncated).toBe(true);
    expect(parseAutomationList(capture(['A.B', 'C.D'])).truncated).toBe(false);
  });

  it('reads CRLF and a log with no timestamp prefix', () => {
    const text = "LogAutomationCommandLine: Display: Found 2 Automation Tests\r\nLogAutomationCommandLine: Display: \t'A.B'\r\nLogAutomationCommandLine: Display: \t'C.D'\r\n";
    const p = parseAutomationList(text);
    expect(p.names).toEqual(['A.B', 'C.D']);
    expect(p.truncated).toBe(false);
  });

  it('never mistakes a RunTests log or other engine lines for a list', () => {
    const runLog = [
      `${PREFIX}Found 1 automation tests based on 'VSItems'`,
      `${PREFIX}\tProject.Functional Tests.Maps.VSItems.VSItemsDefinitionsTest`,
      `${PREFIX}No automation tests matched 'Nothing'`,
      'LogAutomationController: 5001 tests available on 3023E0A0',
    ].join('\n');
    const p = parseAutomationList(runLog);
    expect(p.names).toEqual([]);
    expect(p.nameLines).toBe(0);
  });

  it('counts duplicate name lines once and reports them', () => {
    const p = parseAutomationList([header(3), nameLine('A.B'), nameLine('A.B'), nameLine('C.D')].join('\n'));
    expect(p.names).toEqual(['A.B', 'C.D']);
    expect(p.duplicates).toBe(1);
    expect(p.nameLines).toBe(3);
  });

  it('missing, blank and non-list input yield no names rather than throwing', () => {
    for (const t of [undefined, null, '', '   \n', 'Fatal error! crash']) {
      expect(parseAutomationList(t).names).toEqual([]);
    }
  });
});

describe('scanDeclaredTests', () => {
  it('reads a macro test and an actor in the shapes the real tree uses', () => {
    const scan = scanDeclaredTests([
      // Shape of Source/PoF/Test/Combat/VSGenFireballEffectTest.cpp lines 21-24 (tab-indented, multi-line).
      cpp('Combat/VSGenFireballEffectTest.cpp', simple('FVSGenFireballEffectTest', 'Project.Functional Tests.PoF.GenFireball.EffectConfig')),
      // Shape of Source/PoF/Test/Combat/VSCombatDamageFormulaTest.h lines 19-20.
      cpp('Combat/VSCombatDamageFormulaTest.h', actor('AVSCombatDamageFormulaTest')),
      // No API macro, derived from the project's own base (VSForcePushKnockbackTest.h).
      cpp('Combat/VSForcePushKnockbackTest.h', actor('AVSForcePushKnockbackTest', 'AARPGFunctionalTestBase')),
      cpp('ARPGFunctionalTestBase.h', actor('AARPGFunctionalTestBase', 'AFunctionalTest', 'Abstract')),
    ]);
    const by = Object.fromEntries(scan.tests.map((t) => [t.className, t]));
    expect(by.FVSGenFireballEffectTest).toMatchObject({ kind: 'simple', registeredName: 'Project.Functional Tests.PoF.GenFireball.EffectConfig' });
    expect(by.AVSCombatDamageFormulaTest).toMatchObject({ kind: 'functional-actor', base: 'AFunctionalTest' });
    // Inherits through a project base, found because that base is in the scanned tree.
    expect(by.AVSForcePushKnockbackTest).toMatchObject({ kind: 'functional-actor', base: 'AARPGFunctionalTestBase' });
    expect(scan.tests).toHaveLength(3);
    expect(scan.abstractSkipped).toEqual(['AARPGFunctionalTestBase']);
  });

  it('ignores UCLASS declarations that are not functional tests, and counts them', () => {
    const scan = scanDeclaredTests([
      cpp('Economy/VSCurrencyWalletTest.h', 'UCLASS()\nclass UVSWalletChangeCounter : public UObject\n{\n\tGENERATED_BODY()\n};\n'),
      cpp('Environment/VSPropInteractTest.h', 'UCLASS()\nclass AVSPropLootMarker : public AActor\n{\n\tGENERATED_BODY()\n};\n'),
    ]);
    expect(scan.tests).toEqual([]);
    expect(scan.otherClasses).toBe(2);
  });

  it('does not read a macro that only appears in a comment, a #define or a string', () => {
    const scan = scanDeclaredTests([
      cpp(
        'Dialogue/VSDialogBranchTest.h',
        [
          '/**',
          ' * The gate is an IMPLEMENT_SIMPLE_AUTOMATION_TEST (no map / no PIE) that',
          ' * IMPLEMENT_SIMPLE_AUTOMATION_TEST(FGhost, "Project.Ghost", 0)',
          ' */',
          '// IMPLEMENT_SIMPLE_AUTOMATION_TEST(FGhost2, "Project.Ghost2", 0)',
          '#define MY_SIMPLE(TClass, PrettyName) IMPLEMENT_SIMPLE_AUTOMATION_TEST(TClass, "Project.Ghost3", 0)',
          'const char* Url = "http://example.com/IMPLEMENT_SIMPLE_AUTOMATION_TEST";',
        ].join('\n'),
      ),
    ]);
    expect(scan.tests).toEqual([]);
    expect(scan.unparsedMacros).toEqual([]);
  });

  it('reads the complex, custom and spec macro forms', () => {
    const scan = scanDeclaredTests([
      cpp('a.cpp', 'IMPLEMENT_COMPLEX_AUTOMATION_TEST(FMyComplex, "Project.Complex", EAutomationTestFlags::EditorContext)'),
      cpp('b.cpp', 'IMPLEMENT_CUSTOM_SIMPLE_AUTOMATION_TEST(FMyCustom, FBaseTest, "Project.Custom", EAutomationTestFlags::EditorContext)'),
      cpp('c.cpp', 'BEGIN_DEFINE_SPEC(FMySpec, "Project.Spec", EAutomationTestFlags::EditorContext)\nEND_DEFINE_SPEC(FMySpec)'),
    ]);
    expect(scan.tests.map((t) => [t.kind, t.className, t.registeredName])).toEqual([
      ['complex', 'FMyComplex', 'Project.Complex'],
      ['simple', 'FMyCustom', 'Project.Custom'],
      ['spec', 'FMySpec', 'Project.Spec'],
    ]);
  });

  it('counts a test macro it cannot read instead of dropping it silently', () => {
    const scan = scanDeclaredTests([cpp('odd.cpp', 'IMPLEMENT_SIMPLE_AUTOMATION_TEST(FOdd, NAME_FROM_A_CONSTANT, 0)')]);
    expect(scan.tests).toEqual([]);
    expect(scan.unparsedMacros).toHaveLength(1);
    expect(scan.unparsedMacros[0].file).toBe('odd.cpp');
  });

  it('reports one registered name declared by two classes', () => {
    const scan = scanDeclaredTests([cpp('a.cpp', simple('FA', 'Project.Same')), cpp('b.cpp', simple('FB', 'Project.Same'))]);
    expect(scan.duplicateNames).toEqual(['Project.Same']);
  });
});

describe('scanPlacementEvidence', () => {
  const tests = scanDeclaredTests(
    ['AVSCombatGrayBoxPathTest', 'AVSCombatDamageFormulaTest', 'AVSForcePushKnockbackTest', 'AVSArenaSetupTest', 'AVSInventoryPotionTest', 'AVSLonelyTest'].map((c) =>
      cpp(`${c}.h`, actor(c)),
    ),
  ).tests;
  const place = (...scripts: SourceFile[]) => scanPlacementEvidence(scripts, tests);

  it('binds the label on a table row (place_combat_tests.py shape)', () => {
    // Verbatim shape of Content/Python/place_combat_tests.py lines 17-23, 35-44.
    const m = place(
      cpp(
        'place_combat_tests.py',
        [
          'TESTS = [',
          '    ("/Script/PoF.VSCombatGrayBoxPathTest", "VSCombatGrayBoxPathTest", unreal.Vector(0.0, 0.0, 220.0)),',
          '    # Damage formula - authored earlier but never placed, so it never ran.',
          '    ("/Script/PoF.VSCombatDamageFormulaTest", "VSCombatDamageFormulaTest", unreal.Vector(0.0, 0.0, 280.0)),',
          ']',
          'for cls_path, label, loc in TESTS:',
          '    cls = unreal.load_class(None, cls_path)',
          '    actor = aes.spawn_actor_from_class(cls, loc)',
        ].join('\n'),
      ),
    );
    expect(m.get('AVSCombatGrayBoxPathTest')).toMatchObject({ strength: 'named-in-spawning-script', labels: ['VSCombatGrayBoxPathTest'] });
    expect(m.get('AVSCombatDamageFormulaTest')?.labels).toEqual(['VSCombatDamageFormulaTest']);
  });

  it('binds the label of a direct spawn through a variable (fp_make_duel_map.py shape)', () => {
    const m = place(
      cpp(
        'fp_make_duel_map.py',
        [
          '    spawned = eas.spawn_actor_from_class(',
          '        unreal.VSForcePushKnockbackTest, unreal.Vector(0.0, 0.0, 100.0)',
          '    )',
          '    if not spawned:',
          '        return',
          '    spawned.set_actor_label("ForcePushKnockback")',
        ].join('\n'),
      ),
    );
    expect(m.get('AVSForcePushKnockbackTest')).toMatchObject({ strength: 'spawn-call', labels: ['ForcePushKnockback'] });
  });

  it('binds a chained label and a label held in a one-line assignment', () => {
    const m = place(
      cpp('build_ashen_forest.py', 'gate = aes.spawn_actor_from_class(unreal.VSArenaSetupTest, unreal.Vector(0, 0, 300))\ngate.set_actor_label("AshenForestSetupTest")'),
      cpp('chain.py', 'aes.spawn_actor_from_class(unreal.VSLonelyTest, unreal.Vector(0, 0, 1)).set_actor_label("LonelyLabel")'),
    );
    expect(m.get('AVSArenaSetupTest')).toMatchObject({ strength: 'spawn-call', labels: ['AshenForestSetupTest'] });
    expect(m.get('AVSLonelyTest')).toMatchObject({ strength: 'spawn-call', labels: ['LonelyLabel'] });
  });

  it('follows a class path constant through load_class to the spawn (place_inventory_potion_test.py shape)', () => {
    const m = place(
      cpp(
        'place_inventory_potion_test.py',
        [
          'CLS_INV_TEST = "/Script/PoF.VSInventoryPotionTest"',
          'test_cls = unreal.load_class(None, CLS_INV_TEST)',
          'actor_sub.spawn_actor_from_class(',
          '    test_cls, unreal.Vector(0.0, 0.0, 200.0)).set_actor_label("VSInventoryPotionTest")',
        ].join('\n'),
      ),
    );
    expect(m.get('AVSInventoryPotionTest')).toMatchObject({ strength: 'spawn-call', labels: ['VSInventoryPotionTest'] });
  });

  it('credits nothing for a docstring, a comment, a cleanup-only reference or a script that spawns nothing', () => {
    const m = place(
      cpp('doc.py', '"""Places unreal.VSLonelyTest in the arena."""\n# unreal.VSLonelyTest\nx = aes.spawn_actor_from_class(unreal.StaticMeshActor, loc)'),
      cpp('cleanup.py', 'for a in actors:\n    if isinstance(a, unreal.VSLonelyTest):\n        aes.destroy_actor(a)'),
      cpp('nospawn.py', 'cls = unreal.load_class(None, "/Script/PoF.VSLonelyTest")'),
    );
    expect(m.has('AVSLonelyTest')).toBe(false);
  });

  it('a script that spawns other things and merely names the class is the weak evidence, with no label', () => {
    const m = place(cpp('both.py', 'x = aes.spawn_actor_from_class(unreal.StaticMeshActor, loc)\nfor a in actors:\n    if isinstance(a, unreal.VSLonelyTest):\n        aes.destroy_actor(a)'));
    expect(m.get('AVSLonelyTest')).toMatchObject({ strength: 'named-in-spawning-script', labels: [] });
  });
});

describe('auditReachability - classification', () => {
  const sources = [
    cpp('Combat/VSGenFireballEffectTest.cpp', simple('FVSGenFireballEffectTest', 'Project.Functional Tests.PoF.GenFireball.EffectConfig')),
    cpp('Materials/VSMasterMaterialInstanceTest.cpp', simple('FVSMasterMaterialInstanceTest', 'Project.Functional Tests.PoF.Materials.MasterInstance')),
    cpp('Combat/VSCombatHotbarTest.h', actor('AVSCombatHotbarTest')),
    cpp('Combat/VSForcePushKnockbackTest.h', actor('AVSForcePushKnockbackTest')),
    cpp('Combat/VSCombatDamageFormulaTest.h', actor('AVSCombatDamageFormulaTest')),
    cpp('Combat/VSCombatTwoHealthSystemsTest.h', actor('AVSCombatTwoHealthSystemsTest')),
  ];
  const scripts = [
    cpp('place_fp.py', 'sp = eas.spawn_actor_from_class(unreal.VSForcePushKnockbackTest, loc)\nsp.set_actor_label("ForcePushKnockback")'),
    cpp('place_combat_tests.py', 'x = eas.spawn_actor_from_class(unreal.StaticMeshActor, loc)\nTESTS = [("/Script/PoF.VSCombatDamageFormulaTest", "VSCombatDamageFormulaTest", loc)]'),
  ];
  const list = capture([
    'Audio.Metasound.Asset.FindAssetClassInfo',
    'Project.Functional Tests.PoF.GenFireball.EffectConfig',
    'Project.Functional Tests.Maps.VerticalSlice.VSCombatHotbarTest',
    'Project.Functional Tests.Maps.VSForcePush.ForcePushKnockback',
    'Project.Functional Tests.Maps.VerticalSlice.AShenOrphanLabel',
    'Project.Functional Tests.MoverTests.Maps.MoverBasicAutomatedTests.MoverFalling',
  ]);
  const get = (r: { findings: Finding[] }, cls: string) => r.findings.find((f) => f.className === cls);

  it('sorts every shape into the one class the evidence supports', () => {
    const r = auditReachability({ sources, scripts, listText: list });
    expect(get(r, 'FVSGenFireballEffectTest')).toMatchObject({ classification: 'reachable', via: 'registered-name' });
    expect(get(r, 'FVSMasterMaterialInstanceTest')?.classification).toBe('class-without-registered-name');
    expect(get(r, 'AVSCombatHotbarTest')).toMatchObject({ classification: 'reachable', via: 'registered-label-equals-class-name' });
    // The registered name carries the actor label, not the class: bound only by the placement script.
    expect(get(r, 'AVSForcePushKnockbackTest')).toMatchObject({ classification: 'reachable', via: 'registered-label-from-script' });
    // A script names it and the engine lists nothing: placement was attempted, never proven.
    expect(get(r, 'AVSCombatDamageFormulaTest')?.classification).toBe('class-without-registered-name');
    // No script names it and no list carries it: the incident's shape.
    expect(get(r, 'AVSCombatTwoHealthSystemsTest')?.classification).toBe('functional-test-with-no-placement-evidence');
    expect(r.status).toBe('findings');
  });

  it('flags a registered project name no class accounts for, and leaves engine tests alone', () => {
    const r = auditReachability({ sources, scripts, listText: list });
    const orphans = r.findings.filter((f) => f.classification === 'registered-name-without-class').map((f) => f.registeredName);
    expect(orphans).toEqual(['Project.Functional Tests.Maps.VerticalSlice.AShenOrphanLabel']);
    expect(r.examined.registeredNames).toBe(6);
    expect(r.examined.registeredInScope).toBe(4);
  });

  it('without the binding script the label-only registered name is an orphan and the class is not reachable', () => {
    const r = auditReachability({ sources, scripts: [], listText: list });
    expect(get(r, 'AVSForcePushKnockbackTest')?.classification).toBe('functional-test-with-no-placement-evidence');
    expect(r.findings.some((f) => f.registeredName === 'Project.Functional Tests.Maps.VSForcePush.ForcePushKnockback')).toBe(true);
    expect(r.warnings.join('\n')).toMatch(/no placement scripts/);
  });

  it('never reports a placed outcome: no classification or evidence strength says it', () => {
    const r = auditReachability({ sources, scripts, listText: list });
    expect(JSON.stringify(r)).not.toMatch(/"placed"|"classification":"placed/);
  });

  it('a complex test or spec is reachable by its name as a prefix', () => {
    const r = auditReachability({
      sources: [cpp('c.cpp', 'IMPLEMENT_COMPLEX_AUTOMATION_TEST(FMyComplex, "Project.Functional Tests.PoF.Cx", EAutomationTestFlags::EditorContext)')],
      listText: capture(['Project.Functional Tests.PoF.Cx.First', 'Project.Functional Tests.PoF.Cx.Second']),
    });
    expect(r.findings[0]).toMatchObject({ classification: 'reachable', via: 'registered-name' });
    expect(r.findings[0].matched).toHaveLength(2);
    expect(r.counts['registered-name-without-class']).toBe(0);
  });
});

describe('auditReachability - the input is proven before a verdict is reported', () => {
  const sources = [cpp('Combat/VSGenFireballEffectTest.cpp', simple('FVSGenFireballEffectTest', 'Project.Functional Tests.PoF.GenFireball.EffectConfig')), cpp('Combat/VSCombatHotbarTest.h', actor('AVSCombatHotbarTest'))];

  it('a missing list is loud, reports 0 registered names, and is never clean even with nothing flagged', () => {
    for (const listText of [undefined, null, '', '  \n ']) {
      const r = auditReachability({ sources, listText });
      expect(r.status).toBe('no-list');
      expect(r.examined.registeredNames).toBe(0);
      expect(r.examined.declaredTests).toBe(2);
      expect(r.loud.join(' ')).toMatch(/no Automation List was supplied/);
      expect(r.counts.reachable).toBe(0);
      expect(formatReachabilityReport(r)).toMatch(/NO-LIST \(NOT A VERDICT\)/);
    }
  });

  it('a list holding no names is a loud empty-list, not a clean pass', () => {
    const r = auditReachability({ sources, listText: 'Fatal error! the editor crashed\nLogExit: Exiting.' });
    expect(r.status).toBe('empty-list');
    expect(r.examined.registeredNames).toBe(0);
  });

  it('a list cut short is truncated-list, so its absences are not read as unreachable classes', () => {
    const r = auditReachability({ sources, listText: [header(5000), nameLine('Project.Functional Tests.PoF.GenFireball.EffectConfig')].join('\n') });
    expect(r.status).toBe('truncated-list');
    expect(r.loud.join(' ')).toMatch(/declare 5000 names but 1 were read/);
  });

  it('no declared class is a loud no-classes: an empty scan proves nothing', () => {
    const r = auditReachability({ sources: [cpp('Empty.cpp', '// nothing here')], listText: capture(['A.B']) });
    expect(r.status).toBe('no-classes');
    expect(r.examined.declaredTests).toBe(0);
  });

  it('is clean only when the list is proven, every class is reachable, and nothing is orphaned', () => {
    const r = auditReachability({
      sources,
      listText: capture(['Project.Functional Tests.PoF.GenFireball.EffectConfig', 'Project.Functional Tests.Maps.VerticalSlice.VSCombatHotbarTest']),
    });
    expect(r.status).toBe('clean');
    expect(r.loud).toEqual([]);
    expect(r.counts.reachable).toBe(2);
    expect(r.examined).toMatchObject({ declaredTests: 2, registeredNames: 2, registeredInScope: 2 });
  });

  it('with no list, a simple test is unknown and a functional class with no script is the no-evidence class', () => {
    const r = auditReachability({ sources, listText: null });
    expect(r.counts['unknown-no-list-supplied']).toBe(1);
    expect(r.counts['functional-test-with-no-placement-evidence']).toBe(1);
  });

  it('says how many classes and names it examined at the top of the text report', () => {
    const text = formatReachabilityReport(auditReachability({ sources, listText: capture(['Project.Functional Tests.PoF.GenFireball.EffectConfig']) }));
    expect(text.split('\n')[1]).toMatch(/examined: 2 declared test classes .* 1 registered names/);
  });
});

describe('auditReachability - the floor: a verdict in the last drain is never flagged', () => {
  const sources = [
    cpp('Combat/VSGenFireballEffectTest.cpp', simple('FVSGenFireballEffectTest', 'Project.Functional Tests.PoF.GenFireball.EffectConfig')),
    cpp('Items/VSItemsDefinitionsTest.h', actor('AVSItemsDefinitionsTest')),
    cpp('Loot/VSLootDistributionTest.h', actor('AVSLootDistributionTest')),
    cpp('Economy/VSCurrencyWalletTest.cpp', simple('FVSCurrencyWalletTest', 'Project.Functional Tests.PoF.Currency.WalletRules')),
    cpp('Combat/VSCombatTwoHealthSystemsTest.h', actor('AVSCombatTwoHealthSystemsTest')),
  ];
  // A fixture last drain. The list below is stale: it carries none of the tests that returned a verdict.
  const lastDrain: LastDrain = {
    results: [
      { job: { testName: 'PoF.GenFireball.EffectConfig' }, verdict: { status: 'pass' } },
      { job: { testName: 'VSItemsDefinitionsTest' }, verdict: { status: 'fail' } },
      { job: { testName: 'Project.Functional Tests.Maps.VSLoot.VSLootDistributionTest' }, verdict: { status: 'pass' } },
      // Deferred is not an observation: it must not shield a test.
      { job: { testName: 'PoF.Currency.WalletRules' }, verdict: { status: 'deferred' } },
      { job: { testName: 'PoF.NoClassHasThis' }, verdict: { status: 'pass' } },
      { job: {}, verdict: { status: 'pass' } },
    ],
  };
  const staleList = capture(['Project.Functional Tests.Maps.VerticalSlice.SomethingElse']);

  it('keeps the verdict-bearing tests out of the flagged set whatever the list says', () => {
    const r = auditReachability({ sources, listText: staleList, lastDrain });
    const flagged = r.findings.filter((f) => f.classification !== 'reachable' && f.className).map((f) => f.className);
    expect(flagged.sort()).toEqual(['AVSCombatTwoHealthSystemsTest', 'FVSCurrencyWalletTest']);
    for (const cls of ['FVSGenFireballEffectTest', 'AVSItemsDefinitionsTest', 'AVSLootDistributionTest']) {
      expect(r.findings.find((f) => f.className === cls)).toMatchObject({ classification: 'reachable', via: 'verdict-in-last-drain' });
    }
  });

  it('says the list is stale when a test returned a verdict that the list does not carry', () => {
    const r = auditReachability({ sources, listText: staleList, lastDrain });
    expect(r.warnings.filter((w) => /returned a verdict in the last drain/.test(w))).toHaveLength(3);
  });

  it('holds with no list at all, and reports the verdict names that matched no class', () => {
    const r = auditReachability({ sources, listText: undefined, lastDrain });
    expect(r.status).toBe('no-list');
    expect(r.counts.reachable).toBe(3);
    expect(r.examined.drainVerdicts).toBe(4);
    expect(r.examined.drainNamesUnmatched).toEqual(['PoF.NoClassHasThis']);
  });

  it('reads only pass and fail verdicts with a test name', () => {
    expect(drainVerdictNames(lastDrain).sort()).toEqual([
      'PoF.GenFireball.EffectConfig',
      'PoF.NoClassHasThis',
      'Project.Functional Tests.Maps.VSLoot.VSLootDistributionTest',
      'VSItemsDefinitionsTest',
    ]);
    expect(drainVerdictNames(null)).toEqual([]);
  });

  it('a whole-segment request covers a registered name, a partial word does not', () => {
    const base = [cpp('f.cpp', simple('FFire', 'Project.Functional Tests.PoF.Fireball.EffectConfig'))];
    const verdict = (testName: string): LastDrain => ({ results: [{ job: { testName }, verdict: { status: 'pass' } }] });
    const list = capture(['Project.Functional Tests.Maps.VerticalSlice.Other']);
    expect(auditReachability({ sources: base, listText: list, lastDrain: verdict('PoF.Fireball') }).counts.reachable).toBe(1);
    expect(auditReachability({ sources: base, listText: list, lastDrain: verdict('PoF.Fire') }).counts.reachable).toBe(0);
  });
});

describe('auditReachability - planted canary in a scratch tree', () => {
  /** Every path this test creates, so cleanup removes exactly these and nothing else. */
  const files: string[] = [];
  const dirs: string[] = [];
  const put = (path: string, text: string) => {
    writeFileSync(path, text);
    files.push(path);
  };
  const mk = (path: string) => {
    mkdirSync(path);
    dirs.push(path);
  };

  it('flags a class that appears in no list, and flags nothing it should not', () => {
    const root = join(tmpdir(), `pof-reach-canary-${process.pid}-${Date.now()}`);
    try {
      mk(root);
      mk(join(root, 'Source'));
      mk(join(root, 'Source', 'PoF'));
      mk(join(root, 'Source', 'PoF', 'Test'));
      mk(join(root, 'Source', 'PoF', 'Test', 'Canary'));
      mk(join(root, 'Content'));
      mk(join(root, 'Content', 'Python'));
      mk(join(root, 'Saved'));
      const t = join(root, 'Source', 'PoF', 'Test', 'Canary');
      // The canary: a functional-test actor no script names and no map holds. Never in any list.
      put(join(t, 'VSCanaryUnplacedTest.h'), actor('AVSCanaryUnplacedTest'));
      // The control: placed by a script and registered under its label.
      put(join(t, 'VSCanaryPlacedTest.h'), actor('AVSCanaryPlacedTest'));
      // A script spawns it but the map was never saved: the list does not carry it.
      put(join(t, 'VSCanaryScriptedNotSavedTest.h'), actor('AVSCanaryScriptedNotSavedTest'));
      put(join(t, 'VSCanaryUnregisteredConfigTest.cpp'), simple('FVSCanaryUnregisteredConfigTest', 'Project.Functional Tests.PoF.Canary.UnregisteredConfig'));
      put(join(t, 'VSCanaryRegisteredConfigTest.cpp'), simple('FVSCanaryRegisteredConfigTest', 'Project.Functional Tests.PoF.Canary.RegisteredConfig'));
      put(
        join(root, 'Content', 'Python', 'place_canary_tests.py'),
        'aes.spawn_actor_from_class(unreal.VSCanaryPlacedTest, loc).set_actor_label("VSCanaryPlacedTest")\naes.spawn_actor_from_class(unreal.VSCanaryScriptedNotSavedTest, loc).set_actor_label("NotSavedLabel")\n',
      );
      const listPath = join(root, 'Saved', 'canary_list.log');
      const listed = [
        'Project.Functional Tests.Maps.VerticalSlice.VSCanaryPlacedTest',
        'Project.Functional Tests.PoF.Canary.RegisteredConfig',
        'Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest',
      ];
      put(listPath, capture(listed));

      const read = (p: string): SourceFile => ({ path: p, text: readFileSync(p, 'utf8') });
      const sourcePaths = files.filter((p) => /\.(h|cpp)$/.test(p));
      const scriptPaths = files.filter((p) => p.endsWith('.py'));
      const audit = (listText: string) =>
        auditReachability({ sources: sourcePaths.map(read), scripts: scriptPaths.map(read), listText });

      const r = audit(readFileSync(listPath, 'utf8'));
      const by = (cls: string) => r.findings.find((f) => f.className === cls)?.classification;
      // (a) the planted canary is flagged
      expect(by('AVSCanaryUnplacedTest')).toBe('functional-test-with-no-placement-evidence');
      expect(by('AVSCanaryScriptedNotSavedTest')).toBe('class-without-registered-name');
      expect(by('FVSCanaryUnregisteredConfigTest')).toBe('class-without-registered-name');
      // the controls are not
      expect(by('AVSCanaryPlacedTest')).toBe('reachable');
      expect(by('FVSCanaryRegisteredConfigTest')).toBe('reachable');
      expect(r.status).toBe('findings');
      expect(r.examined).toMatchObject({ declaredTests: 5, sourceFiles: 5, scripts: 1, registeredNames: 3 });
      expect(r.counts).toMatchObject({ reachable: 2, 'class-without-registered-name': 2, 'functional-test-with-no-placement-evidence': 1, 'registered-name-without-class': 1 });
      // (the one orphan is the real-tree label VSFunctionalTest, whose class is outside this scratch tree)
      expect(r.findings.find((f) => f.classification === 'registered-name-without-class')?.registeredName).toBe('Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest');

      // The audit moves with its input: once the engine lists the canary, it is no longer flagged.
      const fixed = audit(capture([...listed, 'Project.Functional Tests.Maps.VerticalSlice.VSCanaryUnplacedTest']));
      expect(fixed.findings.find((f) => f.className === 'AVSCanaryUnplacedTest')?.classification).toBe('reachable');
      expect(fixed.counts['functional-test-with-no-placement-evidence']).toBe(0);
    } finally {
      for (const p of files.reverse()) {
        try {
          unlinkSync(p);
        } catch {
          // already gone
        }
      }
      for (const p of dirs.reverse()) {
        try {
          rmdirSync(p);
        } catch {
          // not empty or already gone: left for the OS temp sweep, never forced
        }
      }
    }
  });
});

describe('paired: the runner today versus the audit, on the same canary', () => {
  it('today a gate name for an existing-but-unreachable class and for a never-written test read identically', () => {
    // Arm A: the runner's own zero-match path (parseAutomationReport) over a report that lists neither.
    const report = { tests: [{ fullTestPath: 'Project.Functional Tests.Maps.VerticalSlice.VSCanaryPlacedTest', state: 'Success', errors: 0 }] };
    const a = parseAutomationReport(report, ['VSCanaryUnplacedTest', 'VSNeverWrittenTest']);
    expect(a.get('VSCanaryUnplacedTest')).toEqual(a.get('VSNeverWrittenTest'));
    expect(a.get('VSCanaryUnplacedTest')?.detail).toMatch(/planned, not registered/);

    // Arm B: the audit tells them apart, because it reads the class.
    const r = auditReachability({
      sources: [cpp('VSCanaryUnplacedTest.h', actor('AVSCanaryUnplacedTest'))],
      listText: capture(['Project.Functional Tests.Maps.VerticalSlice.VSCanaryPlacedTest']),
    });
    expect(r.findings.map((f) => f.className)).toContain('AVSCanaryUnplacedTest');
    expect(r.findings.find((f) => f.className === 'VSNeverWrittenTest')).toBeUndefined();
  });
});
