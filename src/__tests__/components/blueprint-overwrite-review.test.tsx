/**
 * The Write to Project dry-run names what an overwrite deletes, and a loss
 * gates Confirm behind an explicit acknowledgement. "Merge via Claude" is the
 * non-destructive door: a user-clicked CLI task — the app itself writes
 * nothing (no confirm:true request ever leaves on that path).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import type { WritePlan } from '@/lib/blueprint-transpiler-write';

const apiFetch = vi.fn();
const tryApiFetch = vi.fn();
vi.mock('@/lib/api-utils', () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  tryApiFetch: (...a: unknown[]) => tryApiFetch(...a),
}));

const execute = vi.fn(async () => {});
vi.mock('@/hooks/useModuleCLI', () => ({
  useModuleCLI: () => ({ execute, sendPrompt: vi.fn(), isRunning: false }),
}));

const { WriteToProjectButton } = await import(
  '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/WriteToProjectButton'
);

const GEN_H = `#pragma once
#include "CoreMinimal.h"
#include "AHero.generated.h"

UCLASS()
class POF_API AHero : public ACharacter
{
\tGENERATED_BODY()
public:
\tUPROPERTY(EditAnywhere, BlueprintReadWrite)
\tfloat Health = 100.0;
};
`;
const HAND_H = GEN_H.replace(
  '\tfloat Health = 100.0;\n',
  '\tfloat Health = 100.0;\n\n\tUPROPERTY(ReplicatedUsing = OnRep_Ammo)\n\tint32 Ammo;\n\n\tUFUNCTION(Server, Reliable)\n\tvoid ServerFire(FVector Aim);\n',
);
const GEN_CPP = '#include "AHero.h"\n\nAHero::AHero()\n{\n}\n';

function plan(headerBefore: string, exists: boolean): WritePlan {
  const file = (rel: string, before: string, after: string, ex: boolean) => ({
    path: `C:/proj/${rel}`, relPath: rel, exists: ex, before, after,
    diff: { lines: [], summary: { added: 0, removed: 6, unchanged: 0 } },
  });
  return {
    project: { isUeProject: true, uprojectFile: 'MyGame.uproject', moduleInBuild: true, buildCsRelPath: 'Source/PoF/PoF.Build.cs' },
    files: [
      file('Source/PoF/AHero.h', headerBefore, GEN_H, exists),
      file('Source/PoF/AHero.cpp', exists ? GEN_CPP : '', GEN_CPP, exists),
    ],
  } as unknown as WritePlan;
}

function renderButton() {
  return render(
    <WriteToProjectButton className="AHero" header={GEN_H} source={GEN_CPP} projectPath="C:/proj" moduleName="PoF" onModuleChange={() => {}} />,
  );
}

async function openDryRun() {
  await act(async () => { fireEvent.click(screen.getByText('Write to Project')); });
  return screen.findByText('Confirm write');
}

const confirmCalls = () => apiFetch.mock.calls.filter(
  ([, init]) => typeof (init as RequestInit | undefined)?.body === 'string'
    && JSON.parse((init as RequestInit).body as string).confirm === true,
);

beforeEach(() => { apiFetch.mockReset(); tryApiFetch.mockReset(); execute.mockClear(); });
afterEach(cleanup);

describe('Write to Project — overwrite review', () => {
  it('names the lost members; Confirm is disabled until the drop is acknowledged', async () => {
    apiFetch.mockResolvedValueOnce(plan(HAND_H, true));
    renderButton();
    const confirm = await openDryRun();

    const review = screen.getByTestId('overwrite-review');
    expect(review.textContent).toContain('Ammo');
    expect(review.textContent).toContain('void ServerFire(FVector Aim)');
    expect(review.textContent).toMatch(/ReplicatedUsing/);

    expect((confirm.closest('button') as HTMLButtonElement).disabled).toBe(true);
    const ack = screen.getByLabelText(/Overwrite and drop 2 members/);
    await act(async () => { fireEvent.click(ack); });
    expect((screen.getByText('Confirm write').closest('button') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Merge via Claude dispatches one ask-claude task and never writes', async () => {
    apiFetch.mockResolvedValueOnce(plan(HAND_H, true));
    renderButton();
    await openDryRun();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Merge via Claude/ })); });
    expect(execute).toHaveBeenCalledTimes(1);
    const task = (execute.mock.calls[0] as unknown[])[0] as { type: string; moduleId: string; prompt: string };
    expect(task).toMatchObject({ type: 'ask-claude', moduleId: 'blueprint-transpiler' });
    expect(task.prompt).toContain('void ServerFire(FVector Aim)');
    expect(task.prompt).toContain('Source/PoF/AHero.h');
    expect(confirmCalls()).toHaveLength(0);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('[guard] a new file keeps today\'s modal: no review, no ack, Confirm enabled', async () => {
    apiFetch.mockResolvedValueOnce(plan('', false));
    renderButton();
    const confirm = await openDryRun();
    expect(screen.queryByTestId('overwrite-review')).toBeNull();
    expect(screen.queryByRole('button', { name: /Merge via Claude/ })).toBeNull();
    expect((confirm.closest('button') as HTMLButtonElement).disabled).toBe(false);
  });
});
