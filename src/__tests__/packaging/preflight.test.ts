import { describe, it, expect } from 'vitest';
import {
  iniValue,
  checkConfigSanity,
  auditWithEditor,
  withEditorCheckResult,
  parseUbtResult,
  buildVerifyCheckResult,
  parseAssetValidation,
  assetValidationCheckResult,
  overallStatus,
  type SourceFile,
} from '@/lib/packaging/preflight';

describe('iniValue', () => {
  const ini = [
    '[/Script/EngineSettings.GeneralProjectSettings]',
    'ProjectID=A4F560FB24E044B29E266ACA510D4048',
    'ProjectName=PoF',
    '',
    '[/Script/EngineSettings.GameMapsSettings]',
    'GameDefaultMap=/Game/Maps/VerticalSlice',
    'GlobalDefaultGameMode=/Game/VerticalSlice/BP_VSGameMode.BP_VSGameMode_C',
  ].join('\n');

  it('reads a key from the correct section', () => {
    expect(iniValue(ini, '/Script/EngineSettings.GeneralProjectSettings', 'ProjectID'))
      .toBe('A4F560FB24E044B29E266ACA510D4048');
    expect(iniValue(ini, '/Script/EngineSettings.GameMapsSettings', 'GameDefaultMap'))
      .toBe('/Game/Maps/VerticalSlice');
  });

  it('does not read a key from the wrong section', () => {
    // ProjectName lives in GeneralProjectSettings, not GameMapsSettings.
    expect(iniValue(ini, '/Script/EngineSettings.GameMapsSettings', 'ProjectName')).toBeNull();
  });

  it('returns empty string for a present-but-blank key, null for absent', () => {
    expect(iniValue('[S]\nProjectID=', 'S', 'ProjectID')).toBe('');
    expect(iniValue('[S]\nOther=x', 'S', 'ProjectID')).toBeNull();
    expect(iniValue(null, 'S', 'ProjectID')).toBeNull();
  });
});

describe('checkConfigSanity', () => {
  const goodGame = '[/Script/EngineSettings.GeneralProjectSettings]\nProjectID=ABC123';
  const goodEngine = [
    '[/Script/EngineSettings.GameMapsSettings]',
    'GameDefaultMap=/Game/Maps/VerticalSlice',
    'GlobalDefaultGameMode=/Game/VerticalSlice/BP_VSGameMode.BP_VSGameMode_C',
  ].join('\n');

  it('passes a fully-configured project', () => {
    const r = checkConfigSanity({ defaultGameIni: goodGame, defaultEngineIni: goodEngine, defaultMapExists: true });
    expect(r.status).toBe('pass');
    expect(r.issues).toHaveLength(0);
  });

  it('fails on an empty ProjectID', () => {
    const r = checkConfigSanity({
      defaultGameIni: '[/Script/EngineSettings.GeneralProjectSettings]\nProjectID=',
      defaultEngineIni: goodEngine,
      defaultMapExists: true,
    });
    expect(r.status).toBe('fail');
    expect(r.issues.join(' ')).toMatch(/ProjectID is empty/);
  });

  it('warns when GameDefaultMap / GlobalDefaultGameMode are unset', () => {
    const r = checkConfigSanity({ defaultGameIni: goodGame, defaultEngineIni: '[/Script/EngineSettings.GameMapsSettings]', defaultMapExists: null });
    expect(r.status).toBe('warn');
    expect(r.issues.join(' ')).toMatch(/GameDefaultMap is not set/);
    expect(r.issues.join(' ')).toMatch(/GlobalDefaultGameMode is not set/);
  });

  it('fails when the configured map is missing on disk', () => {
    const r = checkConfigSanity({ defaultGameIni: goodGame, defaultEngineIni: goodEngine, defaultMapExists: false });
    expect(r.status).toBe('fail');
    expect(r.issues.join(' ')).toMatch(/no matching \.umap was found/);
  });
});

