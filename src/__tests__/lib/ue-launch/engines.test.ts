import { describe, it, expect } from 'vitest';
import { resolveEditorBinary } from '@/lib/ue-launch/engines';

const CMD_58 = 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
const EDITOR_58 = 'C:\\Program Files\\Epic Games\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe';
const CMD_57 = 'C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';

describe('resolveEditorBinary', () => {
  it('defaults to the UE 5.8 headless (-Cmd) binary', () => {
    expect(resolveEditorBinary({}, {})).toBe(CMD_58);
  });

  it('honors an explicit engine version', () => {
    expect(resolveEditorBinary({ engine: '5.7' }, {})).toBe(CMD_57);
  });

  it('returns the windowed UnrealEditor.exe when windowed is requested', () => {
    expect(resolveEditorBinary({ windowed: true }, {})).toBe(EDITOR_58);
  });

  it('reads POF_UE_ENGINE from the environment for the default path', () => {
    expect(resolveEditorBinary({}, { POF_UE_ENGINE: '5.7' })).toBe(CMD_57);
  });

  it('lets POF_UE_CMD override the cmd binary path', () => {
    const custom = 'D:\\UE\\UnrealEditor-Cmd.exe';
    expect(resolveEditorBinary({}, { POF_UE_CMD: custom })).toBe(custom);
  });

  it('lets POF_UE_EDITOR override the windowed binary path', () => {
    const custom = 'D:\\UE\\UnrealEditor.exe';
    expect(resolveEditorBinary({ windowed: true }, { POF_UE_EDITOR: custom })).toBe(custom);
  });

  it('an explicit cmd option wins over env and defaults', () => {
    expect(resolveEditorBinary({ cmd: 'X:\\custom.exe' }, { POF_UE_CMD: 'Y:\\env.exe' })).toBe('X:\\custom.exe');
  });
});
