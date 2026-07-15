import { describe, it, expect } from 'vitest';
import {
  parsePlannedTestName,
  generateScaffold,
  isScaffoldable,
  annotateZeroMatchDetail,
  SCAFFOLD_AVAILABLE_NOTE,
} from '@/lib/ue-test-scaffold/generate';

describe('parsePlannedTestName — name fidelity', () => {
  it('maps a dotted config gate to a registered name that CONTAINS the requested substring', () => {
    const p = parsePlannedTestName('PoF.Bestiary.BruteArchetypeConfig');
    expect(p.shape).toBe('dotted');
    expect(p.registeredName).toBe('Project.Functional Tests.PoF.Bestiary.BruteArchetypeConfig');
    // The invariant the drain relies on: `Automation RunTests <requested>` matches by substring.
    expect(p.registeredName).toContain('PoF.Bestiary.BruteArchetypeConfig');
    expect(p.className).toBe('FBestiaryBruteArchetypeConfigTest'); // leading `PoF` segment dropped
    expect(p.fileName).toBe('BestiaryBruteArchetypeConfigTest.cpp');
  });

  it('maps a class-shaped VS*Test name so the registered path embeds it verbatim', () => {
    const p = parsePlannedTestName('VSFactionRepTest');
    expect(p.shape).toBe('class');
    expect(p.className).toBe('FVSFactionRepTest');
    expect(p.registeredName).toContain('VSFactionRepTest'); // substring invariant holds
    expect(p.registeredName.startsWith('Project.Functional Tests.PoF.')).toBe(true);
  });

  it('is stable across the real deferred names (registered name always contains the request)', () => {
    for (const name of [
      'VSItemsDefinitionsTest', 'AshenForestSetupTest', 'PoF.Currency.WalletRules',
      'PoF.Quests.StageFlow', 'VSIconSetAtlasTest', 'VSCharacterPipelineTest',
    ]) {
      expect(parsePlannedTestName(name).registeredName).toContain(name);
    }
  });

  it('rejects an unscaffoldable name', () => {
    expect(isScaffoldable('')).toBe(false);
    expect(isScaffoldable('   ')).toBe(false);
    expect(isScaffoldable('123')).toBe(false);
    expect(() => parsePlannedTestName('')).toThrow(/scaffoldable/);
  });
});

describe('generateScaffold — macro shape + loud-fail body', () => {
  it('emits IMPLEMENT_SIMPLE_AUTOMATION_TEST with the exact registered name + editor flags', () => {
    const { code, parsed, suggestedPath } = generateScaffold('PoF.Currency.WalletRules', 'Wallet functional test passes');
    expect(code).toContain('IMPLEMENT_SIMPLE_AUTOMATION_TEST(');
    expect(code).toContain(`"${parsed.registeredName}"`);
    expect(code).toContain('EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter');
    expect(code).toContain(`bool ${parsed.className}::RunTest(const FString& /*Parameters*/)`);
    expect(code).toContain('#include "Misc/AutomationTest.h"');
    // Unimplemented scaffold must fail LOUDLY — never read as a passing test.
    expect(code).toContain('AddError(');
    expect(code).toContain('return false;');
    expect(code).toContain('Wallet functional test passes'); // claim woven into the TODO
    expect(suggestedPath).toBe('Source/PoF/Test/CurrencyWalletRulesTest.cpp');
    // ≤200 LOC guidance.
    expect(code.split('\n').length).toBeLessThan(200);
  });

  it('escapes a claim containing quotes/newlines for the C++ literal', () => {
    const { code } = generateScaffold('VSFooTest', 'a "quoted"\nmulti-line claim');
    expect(code).toContain('a \\"quoted\\" multi-line claim');
    expect(code).not.toContain('"quoted"\n'); // raw quote+newline never leaks into the literal
  });
});

describe('annotateZeroMatchDetail', () => {
  it('appends the scaffold-available note once (idempotent)', () => {
    const once = annotateZeroMatchDetail('VSFoo: planned, not registered in UE');
    expect(once).toContain(SCAFFOLD_AVAILABLE_NOTE);
    expect(annotateZeroMatchDetail(once)).toBe(once); // no double-append
  });
});
