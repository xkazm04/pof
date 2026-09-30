/**
 * The planner runs the streaming preflight before Generate.
 *
 * Before: Generate was disabled only by isGenerating / zones.length === 0, so a
 * duplicate EWorldZone enumerator reached the CLI, and a hitch was invisible.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { StreamingZonePlanner } from '@/components/modules/content/level-design/StreamingZonePlanner';

afterEach(cleanup);

const emptyCellAt00 = (c: HTMLElement) => c.querySelector('rect[x="1"][y="1"][fill="transparent"]');
const generate = () => screen.getByRole('button', { name: /Generate Map Matrix/ });
const panel = () => screen.getByTestId('streaming-preflight');

describe('StreamingZonePlanner preflight', () => {
  it('a second painted Town blocks Generate with the reason; its Fix renames it and Generate returns', () => {
    const onGenerate = vi.fn();
    const { container } = render(<StreamingZonePlanner onGenerate={onGenerate} isGenerating={false} />);
    expect((generate() as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^T\s*Town$/ }));
    fireEvent.click(emptyCellAt00(container)!);

    expect((generate() as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel()).getByText(/Duplicate EWorldZone identifier 'Town'/)).toBeTruthy();
    expect(screen.getByText(/Generate blocked/)).toBeTruthy();

    fireEvent.click(within(panel()).getByRole('button', { name: /^Fix/ }));
    expect((generate() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(generate());
    expect(onGenerate).toHaveBeenCalledTimes(1);
    const names = onGenerate.mock.calls[0][0].zones.map((z: { name: string }) => z.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('shows peak residency for the default plan', () => {
    render(<StreamingZonePlanner onGenerate={() => {}} isGenerating={false} />);
    expect(within(panel()).getByText(/Peak residency 5\/5 at Old Ruins/)).toBeTruthy();
  });

  it('selecting Town outlines the zones resident from it (Dark Forest, Catacombs)', () => {
    const { container } = render(<StreamingZonePlanner onGenerate={() => {}} isGenerating={false} />);
    expect(container.querySelectorAll('[data-resident="true"]')).toHaveLength(0);
    const town = Array.from(container.querySelectorAll('svg text')).find((t) => t.textContent === 'Town')!;
    fireEvent.click(town);
    expect(container.querySelectorAll('[data-resident="true"]')).toHaveLength(2);
    expect(within(panel()).getByText(/Resident from Town: 3\/5/)).toBeTruthy();
  });
});
