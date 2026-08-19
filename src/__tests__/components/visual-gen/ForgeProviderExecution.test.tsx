import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerationPanel } from '@/components/modules/visual-gen/asset-forge/GenerationPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import {
  providerExecution,
  defaultProviderForMode,
  getProviderById,
  getOfficialProvider,
} from '@/lib/visual-gen/providers';

function envelope(data: unknown): Response {
  return { json: async () => ({ success: true, data }) } as unknown as Response;
}

/** Mock POST /generate (and swallow the status polls the submit starts). */
function mockGenerate() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/api/visual-gen/generate/status')) return envelope({ status: 'running' });
    return envelope({ jobId: 'runner-job-1' });
  });
  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}

const provider = (id: string) => {
  const p = getProviderById(id);
  if (!p) throw new Error(`no provider ${id}`);
  return p;
};

afterEach(() => {
  cleanup();
  useForgeStore.getState().stopAllPolling();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

beforeEach(() => {
  // The DEFAULT state of a fresh session: the official provider + text-to-3d mode.
  useForgeStore.setState({
    jobs: [],
    activeProviderId: getOfficialProvider().id,
    promptHistory: [],
    activeStyleDna: null,
    applyStyleDna: true,
    activePolls: [],
  });
  useBlenderMCPStore.setState({ connection: { host: '127.0.0.1', port: 9876, connected: false } });
});

describe('providerExecution — registry membership is not capability', () => {
  it('refuses a metadata-only provider with a reason', () => {
    const exec = providerExecution(provider('trellis2'), 'text-to-3d');
    expect(exec.executable).toBe(false);
    expect(exec.reason).toContain('No runner configured for this provider on this machine');
    expect(exec.reason).toContain('TRELLIS.2');
    expect(exec.path).toBeUndefined();
  });

  it('marks a coming-soon provider unrunnable and says it is not implemented', () => {
    const exec = providerExecution(provider('meshy'), 'image-to-3d');
    expect(exec.executable).toBe(false);
    expect(exec.reason).toContain('not implemented yet');
  });

  it('names the runner and MCP paths for providers that have them', () => {
    expect(providerExecution(provider('tripo3d'), 'text-to-3d')).toEqual({ executable: true, path: 'runner' });
    expect(providerExecution(provider('hunyuan3d'), 'image-to-3d')).toEqual({ executable: true, path: 'runner' });
    expect(providerExecution(provider('rodin'), 'text-to-3d')).toEqual({ executable: true, path: 'mcp' });
  });

  it('refuses a mode the provider does not support, even with a runner behind it', () => {
    const exec = providerExecution(provider('hunyuan3d'), 'text-to-3d');
    expect(exec.executable).toBe(false);
    expect(exec.reason).toContain('does not support text-to-3d');
  });
});

describe('defaultProviderForMode — the fallback can run', () => {
  /** FORCED FAILURE (red before this direction): the fallback was
   *  `providersForMode[0]`, i.e. trellis2 for the default mode. */
  it('never falls back to a provider with no execution path', () => {
    const d = defaultProviderForMode('text-to-3d');
    expect(d?.id).toBe('tripo3d');
    expect(d?.id).not.toBe('trellis2');
    expect(providerExecution(d!, 'text-to-3d').executable).toBe(true);
  });

  it('prefers the official provider when it can run the mode', () => {
    expect(defaultProviderForMode('image-to-3d')?.id).toBe(getOfficialProvider().id);
  });
});

describe('GenerationPanel — the default first click cannot mint a phantom job', () => {
  /**
   * FORCED FAILURE (red before this direction): default provider (image-only) +
   * default mode (text-to-3d) fell back to trellis2, `canSubmit` was true, and the
   * click dropped into a placeholder `addJob` — `pending` forever, no poller, no
   * error, no timeout.
   */
  it('submits the default text-to-3d request to the real route, with the prompt', async () => {
    const fetchMock = mockGenerate();
    render(<GenerationPanel />);

    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });
    fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/visual-gen/generate');
    const body = JSON.parse(String(init.body)) as { mode: string; providerId: string; prompt?: string };
    expect(body.mode).toBe('text-to-3d');
    expect(body.providerId).toBe('tripo3d');
    expect(body.prompt).toContain('a battle axe');

    // …and the job it created is being driven, not abandoned in `pending`.
    await waitFor(() => {
      const { jobs, activePolls } = useForgeStore.getState();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('generating');
      expect(activePolls).toContain(jobs[0].id);
    });
    expect(useForgeStore.getState().jobs.every((j) => j.status !== 'pending')).toBe(true);
  });

  it('refuses a provider with no execution path and states why', () => {
    const fetchMock = mockGenerate();
    useForgeStore.setState({ activeProviderId: 'trellis2' });
    render(<GenerationPanel />);

    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });

    const submit = screen.getByRole('button', { name: /generate 3d model/i });
    expect(submit.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('forge-submit-block').textContent).toContain('No runner configured');

    // Even a forced click enqueues nothing — the handler shares the button's gate.
    fireEvent.click(submit);
    expect(useForgeStore.getState().jobs).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the unrunnable providers in the picker instead of offering them as Free', () => {
    render(<GenerationPanel />);
    const trellis = screen.getByTestId('forge-provider-trellis2');
    expect(trellis.getAttribute('data-executable')).toBe('false');
    expect(trellis.hasAttribute('disabled')).toBe(true);
    expect(trellis.textContent).toContain('NO RUNNER');

    const tripo = screen.getByTestId('forge-provider-tripo3d');
    expect(tripo.getAttribute('data-executable')).toBe('true');
    expect(tripo.textContent).toContain('Runner');
  });

  it('blocks an MCP provider on the disconnected bridge, not on a missing runner', () => {
    useForgeStore.setState({ activeProviderId: 'rodin' });
    render(<GenerationPanel />);
    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });
    expect(screen.getByTestId('forge-submit-block').textContent).toContain('Blender MCP is not connected');
  });
});

describe('retryJob — a retry that cannot run says so instead of re-queuing', () => {
  it('does not mint a fresh pending job for a provider with no execution path', () => {
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A sword', providerId: 'trellis2' });
    useForgeStore.getState().updateJob(id, { status: 'failed', error: 'Generation failed.' });

    useForgeStore.getState().retryJob(id);

    const { jobs } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(id);
    expect(jobs[0].status).toBe('failed');
    expect(jobs[0].error).toContain('Retry unavailable');
    expect(jobs[0].error).toContain('No runner configured');
  });

  it('re-runs a runner-backed text-to-3d job through the real route', async () => {
    const fetchMock = mockGenerate();
    const id = useForgeStore.getState().addJob({ mode: 'text-to-3d', prompt: 'A sword', providerId: 'tripo3d' });
    useForgeStore.getState().updateJob(id, { status: 'failed', error: 'boom' });

    useForgeStore.getState().retryJob(id);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).prompt).toBe('A sword');
    const { jobs } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).not.toBe(id);
  });
});
