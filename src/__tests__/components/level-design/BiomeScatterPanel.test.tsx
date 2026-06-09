import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import {
  BiomeScatterPanel,
  validateDensity,
  validateSeed,
  DENSITY_MIN,
  DENSITY_MAX,
} from '@/components/modules/content/level-design/BiomeScatterPanel';

afterEach(cleanup);

describe('validateDensity', () => {
  it('accepts values inside the [min, max] range', () => {
    expect(validateDensity('1')).toBeNull();
    expect(validateDensity(String(DENSITY_MIN))).toBeNull();
    expect(validateDensity(String(DENSITY_MAX))).toBeNull();
  });

  it('rejects an empty / cleared field', () => {
    expect(validateDensity('')).toBe('Enter a density value');
    expect(validateDensity('   ')).toBe('Enter a density value');
  });

  it('rejects NaN / non-numeric input', () => {
    expect(validateDensity('abc')).toBe('Density must be a number');
  });

  it('rejects out-of-range values', () => {
    expect(validateDensity('99')).toBe(`Density must be between ${DENSITY_MIN} and ${DENSITY_MAX}`);
    expect(validateDensity('0')).toBe(`Density must be between ${DENSITY_MIN} and ${DENSITY_MAX}`);
  });
});

describe('validateSeed', () => {
  it('accepts non-negative whole numbers', () => {
    expect(validateSeed('0')).toBeNull();
    expect(validateSeed('1337')).toBeNull();
  });

  it('rejects an empty / cleared field (NaN guard)', () => {
    expect(validateSeed('')).toBe('Enter a seed');
  });

  it('rejects non-numeric, fractional, and negative seeds', () => {
    expect(validateSeed('abc')).toBe('Seed must be a number');
    expect(validateSeed('1.5')).toBe('Seed must be a whole number');
    expect(validateSeed('-3')).toBe('Seed must be 0 or greater');
  });
});

describe('BiomeScatterPanel', () => {
  it('renders the empty state and density range helper text by default', async () => {
    mockFetch({ body: { success: true, data: null } });
    const { findByTestId, getByText } = render(
      <BiomeScatterPanel onGenerate={vi.fn()} isGenerating={false} />,
    );
    const help = await findByTestId('scatter-density-help');
    expect(help.textContent).toBe(`Range ${DENSITY_MIN}–${DENSITY_MAX}`);
    expect(getByText(/No scatter yet/i)).toBeTruthy();
  });

  it('shows an inline error and disables generate when density is out of range', async () => {
    mockFetch({ body: { success: true, data: null } });
    const onGenerate = vi.fn();
    const { getByTestId, getByRole } = render(
      <BiomeScatterPanel onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.change(getByTestId('scatter-density-input'), { target: { value: '99' } });
    expect(getByTestId('scatter-density-help').textContent).toContain('must be between');
    const btn = getByRole('button', { name: /scatter props/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('guards against a cleared (NaN) seed and disables generate', async () => {
    mockFetch({ body: { success: true, data: null } });
    const onGenerate = vi.fn();
    const { getByTestId, getByRole } = render(
      <BiomeScatterPanel onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.change(getByTestId('scatter-seed-input'), { target: { value: '' } });
    expect(getByTestId('scatter-seed-help').textContent).toBe('Enter a seed');
    expect((getByRole('button', { name: /scatter props/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('passes parsed numeric density + floored seed to onGenerate when valid', async () => {
    mockFetch({ body: { success: true, data: null } });
    const onGenerate = vi.fn();
    const { getByTestId, getByRole } = render(
      <BiomeScatterPanel onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.change(getByTestId('scatter-density-input'), { target: { value: '2.5' } });
    fireEvent.change(getByTestId('scatter-seed-input'), { target: { value: '42' } });
    fireEvent.click(getByRole('button', { name: /scatter props/i }));
    expect(onGenerate).toHaveBeenCalledWith(2.5, 42);
  });

  it('surfaces a fetch failure instead of swallowing it silently', async () => {
    mockFetch({ body: { success: false, error: 'scatter store offline' } });
    const { findByTestId } = render(
      <BiomeScatterPanel onGenerate={vi.fn()} isGenerating={false} />,
    );
    const errBox = await findByTestId('scatter-fetch-error');
    expect(errBox.textContent).toContain('scatter store offline');
  });

  it('surfaces a thrown dispatch error from onGenerate', async () => {
    mockFetch({ body: { success: true, data: null } });
    const onGenerate = vi.fn(() => {
      throw new Error('CLI session busy');
    });
    const { getByRole, findByTestId } = render(
      <BiomeScatterPanel onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.click(getByRole('button', { name: /scatter props/i }));
    const errBox = await findByTestId('scatter-generate-error');
    expect(errBox.textContent).toContain('CLI session busy');
  });

  it('does not poll while a generation is in flight', async () => {
    const fetchMock = mockFetch({ body: { success: true, data: null } });
    render(<BiomeScatterPanel onGenerate={vi.fn()} isGenerating={true} />);
    await waitFor(() => {
      // effect early-returns when isGenerating — no fetch should fire
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
