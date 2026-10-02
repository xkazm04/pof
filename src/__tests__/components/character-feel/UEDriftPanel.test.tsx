import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { UEDriftPanel } from '@/components/modules/core-engine/sub_character/ai-feel/UEDriftPanel';
import { useCharacterBlueprintStore } from '@/stores/characterBlueprintStore';
import { useProjectStore } from '@/stores/projectStore';
import { FEEL_PRESETS, getNestedValue } from '@/lib/character-feel-optimizer';
import { FEEL_UE_BINDINGS, parseFeelDefaults } from '@/lib/character/feel-ue-sync';

const darkSouls = FEEL_PRESETS.find((p) => p.id === 'dark-souls')!;

const FILES = [
  { path: 'Character/ARPGCharacterBase.cpp', text: 'MoveComp->MaxWalkSpeed = 600.f;\nMoveComp->RotationRate = FRotator(0.f, 540.f, 0.f);' },
  { path: 'Character/ARPGPlayerCharacter.h', text: 'float SprintSpeed = 900.f;\nfloat StaminaDrainRate = 20.f;' },
  { path: 'Character/ARPGPlayerCharacter.cpp', text: 'MoveComp->MaxWalkSpeed = FMath::FInterpTo(a, b, c, d);\nFollowCamera->FieldOfView = FMath::FInterpTo(a, b, c, d);' },
];

function respond(files = FILES) {
  const data = { moduleName: 'Did', scannedFiles: files.length, files: files.map((f) => f.path), fields: parseFeelDefaults(files) };
  return vi.fn(async () => new Response(JSON.stringify({ success: true, data }), { status: 200 }));
}

beforeEach(() => {
  useProjectStore.setState({ projectPath: 'C:\\Proj\\Did' });
  useCharacterBlueprintStore.setState({ baseFeelPresetId: darkSouls.id, feelLayers: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('UEDriftPanel', () => {
  it('reads nothing until the explicit Read UE click, then states counts and locations', async () => {
    const fetchMock = respond();
    vi.stubGlobal('fetch', fetchMock);
    render(<UEDriftPanel resolved={darkSouls.profile} basePreset={darkSouls} isRunning={false} onApplyDrift={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    await screen.findByText(/4 drift/);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ue5-source/character-feel');
    expect(JSON.parse(String(init.body))).toEqual({ projectPath: 'C:\\Proj\\Did' });
    expect(screen.getByText(/1 unparsed/)).toBeTruthy();
    expect(screen.getByText(/absent in UE/)).toBeTruthy();
    expect(screen.getAllByText(/ARPGPlayerCharacter\.h:1/).length).toBeGreaterThan(0);
    // The literal+runtime walk speed names its runtime writer instead of dropping it.
    expect(screen.getAllByText(/ARPGPlayerCharacter\.cpp:1/).length).toBeGreaterThan(0);
  });

  it('Apply drift only sends the drift prompt on click, never on read', async () => {
    vi.stubGlobal('fetch', respond());
    const onApply = vi.fn();
    render(<UEDriftPanel resolved={darkSouls.profile} basePreset={darkSouls} isRunning={false} onApplyDrift={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    await screen.findByText(/4 drift/);
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Apply drift only/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const [prompt] = onApply.mock.calls[0] as [string];
    expect(prompt).toContain('SprintSpeed (Character/ARPGPlayerCharacter.h:1): 900 -> 580');
  });

  it('Apply is disabled with a stated reason when UE and the stack agree', async () => {
    // Every bound field declared with the dark-souls value: nothing drifts, nothing is absent.
    const text = FEEL_UE_BINDINGS.map((b) => {
      const v = getNestedValue(darkSouls.profile, b.field);
      if (b.kind === 'rotator-yaw') return `${b.names[0]} = FRotator(0.f, ${v}, 0.f);`;
      if (b.kind === 'vector-z') return `${b.names[0]} = FVector(0.f, 0.f, ${v});`;
      return `float ${b.names[0]} = ${v};`;
    }).join('\n');
    vi.stubGlobal('fetch', respond([{ path: 'Character/ARPGCharacterBase.h', text }]));
    render(<UEDriftPanel resolved={darkSouls.profile} basePreset={darkSouls} isRunning={false} onApplyDrift={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    const btn = await screen.findByRole('button', { name: /In sync with UE/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Adopt writes the UE value into the reserved ue-adopted layer', async () => {
    vi.stubGlobal('fetch', respond());
    render(<UEDriftPanel resolved={darkSouls.profile} basePreset={darkSouls} isRunning={false} onApplyDrift={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    await screen.findByText(/4 drift/);
    fireEvent.click(screen.getByRole('button', { name: /Adopt Sprint Speed/i }));
    await waitFor(() => expect(useCharacterBlueprintStore.getState().feelLayers).toHaveLength(1));
    expect(useCharacterBlueprintStore.getState().feelLayers[0]).toMatchObject({
      id: 'ue-adopted', modifiers: [{ field: 'movement.maxSprintSpeed', op: 'set', value: 900 }],
    });
  });

  it('re-reads on project change and after the Apply run finishes', async () => {
    const fetchMock = respond();
    vi.stubGlobal('fetch', fetchMock);
    const props = { resolved: darkSouls.profile, basePreset: darkSouls, onApplyDrift: vi.fn() };
    const { rerender } = render(<UEDriftPanel {...props} isRunning={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    await screen.findByText(/4 drift/);

    act(() => { useProjectStore.setState({ projectPath: 'D:\Other\Did' }); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = (i: number) => JSON.parse(String((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].body));
    expect(body(1)).toEqual({ projectPath: 'D:\Other\Did' });
    await screen.findByText(/4 drift/);

    fireEvent.click(screen.getByRole('button', { name: /Apply drift only/i }));
    rerender(<UEDriftPanel {...props} isRunning />);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    rerender(<UEDriftPanel {...props} isRunning={false} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it('a failed read states the error instead of an empty in-sync answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'boom' }))));
    render(<UEDriftPanel resolved={darkSouls.profile} basePreset={darkSouls} isRunning={false} onApplyDrift={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Read UE/i }));
    await screen.findByText(/boom/);
    expect(screen.queryByText(/In sync with UE/i)).toBeNull();
  });
});
