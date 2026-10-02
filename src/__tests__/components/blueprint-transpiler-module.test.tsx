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

const BP_JSON = '{"ClassName":"BP_Hero"}';

const fetchMock = vi.fn(async () => ({
  json: async () => ({ success: false, error: 'stubbed' }),
}));

import { BlueprintTranspilerView } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView';
import { headerDeclaresModule } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/helpers';
import { resetBlueprintTranspilerSessions } from '@/hooks/useBlueprintTranspiler';
import { useProjectStore } from '@/stores/projectStore';

describe('Blueprint transpiler — module name reaches codegen', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    resetBlueprintTranspilerSessions();
    vi.stubGlobal('fetch', fetchMock);
    useProjectStore.setState({ projectName: 'My Game', projectPath: 'C:/proj' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('sends the sanitized module identifier with the transpile, not just the raw project name', async () => {
    render(<BlueprintTranspilerView />);
    fireEvent.change(screen.getByPlaceholderText(/Paste Blueprint JSON/), { target: { value: BP_JSON } });
    fireEvent.click(screen.getByText('Transpile to C++'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // The module is what makes the API macro agree with Source/<Module>/.
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ action: 'transpile', blueprintJson: BP_JSON, projectName: 'My Game', moduleName: 'MyGame' });
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