describe('auditWithEditor', () => {
  it('flags an unguarded editor-only API call', () => {
    const files: SourceFile[] = [{
      path: 'Plugins/Bridge/Source/Bridge/Private/PofTestRunner.cpp',
      content: [
        'void UPofTestRunner::OnPIEStarted(bool b) {',
        '    FEditorDelegates::PostPIEStarted.RemoveAll(this);',
        '    ContinueExecution();',
        '}',
      ].join('\n'),
    }];
    const v = auditWithEditor(files);
    expect(v).toHaveLength(1);
    expect(v[0].token).toBe('FEditorDelegates');
    expect(v[0].line).toBe(2);
  });

  it('does not flag the same call when guarded by #if WITH_EDITOR', () => {
    const files: SourceFile[] = [{
      path: 'a.cpp',
      content: [
        'void X() {',
        '#if WITH_EDITOR',
        '    FEditorDelegates::PostPIEStarted.RemoveAll(this);',
        '#endif',
        '    Continue();',
        '}',
      ].join('\n'),
    }];
    expect(auditWithEditor(files)).toHaveLength(0);
  });

  it('flags an unguarded editor-only #include', () => {
    const files: SourceFile[] = [{ path: 'a.cpp', content: '#include "Editor.h"\nvoid X() {}' }];
    const v = auditWithEditor(files);
    expect(v).toHaveLength(1);
    expect(v[0].token).toBe('"Editor.h"');
  });

  it('ignores commented-out editor API and AssetRegistry (a runtime module)', () => {
    const files: SourceFile[] = [{
      path: 'a.cpp',
      content: [
        '// FEditorDelegates::PostPIEStarted.RemoveAll(this);  -- old code',
        'FAssetRegistryModule::AssetCreated(Obj);',
      ].join('\n'),
    }];
    expect(auditWithEditor(files)).toHaveLength(0);
  });

  it('handles nested #if guards correctly', () => {
    const files: SourceFile[] = [{
      path: 'a.cpp',
      content: [
        '#if WITH_EDITOR',
        '#if PLATFORM_WINDOWS',
        '    GEditor->SelectNone(true, true);', // guarded transitively
        '#endif',
        '#endif',
        'GEditor->SelectNone(true, true);', // NOT guarded — line 6
      ].join('\n'),
    }];
    const v = auditWithEditor(files);
    expect(v).toHaveLength(1);
    expect(v[0].line).toBe(6);
  });

  it('produces a pass/fail check result', () => {
    expect(withEditorCheckResult([]).status).toBe('pass');
    const fail = withEditorCheckResult([{ path: 'a.cpp', line: 2, token: 'GEditor', text: 'GEditor->X()' }]);
    expect(fail.status).toBe('fail');
    expect(fail.issues[0]).toMatch(/a\.cpp:2/);
  });
});

