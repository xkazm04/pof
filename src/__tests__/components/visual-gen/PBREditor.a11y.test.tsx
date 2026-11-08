import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { mockFetch } from '@/__tests__/setup';
import { PBREditor } from '@/components/modules/visual-gen/material-lab/PBREditor';
import { useMaterialStore } from '@/components/modules/visual-gen/material-lab/useMaterialStore';

const CHANNELS = ['albedo', 'normal', 'metallic', 'roughness', 'ao'] as const;
const LABELS: Record<(typeof CHANNELS)[number], string> = {
  albedo: 'Albedo', normal: 'Normal', metallic: 'Metallic', roughness: 'Roughness', ao: 'AO',
};

beforeEach(() => {
  mockFetch({ body: { success: true, data: [] } });
  useMaterialStore.getState().reset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); useMaterialStore.getState().reset(); });

describe('PBREditor — texture slot upload is keyboard reachable', () => {
  it.each(CHANNELS)('%s: the file input stays in the tab order and is named', (channel) => {
    render(<PBREditor />);
    const input = screen.getByTestId(`texture-slot-${channel}`).querySelector('input[type="file"]') as HTMLInputElement;
    // `hidden` is display:none, which removes the only focusable control from the tab order.
    expect(input.className.split(/\s+/)).not.toContain('hidden');
    expect(input.getAttribute('aria-label')).toBe(`Upload ${LABELS[channel]} map`);
  });
});

describe('PBREditor — texture slot clear button is named', () => {
  it.each(CHANNELS)('%s: the icon-only clear button has an accessible name', (channel) => {
    useMaterialStore.setState({ [`${channel}Texture`]: `/maps/${channel}.png` });
    render(<PBREditor />);
    expect(screen.getByRole('button', { name: `Clear ${LABELS[channel]} map` })).toBeTruthy();
  });
});
