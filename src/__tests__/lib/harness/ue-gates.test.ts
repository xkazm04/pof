import { describe, it, expect } from 'vitest';
import {
  resolveUeEnv,
  deriveEngineRoot,
  projectNameFromUproject,
  deriveUeCompileCommand,
  deriveUeTestCommand,
  parseAutomationLog,
  detectUeGates,
  type UeEnv,
} from '@/lib/harness/ue-gates';

const ENV: UeEnv = {
  editorCmd: 'C:/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',
  uproject: 'C:/Users/dev/Unreal Projects/PoF/PoF.uproject',
};

// ── env resolution ──────────────────────────────────────────────────────────

describe('resolveUeEnv', () => {
  it('returns null unless BOTH vars are set', () => {
    expect(resolveUeEnv({})).toBeNull();
    expect(resolveUeEnv({ POF_UE_EDITOR_CMD: 'x' })).toBeNull();
    expect(resolveUeEnv({ POF_UE_UPROJECT: 'y' })).toBeNull();
    expect(resolveUeEnv({ POF_UE_EDITOR_CMD: '  ', POF_UE_UPROJECT: 'y' })).toBeNull();
  });
  it('reads both when present', () => {
    expect(resolveUeEnv({ POF_UE_EDITOR_CMD: 'a', POF_UE_UPROJECT: 'b' })).toEqual({ editorCmd: 'a', uproject: 'b' });
  });
});

// ── command derivation ──────────────────────────────────────────────────────

describe('deriveEngineRoot', () => {
  it('derives the engine root from the editor-cmd path', () => {
    expect(deriveEngineRoot(ENV.editorCmd)).toBe('C:/UE_5.8/Engine');
    expect(deriveEngineRoot('D:\\UE\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe')).toBe('D:/UE/Engine');
  });
  it('returns null when the path is not under Engine/Binaries', () => {
    expect(deriveEngineRoot('C:/random/editor.exe')).toBeNull();
  });
});

describe('projectNameFromUproject', () => {
  it('strips the directory and .uproject extension', () => {
    expect(projectNameFromUproject(ENV.uproject)).toBe('PoF');
  });
});

describe('deriveUeCompileCommand', () => {
  it('builds a UBT Editor-target Development compile, judged by exit code', () => {
    const cmd = deriveUeCompileCommand(ENV, 'win32')!;
    expect(cmd).toContain('Build.bat');
    expect(cmd).toContain('PoFEditor Development Win64');
    expect(cmd).toContain('-Project="C:/Users/dev/Unreal Projects/PoF/PoF.uproject"');
    // quoted to survive the space in "Unreal Projects"
    expect(cmd).toContain('"C:/UE_5.8/Engine/Build/BatchFiles/Build.bat"');
  });
  it('uses Build.sh + Linux token off-Windows', () => {
    const cmd = deriveUeCompileCommand(ENV, 'linux')!;
    expect(cmd).toContain('Build.sh');
    expect(cmd).toContain('PoFEditor Development Linux');
  });
  it('returns null when the engine root cannot be derived', () => {
    expect(deriveUeCompileCommand({ editorCmd: 'C:/nope/editor.exe', uproject: ENV.uproject })).toBeNull();
  });
});

describe('deriveUeTestCommand', () => {
  it('builds a headless automation run writing to the abslog', () => {
    const cmd = deriveUeTestCommand(ENV, 'PoF.Combat', 'C:/state/ue-tests-3.log');
    expect(cmd).toContain('-ExecCmds="Automation RunTests PoF.Combat;Quit"');
    expect(cmd).toContain('-abslog="C:/state/ue-tests-3.log"');
    expect(cmd).toContain('-unattended');
    expect(cmd).toContain('-nullrhi');
  });
  it('defaults an empty filter to "Project"', () => {
    expect(deriveUeTestCommand(ENV, '', 'x.log')).toContain('Automation RunTests Project;Quit');
  });
});

// ── abslog verdict parsing (judge by content, not exit code) ─────────────────

describe('parseAutomationLog', () => {
  it('passes when tests report Passed/Success and none fail', () => {
    const log = 'LogAutomationController: Test Completed. Result={Passed} Name={PoF.A}\nResult={Success} Name={PoF.B}';
    const v = parseAutomationLog(log);
    expect(v.verdict).toBe('pass');
    expect(v.passed).toBe(2);
    expect(v.failed).toBe(0);
  });
  it('fails when any test reports Failed', () => {
    const log = 'Result={Passed} Name={A}\nResult={Failed} Name={B}';
    const v = parseAutomationLog(log);
    expect(v.verdict).toBe('fail');
    expect(v.failed).toBe(1);
    expect(v.reason).toMatch(/failed/i);
  });
  it('is UNVERIFIABLE (not fail) when the filter matched zero tests', () => {
    expect(parseAutomationLog('LogAutomationController: Automation Test Queue Empty').verdict).toBe('unverifiable');
    expect(parseAutomationLog('').verdict).toBe('unverifiable');
  });
});

// ── gate set assembly ───────────────────────────────────────────────────────

describe('detectUeGates', () => {
  it('with env → a REAL required compile gate with a command', () => {
    const gates = detectUeGates({ env: ENV });
    const compile = gates.find(g => g.name === 'ue-compile')!;
    expect(compile.type).toBe('ue-compile');
    expect(compile.required).toBe(true);
    expect(compile.command).toBeTruthy();
    expect(compile.command).not.toMatch(/ls Source/); // the old self-pass is gone
  });

  it('without env → a commandless compile gate (verifier reports unverifiable)', () => {
    const gates = detectUeGates({ env: null });
    const compile = gates.find(g => g.name === 'ue-compile')!;
    expect(compile.required).toBe(true);
    expect(compile.command).toBeUndefined();
  });

  it('adds an opt-in advisory test gate only when requested', () => {
    expect(detectUeGates({ env: ENV }).some(g => g.type === 'ue-test')).toBe(false);
    const withTests = detectUeGates({ env: ENV, ueTests: true, ueTestFilter: 'PoF.Combat' });
    const test = withTests.find(g => g.type === 'ue-test')!;
    expect(test.required).toBe(false); // advisory, gated behind compile
    expect(test.filter).toBe('PoF.Combat');
  });
});
