/**
 * The module name the user targets in Write to Project must reach codegen.
 *
 * The header's `<MODULE>_API` macro and the `Source/<Module>/` directory the
 * file lands in are two halves of one decision. When the view transpiled with
 * only the project name, retargeting the module in the write modal produced a
 * file that declared a *different* module's API macro — a link error the moment
 * the build ran. These assert the single decision travels end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const transpileMock = vi.fn().mockResolvedValue(null);
const parseMock = vi.fn().mockResolvedValue(null);

vi.mock('@/hooks/useBlueprintTranspiler', () => ({
  useBlueprintTranspiler: () => ({
    blueprintJson: BP_JSON,
    setBlueprintJson: vi.fn(),
    existingCpp: '',
    setExistingCpp: vi.fn(),
    asset: null,
    summary: null,
    transpileResult: null,
    diffResult: null,
    isLoading: false,
    error: null,
    parse: parseMock,
    transpile: transpileMock,
    diff: vi.fn(),
    reset: vi.fn(),
  }),
}));

const BP_JSON = '{"ClassName":"BP_Hero"}';

import { BlueprintTranspilerView } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView';
import { headerDeclaresModule } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/helpers';
import { useProjectStore } from '@/stores/projectStore';

describe('Blueprint transpiler — module name reaches codegen', () => {
  beforeEach(() => {
    transpileMock.mockClear();
    parseMock.mockClear();
    useProjectStore.setState({ projectName: 'My Game', projectPath: 'C:/proj' });
  });
  afterEach(() => cleanup());

  it('passes the sanitized module identifier to transpile, not just the raw project name', async () => {
    render(<BlueprintTranspilerView />);
    fireEvent.click(screen.getByText('Transpile to C++'));
    await vi.waitFor(() => expect(transpileMock).toHaveBeenCalled());
    // (json, projectName, moduleName) — the third argument is what makes the
    // API macro agree with Source/<Module>/.
    expect(transpileMock.mock.calls[0][2]).toBe('MyGame');
  });
});

describe('headerDeclaresModule', () => {
  it('accepts a header whose API macro matches the target module', () => {
    expect(headerDeclaresModule('class COMBATRUNTIME_API AFoo : public AActor', 'CombatRuntime')).toBe(true);
  });

  it('rejects a header declaring a different module than the write target', () => {
    expect(headerDeclaresModule('class MYGAME_API AFoo : public AActor', 'CombatRuntime')).toBe(false);
  });

  it('rejects a header with no API macro at all', () => {
    expect(headerDeclaresModule('class AFoo : public AActor', 'CombatRuntime')).toBe(false);
  });
});
