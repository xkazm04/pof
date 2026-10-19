import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act, screen } from '@testing-library/react';
import { useReducer } from 'react';
import { ProceduralLevelWizard } from '@/components/modules/content/level-design/ProceduralLevelWizard';
import {
  procgenSpecReducer, initialProcgenSpecState, type ProcgenSpecState, type ProcgenSpecAction,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/specState';
import {
  exportFlowReducer, exportKey, IDLE_EXPORT_FLOW, type ExportFlow, type PendingBlenderExport,
} from '@/components/modules/content/level-design/ProceduralLevelWizard/exportFlow';
import { BlenderExportConfirm } from '@/components/modules/content/level-design/ProceduralLevelWizard/BlenderExportConfirm';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { DEFAULT_BLENDER_HOST, DEFAULT_BLENDER_PORT } from '@/lib/blender-mcp/types';

afterEach(cleanup);

const PENDING = {
  plan: {
    algorithm: 'bsp', requestedWidth: 50, requestedHeight: 50, width: 50, height: 50, scale: 1,
    isFullSize: true, isHeavy: false, objectCount: 10, seedLabel: '', seedValue: 0,
  },
  placement: { spawns: [], placed: [], unplaced: [] },
  grid: [],
} as unknown as PendingBlenderExport;

function run(state: ProcgenSpecState, ...actions: ProcgenSpecAction[]) {
  return actions.reduce(procgenSpecReducer, state);
}
const flowAction = (action: Parameters<typeof exportFlowReducer>[1]): ProcgenSpecAction =>
  ({ type: 'exportFlow', action });

function prepared(): ProcgenSpecState {
  const s = initialProcgenSpecState();
  return run(s, flowAction({ type: 'prepared', pending: PENDING, exportKey: exportKey(s.spec) }));
}

describe('exportFlowReducer', () => {
  it('idle + prepared holds the plan and the key of its spec', () => {
    const f = exportFlowReducer(IDLE_EXPORT_FLOW, { type: 'prepared', pending: PENDING, exportKey: 'k' });
    expect(f).toEqual({ status: 'prepared', pending: PENDING, exportKey: 'k' });
  });

  it('confirm sends once; a second confirm returns the identical state', () => {
    const p = exportFlowReducer(IDLE_EXPORT_FLOW, { type: 'prepared', pending: PENDING, exportKey: 'k' });
    const sending = exportFlowReducer(p, { type: 'confirm' });
    expect(sending.status).toBe('sending');
    expect(exportFlowReducer(sending, { type: 'confirm' })).toBe(sending);
  });

  it('settled ok clears the plan; settled error keeps it for Retry', () => {
    const sending: ExportFlow = { status: 'sending', pending: PENDING, exportKey: 'k' };
    const done = exportFlowReducer(sending, { type: 'settled', ok: true, message: 'sent' });
    expect(done).toEqual({ status: 'done', message: 'sent' });
    const failed = exportFlowReducer(sending, { type: 'settled', ok: false, message: 'boom' });
    expect(failed).toMatchObject({ status: 'failed', message: 'boom', pending: PENDING });
    expect(exportFlowReducer(failed, { type: 'confirm' }).status).toBe('sending');
  });

  it('a prepare cannot replace a send in flight', () => {
    const sending: ExportFlow = { status: 'sending', pending: PENDING, exportKey: 'k' };
    expect(exportFlowReducer(sending, { type: 'prepared', pending: PENDING, exportKey: 'z' })).toBe(sending);
  });
});

describe('procgenSpecReducer export flow', () => {
  it('starts idle', () => {
    expect(initialProcgenSpecState().flow.status).toBe('idle');
  });

  it.each<[string, ProcgenSpecAction]>([
    ['updateSize', { type: 'updateSize', key: 'gridWidth', value: 77 }],
    ['setAlgorithm', { type: 'setAlgorithm', algorithm: 'cellular' }],
    ['setSeed', { type: 'setSeed', seed: 'other' }],
  ])('%s marks a prepared flow stale, and confirm is then a no-op', (_n, action) => {
    const stale = run(prepared(), action);
    expect(stale.flow.status).toBe('stale');
    expect(run(stale, flowAction({ type: 'confirm' })).flow).toBe(stale.flow);
  });

  it('an edit that leaves exportKey unchanged keeps the flow prepared', () => {
    const p = prepared();
    expect(run(p, { type: 'setSeed', seed: p.spec.seedLabel }).flow.status).toBe('prepared');
    expect(run(p, { type: 'selectLevelType', levelType: p.spec.levelType }).flow.status).toBe('prepared');
  });

  it("'shown' does not reset a sending flow", () => {
    const sending = run(prepared(), flowAction({ type: 'confirm' }));
    expect(sending.flow.status).toBe('sending');
    expect(run(sending, { type: 'shown' }).flow.status).toBe('sending');
  });
});

describe('BlenderExportConfirm with a stale plan', () => {
  it('states the settings changed and offers Re-prepare instead of confirm', () => {
    const onReprepare = vi.fn();
    render(
      <BlenderExportConfirm
        pending={PENDING} planSummary="p" spawnSummary="s" exporting={false}
        stale onReprepare={onReprepare} onConfirm={vi.fn()} onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId('blender-export-headline').textContent).toMatch(/settings changed/i);
    expect(screen.queryByTestId('blender-export-run')).toBeNull();
    fireEvent.click(screen.getByTestId('blender-export-reprepare'));
    expect(onReprepare).toHaveBeenCalledOnce();
  });
});

describe('the export outlives the wizard', () => {
  let resolveFetch: (r: Response) => void;
  let calls = 0;

  beforeEach(() => {
    calls = 0;
    act(() => {
      useBlenderMCPStore.setState({
        connection: { host: DEFAULT_BLENDER_HOST, port: DEFAULT_BLENDER_PORT, connected: true },
      });
    });
    vi.stubGlobal('fetch', vi.fn(() => {
      calls++;
      return new Promise<Response>((res) => { resolveFetch = res; });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('shows the result after unmount, resolve, remount; no Export button while sending', async () => {
    // A host that survives the wizard (as the level-design view does).
    function Shell() {
      const [state, dispatch] = useReducer(procgenSpecReducer, undefined, initialProcgenSpecState);
      const [on, setOn] = useReducerToggle();
      return (
        <>
          <button data-testid="toggle" onClick={setOn}>t</button>
          {on && <ProceduralLevelWizard onGenerate={vi.fn()} isGenerating={false} specStore={{ state, dispatch }} />}
        </>
      );
    }
    const { getByRole, getByTestId, queryByRole } = render(<Shell />);
    fireEvent.click(getByRole('button', { name: /Export to Blender/i }));
    await act(async () => {
      fireEvent.click(getByTestId('blender-export-run'));
      fireEvent.click(getByTestId('blender-export-run'));
    });
    expect(calls).toBe(1);
    expect(queryByRole('button', { name: /Export to Blender/i })).toBeNull();

    fireEvent.click(getByTestId('toggle')); // unmount
    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ success: true, data: { output: 'LANDED-OK' } }), { status: 200 }));
    });
    fireEvent.click(getByTestId('toggle')); // remount
    expect(screen.getByText('LANDED-OK')).toBeTruthy();
  });
});

function useReducerToggle(): [boolean, () => void] {
  const [n, bump] = useReducer((x: number) => x + 1, 0);
  return [n % 2 === 0, bump];
}
