/**
 * `POF_UE_EDITOR_CMD` is the ONE variable the operator actually configures (it is what
 * `.env` sets and what the harness reads — `src/lib/harness/ue-gates.ts:resolveUeEnv`).
 * Before the `ue-editor-env-unification` direction the experiment runner's resolver had
 * never heard of it: it read `POF_UE_EDITOR` / `POF_UE_CMD` (neither set) and then fell
 * through to a hardcoded `UE_5.8` path that merely HAPPENED to match. Move the install
 * and the harness keeps working while the lab hard-fails on a path nobody configured.
 */
import { describe, it, expect } from 'vitest';
import { resolveEditorBinary, resolveEditorBinaryDetailed, editorNotFoundMessage } from '@/lib/ue-launch/engines';
import { runExperiment } from '@/lib/ue-experiment/runner';

const CONFIGURED_CMD = 'D:\\Epic\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe';
const CONFIGURED_EDITOR = 'D:\\Epic\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe';

describe('resolveEditorBinary — POF_UE_EDITOR_CMD', () => {
  it('uses the configured install for the headless binary', () => {
    expect(resolveEditorBinary({}, { POF_UE_EDITOR_CMD: CONFIGURED_CMD })).toBe(CONFIGURED_CMD);
  });

  it('derives the windowed sibling that sits beside it', () => {
    expect(resolveEditorBinary({ windowed: true }, { POF_UE_EDITOR_CMD: CONFIGURED_CMD })).toBe(CONFIGURED_EDITOR);
  });

  it('derives the sibling on a POSIX-style install too', () => {
    expect(resolveEditorBinary({ windowed: true }, { POF_UE_EDITOR_CMD: '/opt/UE_5.8/Engine/Binaries/Linux/UnrealEditor-Cmd' }))
      .toBe('/opt/UE_5.8/Engine/Binaries/Linux/UnrealEditor');
  });

  it('does NOT invent a windowed sibling when the configured basename is unrecognised', () => {
    // Only a `UnrealEditor-Cmd` basename proves where the windowed binary lives. Anything
    // else and we fall back to the versioned default rather than fabricate a path.
    const weird = 'D:\\wrappers\\launch-ue.bat';
    const out = resolveEditorBinary({ windowed: true }, { POF_UE_EDITOR_CMD: weird });
    expect(out).not.toBe(weird);
    expect(out).toContain('UnrealEditor.exe');
    expect(resolveEditorBinaryDetailed({ windowed: true }, { POF_UE_EDITOR_CMD: weird }).source).toBe('default');
  });

  it('keeps POF_UE_CMD / POF_UE_EDITOR as higher-precedence overrides', () => {
    expect(resolveEditorBinary({}, { POF_UE_CMD: 'X:\\o.exe', POF_UE_EDITOR_CMD: CONFIGURED_CMD })).toBe('X:\\o.exe');
    expect(resolveEditorBinary({ windowed: true }, { POF_UE_EDITOR: 'X:\\o.exe', POF_UE_EDITOR_CMD: CONFIGURED_CMD })).toBe('X:\\o.exe');
    expect(resolveEditorBinary({ cmd: 'X:\\explicit.exe' }, { POF_UE_EDITOR_CMD: CONFIGURED_CMD })).toBe('X:\\explicit.exe');
  });

  it('an explicitly requested engine version wins — the configured install may not be that version', () => {
    expect(resolveEditorBinary({ engine: '5.7' }, { POF_UE_EDITOR_CMD: CONFIGURED_CMD }))
      .toBe('C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe');
    expect(resolveEditorBinary({}, { POF_UE_ENGINE: '5.7', POF_UE_EDITOR_CMD: CONFIGURED_CMD }))
      .toBe('C:\\Program Files\\Epic Games\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealEditor-Cmd.exe');
  });
});

describe('editorNotFoundMessage', () => {
  it('names every variable consulted and what each held', () => {
    const msg = editorNotFoundMessage(resolveEditorBinaryDetailed({}, {}));
    expect(msg).toContain('POF_UE_EDITOR_CMD');
    expect(msg).toContain('POF_UE_CMD');
    expect(msg).toContain('POF_UE_ENGINE');
    expect(msg).toMatch(/not set/);
  });

  it('says which source produced the path it tried', () => {
    const msg = editorNotFoundMessage(resolveEditorBinaryDetailed({ windowed: true }, { POF_UE_EDITOR_CMD: CONFIGURED_CMD }));
    expect(msg).toContain(CONFIGURED_EDITOR);
    expect(msg).toContain('POF_UE_EDITOR_CMD');
    expect(msg).toMatch(/derived/i);
  });
});

describe('runExperiment — the not-found error is fixable', () => {
  it('launches the operator-configured install instead of a hardcoded path', async () => {
    let launched = '';
    const res = await runExperiment(
      { python: "unreal.log('x')" },
      {
        env: { POF_UE_UPROJECT: 'C:/p/PoF.uproject', POF_UE_EDITOR_CMD: CONFIGURED_CMD },
        fileExists: () => true,
        run: async (binary) => { launched = binary; },
        now: () => 1,
        detectEditors: () => [],
        editorLease: { acquire: () => ({ ok: true }), release: () => {} } as never,
      },
    );
    expect(launched).toBe(CONFIGURED_CMD);
    expect(res.binary).toBe(CONFIGURED_CMD);
  });

  it('names every variable it consulted when the binary is missing', async () => {
    const res = await runExperiment(
      { python: 'x' },
      {
        env: { POF_UE_UPROJECT: 'C:/p/PoF.uproject', POF_UE_EDITOR_CMD: CONFIGURED_CMD },
        fileExists: () => false,
        run: async () => {},
        now: () => 1,
        detectEditors: () => [],
        editorLease: { acquire: () => ({ ok: true }), release: () => {} } as never,
      },
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('UE editor not found');
    expect(res.error).toContain(CONFIGURED_CMD);
    expect(res.error).toContain('POF_UE_EDITOR_CMD');
    // and it no longer tells the user to set two variables that are not part of their setup
    // without saying what those variables currently hold
    expect(res.error).toMatch(/Consulted, in order/);
  });
});
