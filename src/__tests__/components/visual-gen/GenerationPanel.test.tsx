import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { GenerationPanel } from '@/components/modules/visual-gen/asset-forge/GenerationPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';

afterEach(cleanup);

beforeEach(() => {
  useForgeStore.setState({ jobs: [], activeProviderId: 'triposr', promptHistory: [], activeStyleDna: null, applyStyleDna: true });
  useBlenderMCPStore.setState({
    connection: { host: '127.0.0.1', port: 9876, connected: false },
  });
});

describe('GenerationPanel — chip prompt builder', () => {
  it('renders the Material / Mood / Game-style chip groups instead of a raw textarea', () => {
    render(<GenerationPanel />);
    expect(screen.getByText('Material')).toBeTruthy();
    expect(screen.getByText('Mood')).toBeTruthy();
    expect(screen.getByText('Game style')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stone' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark Souls' })).toBeTruthy();
  });

  it('toggles a chip and reflects it in the composed prompt preview', () => {
    render(<GenerationPanel />);
    const stone = screen.getByRole('button', { name: 'Stone' });
    expect(stone.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(stone);
    expect(stone.getAttribute('aria-pressed')).toBe('true');

    // The preview now contains the technical phrasing the user never had to type.
    expect(screen.getByText(/carved stone, weathered rock surface/)).toBeTruthy();
    expect(screen.getByText(/game-ready 3D asset/)).toBeTruthy();
  });

  it('keeps submit disabled until a subject or chip is provided', () => {
    render(<GenerationPanel />);
    const submit = screen.getByRole('button', { name: /generate 3d model/i });
    expect(submit.hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Metal' }));
    expect(submit.hasAttribute('disabled')).toBe(false);
  });

  it('dispatches a job with the composed prompt under the hood', () => {
    render(<GenerationPanel />);
    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), {
      target: { value: 'a battle axe' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Metal' }));
    fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));

    const { jobs } = useForgeStore.getState();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].prompt).toContain('a battle axe');
    expect(jobs[0].prompt).toContain('forged metal, brushed steel surface');
    expect(jobs[0].prompt).toContain('game-ready 3D asset');
  });

  it('resets the builder after a successful submit', () => {
    render(<GenerationPanel />);
    const stone = screen.getByRole('button', { name: 'Stone' });
    fireEvent.click(stone);
    fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));

    expect(stone.getAttribute('aria-pressed')).toBe('false');
  });

  it('exposes an advanced raw-prompt override seeded from the chips', () => {
    render(<GenerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Stone' }));
    fireEvent.click(screen.getByRole('button', { name: /edit raw prompt/i }));

    const raw = screen.getByPlaceholderText(/type the exact prompt/i) as HTMLTextAreaElement;
    expect(raw.value).toContain('carved stone, weathered rock surface');
  });

  it('appends the active Style DNA fragment to the submitted prompt and says so', () => {
    useForgeStore.setState({
      applyStyleDna: true,
      activeStyleDna: {
        id: 'dna-1',
        name: 'Alice gothic',
        dna: { palette: ['desaturated teal'], materials: ['aged brass'], mood: [], render: ['painterly'], motifs: [] },
        sourceImageCount: 4,
        active: true,
        createdAt: '2026-07-13',
      },
    });
    render(<GenerationPanel />);
    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });
    expect(screen.getByTestId('style-dna-indicator').textContent).toContain('Alice gothic');

    fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));
    const { jobs } = useForgeStore.getState();
    expect(jobs[0].prompt).toContain('a battle axe');
    expect(jobs[0].prompt).toContain('desaturated teal');
    expect(jobs[0].prompt).toContain('painterly');
  });

  it('does not append the style fragment when the apply toggle is off', () => {
    useForgeStore.setState({
      applyStyleDna: false,
      activeStyleDna: {
        id: 'dna-1',
        name: 'Alice gothic',
        dna: { palette: ['desaturated teal'], materials: [], mood: [], render: [], motifs: [] },
        sourceImageCount: 4,
        active: true,
        createdAt: '2026-07-13',
      },
    });
    render(<GenerationPanel />);
    fireEvent.change(screen.getByPlaceholderText(/a medieval sword/i), { target: { value: 'a battle axe' } });
    expect(screen.queryByTestId('style-dna-indicator')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /generate 3d model/i }));
    expect(useForgeStore.getState().jobs[0].prompt).not.toContain('desaturated teal');
  });
});
