/**
 * "Write to Project" must name the rung its receipt was earned at.
 *
 * Standard: ai-registry `game-production/visual-script-to-code-transpilation`,
 * technique "the fidelity ladder". Writing files reaches the WRITTEN rung and
 * no further. Only a compile verdict from the UE bridge reaches COMPILES — and
 * when the bridge is unreachable the receipt must say so, never imply a pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';

const apiFetch = vi.fn();
const tryApiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  tryApiFetch: (...a: unknown[]) => tryApiFetch(...a),
}));

const { WriteToProjectButton } = await import(
  '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton'
);

const HEADER = '#pragma once\nclass POF_API AHero {};\n';

function plan(moduleInBuild = true): WritePlan {
  const file = (rel: string) => ({
    path: `C:/proj/${rel}`, relPath: rel, exists: false, before: '', after: HEADER,
    diff: { lines: [], summary: { added: 2, removed: 0, unchanged: 0 } },
  });
  return {
    project: {
      isUeProject: true,
      uprojectFile: 'MyGame.uproject',
      moduleInBuild,
      buildCsRelPath: 'Source/PoF/PoF.Build.cs',
    },
    files: [file('Source/PoF/AHero.h'), file('Source/PoF/AHero.cpp')],
  } as unknown as WritePlan;
}

function renderButton() {
  return render(
    <WriteToProjectButton
      className="AHero"
      header={HEADER}
      source="// body"
      projectPath="C:/proj"
      moduleName="PoF"
      onModuleChange={() => {}}
    />,
  );
}

/** Dry run → Confirm write. */
async function writeIt() {
  await act(async () => { fireEvent.click(screen.getByText('Write to Project')); });
  await screen.findByText('Confirm write');
  await act(async () => { fireEvent.click(screen.getByText('Confirm write')); });
}

beforeEach(() => { apiFetch.mockReset(); tryApiFetch.mockReset(); });
afterEach(cleanup);

describe('write receipt names its rung', () => {
  it('reports UNVERIFIED, not a pass, when the UE bridge is unreachable', async () => {
    apiFetch
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce({ written: ['a.h', 'a.cpp'], moduleInBuild: true, uprojectFile: 'MyGame.uproject' });
    tryApiFetch.mockResolvedValue({ ok: false, error: 'fetch failed' });

    renderButton();
    await writeIt();

    const receipt = await screen.findByTestId('write-receipt');
    await waitFor(() => expect(receipt.textContent ?? '').toMatch(/not verified/i));
    const text = receipt.textContent ?? '';
    expect(text).toMatch(/bridge/i);
    expect(text).toMatch(/written/i);
    // The one thing it must never say.
    expect(text).not.toMatch(/compiled successfully|build succeeded/i);
  });

  it('reports the compile verdict and its diagnostics when the bridge answers', async () => {
    apiFetch
      .mockResolvedValueOnce(plan())
      .mockResolvedValueOnce({ written: ['a.h', 'a.cpp'], moduleInBuild: true, uprojectFile: 'MyGame.uproject' });
    tryApiFetch.mockResolvedValue({
      ok: true,
      data: {
        status: 'failed',
        diagnostics: [{
          id: 'd1', severity: 'error', file: 'AHero.cpp', line: 12, column: 3,
          code: 'C2065', message: "undeclared identifier 'Healht'", rawText: '', category: 'compile',
        }],
        summary: { success: false, errorCount: 1, warningCount: 0, duration: '3s', rawText: '' },
      },
    });

    renderButton();
    await writeIt();

    const receipt = await screen.findByTestId('write-receipt');
    await waitFor(() => expect(receipt.textContent ?? '').toMatch(/C2065/));
    expect(receipt.textContent ?? '').toMatch(/undeclared identifier/);
  });

  it('says the module is not part of the build instead of a green receipt', async () => {
    apiFetch
      .mockResolvedValueOnce(plan(false))
      .mockResolvedValueOnce({ written: ['a.h', 'a.cpp'], moduleInBuild: false, uprojectFile: 'MyGame.uproject' });

    renderButton();
    await writeIt();

    const receipt = await screen.findByTestId('write-receipt');
    expect(receipt.textContent ?? '').toMatch(/not part of the build/i);
    // With no compiler looking at the files, no compile is even attempted.
    expect(tryApiFetch).not.toHaveBeenCalled();
  });

  it('warns in the dry-run modal when the module has no Build.cs', async () => {
    apiFetch.mockResolvedValueOnce(plan(false));
    renderButton();
    await act(async () => { fireEvent.click(screen.getByText('Write to Project')); });
    const warn = await screen.findByTestId('module-not-in-build');
    expect(warn.textContent ?? '').toContain('Source/PoF/PoF.Build.cs');
  });
});
