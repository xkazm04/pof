import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
vi.mock('next/font/google', () => { const f = () => ({ className: 'm' }); return { IBM_Plex_Mono: f, Inter: f, JetBrains_Mono: f }; });
import { CliProduce } from '@/components/layout-lab/steps/shared/CliProduce';
import { LAB_THEMES } from '@/components/layout-lab/theme';

const t = LAB_THEMES[0];

describe('CliProduce dispatching state', () => {
  afterEach(cleanup);

  it('shows "Dispatching…" + disables button between click and resolution', async () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={(d) => `do ${d}`} onComplete={onComplete} minDispatchMs={120} />);

    const btn = screen.getByRole('button', { name: /⚡ Run It/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dispatching…')).toBeTruthy();
    expect(screen.getByText(/dispatch in flight/)).toBeTruthy();
    const dispatchingBtn = screen.getByRole('button', { name: /Dispatching Run It/ }) as HTMLButtonElement;
    expect(dispatchingBtn.disabled).toBe(true);

    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/Recorded · step config \+ prompt saved to the pipeline/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /⚡ Run It/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('guards against double-dispatch while in flight', async () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={120} />);

    const btn = screen.getByRole('button', { name: /⚡ Run It/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
  });

  it('reports validate error without entering dispatching state', () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} validate={() => 'missing direction'} />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('Dispatching…')).toBeNull();
    expect(screen.getByText(/missing direction/)).toBeTruthy();
  });

  it('awaits async onComplete then resolves to success', async () => {
    let resolveFn: (() => void) | null = null;
    const onComplete = vi.fn(() => new Promise<void>((r) => { resolveFn = r; }));
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={20} />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));
    expect(screen.getByText('Dispatching…')).toBeTruthy();

    await act(async () => { resolveFn?.(); });
    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/Recorded/)).toBeTruthy();
  });

  it('rides the async path by DEFAULT (no minDispatchMs) — surfaces a rejection inline', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error('CLI exited 1')));
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));
    // The async engine ran (Dispatching flashed → error surfaced), even without minDispatchMs.
    const node = await screen.findByTestId('cli-produce-result');
    expect(node.textContent).toContain('✗');
    expect(node.textContent).toContain('CLI exited 1');
  });

  it('is functionally honest — states config+prompt are recorded, never claims a CLI ran or a UE asset was written', async () => {
    const { container } = render(<CliProduce t={t} label="Produce Icon Set" buildPrompt={() => 'p'} onComplete={vi.fn()} />);
    // Persistent honesty note sets expectations up front.
    expect(screen.getByText(/produced by a CLI session or the gate drain — not in this panel/i)).toBeTruthy();
    // The old overclaim must not appear anywhere (no "written to the UE project").
    expect(container.textContent ?? '').not.toMatch(/written to the UE project/i);
    // On success the message is honest about scope (recorded to the pipeline), not "written to UE".
    fireEvent.click(screen.getByRole('button', { name: /Produce Icon Set/ }));
    const node = await screen.findByTestId('cli-produce-result');
    expect(node.textContent).toContain('Recorded · step config + prompt saved to the pipeline');
    expect(screen.queryByText(/written to the UE project/i)).toBeNull();
  });

  it('reports an error if onComplete rejects', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error('CLI exited 1')));
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={20} />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));

    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/CLI exited 1/)).toBeTruthy();
  });

  it('offers "Retry with same prompt" on error and re-dispatches the EXACT failed prompt', async () => {
    const seen: string[] = [];
    let failNext = true;
    const onComplete = vi.fn((ctx?: { direction: string; prompt: string }) => {
      seen.push(ctx?.prompt ?? '');
      if (failNext) { failNext = false; return Promise.reject(new Error('flaky CLI')); }
      return Promise.resolve();
    });
    render(<CliProduce t={t} label="Run It" buildPrompt={(d) => `built:${d}`} defaultDirection="steel" onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));
    const retry = await screen.findByTestId('cli-produce-retry');
    expect(retry.textContent).toContain('Retry with same prompt');

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByTestId('cli-produce-result').textContent).toContain('✓'));
    // Both dispatches carried the identical built prompt.
    expect(seen).toEqual(['built:steel', 'built:steel']);
    expect(screen.queryByTestId('cli-produce-retry')).toBeNull();
  });

  it('sync opt-out keeps the legacy synchronous path (result set on the click, no in-flight state)', () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} sync />);

    fireEvent.click(screen.getByRole('button', { name: /⚡ Run It/ }));
    // Synchronous: onComplete ran and the result is present immediately, with no Dispatching flash.
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Dispatching…')).toBeNull();
    expect(screen.getByTestId('cli-produce-result').textContent).toContain('Recorded');
  });
});
