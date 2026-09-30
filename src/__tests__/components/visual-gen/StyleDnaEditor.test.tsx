/**
 * Case 8 — expand -> edit (remove / add / promote) -> live preview -> Save as copy. The panel
 * issues exactly ONE write, POST /api/visual-gen/style-dna/fork, and never reaches a paid path:
 * no distillation job (POST /api/visual-gen/style-dna), no /api/leonardo, no /api/visual-gen/generate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { StyleDnaPanel } from '@/components/modules/visual-gen/asset-forge/StyleDnaPanel';
import { useForgeStore } from '@/components/modules/visual-gen/asset-forge/useForgeStore';
import type { StyleDnaProfile } from '@/lib/visual-gen/style-dna-db';

afterEach(cleanup);

const ACTIVE: StyleDnaProfile = {
  id: 'dna-1',
  name: 'Ashen',
  dna: {
    palette: ['ash gray'],
    materials: ['cracked stone', 'rusted iron', 'bone', 'wet leather', 'tarnished silver', 'rotten wood'],
    mood: ['grim', 'neon'],
    render: ['painterly'],
    motifs: [],
  },
  sourceImageCount: 4,
  active: true,
  canonProfile: null,
  createdAt: '2026-09-30',
};

const envelope = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  useForgeStore.setState({ activeStyleDna: null, applyStyleDna: true });
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/visual-gen/style-dna/fork' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string; dna: StyleDnaProfile['dna'] };
      return envelope({ profile: { ...ACTIVE, id: 'dna-2', name: body.name, dna: body.dna, createdAt: '2026-09-30b' } }, 201);
    }
    return envelope({ active: ACTIVE, profiles: [ACTIVE] });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('StyleDnaPanel — tune a style without re-paying (case 8)', () => {
  it('marks unsent chips, edits live, and saves a copy through the fork route only', async () => {
    render(<StyleDnaPanel />);
    expect(await screen.findByText('Ashen')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /project style/i }));
    expect(screen.getByTestId('dna-strip').textContent).toContain('2 materials not sent (cap 4)');

    fireEvent.click(screen.getByRole('button', { name: /edit style/i }));
    const editor = screen.getByTestId('style-dna-editor');
    fireEvent.click(within(editor).getByRole('button', { name: 'Remove “neon”' }));
    fireEvent.change(within(editor).getByLabelText('Add a mood chip'), { target: { value: 'oppressive' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Add mood chip' }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Promote “rotten wood”' }));

    const preview = within(editor).getByTestId('style-dna-preview');
    expect(preview.textContent).toContain('mood: grim, oppressive');
    expect(preview.textContent).toContain('materials: rotten wood, cracked stone, rusted iron, bone');
    expect(preview.textContent).not.toContain('neon');
    expect(editor.textContent).toContain('2 materials not sent (cap 4)');

    fireEvent.click(within(editor).getByRole('button', { name: /save as copy/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /project style/i }).textContent).toContain('Ashen (edited)'));
    expect(screen.getByRole('button', { name: 'Use “Ashen”' })).toBeTruthy();

    const calls = fetchMock.mock.calls as [string, RequestInit | undefined][];
    const writes = calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe('/api/visual-gen/style-dna/fork');
    expect(writes[0][1]?.method).toBe('POST');
    const sent = JSON.parse(writes[0][1]!.body as string) as { fromId: string; dna: StyleDnaProfile['dna'] };
    expect(sent.fromId).toBe('dna-1');
    expect(sent.dna.mood).toEqual(['grim', 'oppressive']);
    expect(sent.dna.materials[0]).toBe('rotten wood');
    expect(calls.some(([url, init]) => url === '/api/visual-gen/style-dna' && init?.method === 'POST')).toBe(false);
    expect(calls.some(([url]) => url.includes('/api/leonardo') || url.includes('/api/visual-gen/generate'))).toBe(false);
  });
});
