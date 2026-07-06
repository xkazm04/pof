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

    const btn = screen.getByRole('button', { name: /Run It \(dispatch\)/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dispatching…')).toBeTruthy();
    expect(screen.getByText(/dispatch in flight/)).toBeTruthy();
    const dispatchingBtn = screen.getByRole('button', { name: /Dispatching Run It/ }) as HTMLButtonElement;
    expect(dispatchingBtn.disabled).toBe(true);

    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/Recorded · step config \+ prompt saved to the pipeline/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Run It \(dispatch\)/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('guards against double-dispatch while in flight', async () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={120} />);

    const btn = screen.getByRole('button', { name: /Run It \(dispatch\)/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
  });

  it('reports validate error without entering dispatching state', () => {
    const onComplete = vi.fn();
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} validate={() => 'missing direction'} minDispatchMs={120} />);

    fireEvent.click(screen.getByRole('button', { name: /Run It \(dispatch\)/ }));

    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByText('Dispatching…')).toBeNull();
    expect(screen.getByText(/missing direction/)).toBeTruthy();
  });

  it('awaits async onComplete then resolves to success', async () => {
    let resolveFn: (() => void) | null = null;
    const onComplete = vi.fn(() => new Promise<void>((r) => { resolveFn = r; }));
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={20} />);

    fireEvent.click(screen.getByRole('button', { name: /Run It \(dispatch\)/ }));
    expect(screen.getByText('Dispatching…')).toBeTruthy();

    await act(async () => { resolveFn?.(); });
    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/Recorded/)).toBeTruthy();
  });

  it('is functionally honest — states config+prompt are recorded, never claims a CLI ran or a UE asset was written', () => {
    const { container } = render(<CliProduce t={t} label="Produce Icon Set" buildPrompt={() => 'p'} onComplete={vi.fn()} />);
    // Persistent honesty note sets expectations up front.
    expect(screen.getByText(/produced by a CLI session or the gate drain — not in this panel/i)).toBeTruthy();
    // The old overclaim must not appear anywhere (no "written to the UE project").
    expect(container.textContent ?? '').not.toMatch(/written to the UE project/i);
    // On success the message is honest about scope (recorded to the pipeline), not "written to UE".
    fireEvent.click(screen.getByRole('button', { name: /Produce Icon Set/ }));
    expect(screen.getByText(/Recorded · step config \+ prompt saved to the pipeline/)).toBeTruthy();
    expect(screen.queryByText(/written to the UE project/i)).toBeNull();
  });

  it('reports an error if onComplete rejects', async () => {
    const onComplete = vi.fn(() => Promise.reject(new Error('CLI exited 1')));
    render(<CliProduce t={t} label="Run It" buildPrompt={() => ''} onComplete={onComplete} minDispatchMs={20} />);

    fireEvent.click(screen.getByRole('button', { name: /Run It \(dispatch\)/ }));

    await waitFor(() => expect(screen.queryByText('Dispatching…')).toBeNull());
    expect(screen.getByText(/CLI exited 1/)).toBeTruthy();
  });
});
