/**
 * One click is one request, and a run survives the module being unmounted.
 *
 * Transpile, Semantic Diff and Scan Replication each fired TWO POSTs (parse,
 * then transpile/diff) and the server parsed the same JSON twice; the gap
 * between them is why the view needed an in-flight latch. The route now returns
 * the parse (`asset` + `summary`) with the result, so one action is one request.
 *
 * The transpiler's input and results lived in useState, so an LRU eviction
 * threw pasted work away. They now live in a session record per project.
 *
 * fetch is routed into the real route handler, so the data is genuine.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/blueprint-transpiler/route';
import * as hookModule from '@/hooks/useBlueprintTranspiler';
import { BlueprintTranspilerView } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView';
import { ReplicationScaffoldPanel } from '@/components/modules/game-systems/multiplayer/ReplicationScaffoldPanel';
import { SAMPLE_BLUEPRINT } from '@/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView/constants';
import { useProjectStore } from '@/stores/projectStore';

interface Sent { url: string; action: string }
let sent: Sent[] = [];

function routeFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    sent.push({ url, action: body.action });
    return POST(new NextRequest(`http://localhost${url}`, init as ConstructorParameters<typeof NextRequest>[1]));
  });
}

function posts() {
  return sent.filter((s) => s.url === '/api/blueprint-transpiler');
}

function resetSessions() {
  // Optional so this file reports per-case red before the session store exists.
  (hookModule as { resetBlueprintTranspilerSessions?: () => void }).resetBlueprintTranspilerSessions?.();
}

beforeEach(() => {
  sent = [];
  resetSessions();
  vi.stubGlobal('fetch', routeFetch());
  useProjectStore.setState({ projectName: 'My Game', projectPath: 'C:/proj' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonBox(): HTMLTextAreaElement {
  return screen.getAllByPlaceholderText(/Paste Blueprint JSON/)[0] as HTMLTextAreaElement;
}

describe('one click is one request (no parse round-trip)', () => {
  it('Transpile, Semantic Diff and Scan Replication each send exactly 1 POST and none with action parse', async () => {
    render(<BlueprintTranspilerView />);
    fireEvent.change(jsonBox(), { target: { value: SAMPLE_BLUEPRINT } });

    await act(async () => { fireEvent.click(screen.getByText('Transpile to C++')); });
    await screen.findByTestId('transpile-fidelity');
    expect(posts().map((s) => s.action)).toEqual(['transpile']);

    sent = [];
    fireEvent.click(screen.getByText('Semantic Diff'));
    fireEvent.change(screen.getByPlaceholderText(/Paste existing C\+\+/), {
      target: { value: 'class AFoo : public ACharacter { };' },
    });
    await act(async () => { fireEvent.click(screen.getByText('Run Semantic Diff')); });
    await screen.findByText(/changes detected/);
    expect(posts().map((s) => s.action)).toEqual(['diff']);

    cleanup();
    sent = [];
    render(<ReplicationScaffoldPanel />);
    fireEvent.click(screen.getByText('Load Sample'));
    await act(async () => { fireEvent.click(screen.getByText('Scan Replication')); });
    await screen.findByText('Replicated Fields');
    expect(posts().map((s) => s.action)).toEqual(['transpile']);
  });
});

describe('the transpiler session survives an unmount, per project', () => {
  it('restores the Blueprint JSON and the transpile result for the same project, and starts empty for another', async () => {
    const first = render(<BlueprintTranspilerView />);
    fireEvent.change(jsonBox(), { target: { value: SAMPLE_BLUEPRINT } });
    await act(async () => { fireEvent.click(screen.getByText('Transpile to C++')); });
    await screen.findByTestId('transpile-fidelity');
    first.unmount();

    render(<BlueprintTranspilerView />);
    expect(jsonBox().value).toBe(SAMPLE_BLUEPRINT);
    expect(screen.getAllByText('APlayerCharacter.h').length).toBeGreaterThan(0);
    cleanup();

    useProjectStore.setState({ projectName: 'Other', projectPath: 'C:/other' });
    render(<BlueprintTranspilerView />);
    expect(jsonBox().value).toBe('');
    await waitFor(() => expect(screen.queryAllByText('APlayerCharacter.h')).toHaveLength(0));
  });
});
