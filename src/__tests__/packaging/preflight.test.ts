import { describe, it, expect } from 'vitest';
import {
  iniValue,
  checkConfigSanity,
  auditWithEditor,
  withEditorCheckResult,
  parseUbtResult,
  buildVerifyCheckResult,
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