describe('parseUbtResult', () => {
  it('detects a clean build', () => {
    const r = parseUbtResult('Building PoFEditor...\nResult: Succeeded\nTotal execution time: 35s');
    expect(r.succeeded).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('treats "Target is up to date" as success', () => {
    expect(parseUbtResult('Target is up to date').succeeded).toBe(true);
  });

  it('detects a RulesError failure and captures the error line', () => {
    const out = [
      'Building PoF...',
      'Targets with a unique build environment cannot be built with an installed engine.',
      'Result: Failed (RulesError)',
    ].join('\n');
    const r = parseUbtResult(out);
    expect(r.succeeded).toBe(false);
  });

  it('captures C++ compile error lines', () => {
    const out = [
      'PofTestRunner.cpp(53): error C2653: FEditorDelegates is not a class or namespace',
      'Result: Failed (OtherCompilationError)',
    ].join('\n');
    const r = parseUbtResult(out);
    expect(r.succeeded).toBe(false);
    expect(r.errors.some((e) => e.includes('C2653'))).toBe(true);
  });

  it('does not treat a "0 error(s)" summary as an error', () => {
    const r = parseUbtResult('Result: Succeeded\nWarning/Error Summary: 0 error(s), 2 warning(s)');
    expect(r.succeeded).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('wraps into a check result', () => {
    expect(buildVerifyCheckResult('bv-editor', 'Editor build', { succeeded: true, errors: [] }).status).toBe('pass');
    expect(buildVerifyCheckResult('bv-editor', 'Editor build', { succeeded: false, errors: ['x'] }).status).toBe('fail');
  });
});

describe('parseAssetValidation', () => {
  it('flags a missing/unresolved asset reference as an error', () => {
    const out = [
      '[2026.05.27-12.00.00:123][  0]LogContentValidation: Error: Asset /Game/Items/BP_Sword.BP_Sword has an unresolved reference to \'/Game/FX/P_Missing\'',
    ].join('\n');
    const v = parseAssetValidation(out);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('error');
    expect(v[0].category).toBe('missing-reference');
  });

  it('flags an oversized/uncompressed texture as a warning', () => {
    const out = 'LogContentValidation: Warning: Texture /Game/UI/T_Logo is 4096x4096 and uncompressed';
    const v = parseAssetValidation(out);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('warning');
    expect(v[0].category).toBe('texture');
  });

  it('warns on leftover redirectors from a resave/fixup summary line', () => {
    const out = [
      'LogContentCommandlet: Display: Fixing up 3 redirectors',
      'LogContentCommandlet: Display: Fixed up 0 redirectors', // zero — must NOT warn
    ].join('\n');
    const v = parseAssetValidation(out);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe('warning');
    expect(v[0].category).toBe('redirector');
    expect(v[0].message).toMatch(/3 redirectors/);
  });

  it('flags a referenced map not in the cook set as an error', () => {
    const out = 'LogContentValidation: Error: Level /Game/Maps/Secret is referenced but not in the cook set';
    const v = parseAssetValidation(out);
    expect(v).toHaveLength(1);
    expect(v[0].category).toBe('map-not-in-cook');
    expect(v[0].severity).toBe('error');
  });

  it('ignores errors from non-validation log categories', () => {
    const out = [
      'LogTemp: Error: some unrelated runtime error',
      'LogInit: Display: Engine initialized',
    ].join('\n');
    expect(parseAssetValidation(out)).toHaveLength(0);
  });

  it('returns nothing for a clean validation run', () => {
    const out = [
      'LogContentValidation: Display: Validating 412 assets',
      'LogContentValidation: Display: All assets passed validation',
    ].join('\n');
    expect(parseAssetValidation(out)).toHaveLength(0);
  });

  it('dedupes identical violation lines', () => {
    const line = 'LogContentValidation: Warning: /Game/Old_Sword is a redirector to /Game/New_Sword';
    expect(parseAssetValidation([line, line, line].join('\n'))).toHaveLength(1);
  });
});

describe('assetValidationCheckResult', () => {
  it('passes with no violations', () => {
    const r = assetValidationCheckResult([]);
    expect(r.id).toBe('asset-validation');
    expect(r.status).toBe('pass');
    expect(r.issues).toHaveLength(0);
  });

  it('warns when only warnings are present', () => {
    const r = assetValidationCheckResult([{ severity: 'warning', category: 'redirector', message: '2 redirectors' }]);
    expect(r.status).toBe('warn');
    expect(r.issues).toHaveLength(1);
  });

  it('fails when any error is present', () => {
    const r = assetValidationCheckResult([
      { severity: 'error', category: 'missing-reference', message: 'broken ref' },
      { severity: 'warning', category: 'texture', message: 'big texture' },
    ]);
    expect(r.status).toBe('fail');
    expect(r.detail).toMatch(/1 error/);
    expect(r.detail).toMatch(/1 warning/);
  });
});

describe('overallStatus', () => {
  const mk = (status: 'pass' | 'fail' | 'warn') => ({ id: 'x', label: 'x', status, detail: '', issues: [] });
  it('is fail if any check fails', () => {
    expect(overallStatus([mk('pass'), mk('warn'), mk('fail')])).toBe('fail');
  });
  it('is warn if any warns and none fail', () => {
    expect(overallStatus([mk('pass'), mk('warn')])).toBe('warn');
  });
  it('is pass when all pass', () => {
    expect(overallStatus([mk('pass'), mk('pass')])).toBe('pass');
  });
});
