// Canon law editor (scan-sweep --challenge catalog-seed-data/B): a law's prompt reach is shown
// before Save, a refused save is never silent (no optimistic ghost in the store the lab prompts
// read), and an abandoned '+ Add rule' writes nothing anywhere.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('next/font/google', () => {
  const font = () => ({ className: 'font', variable: '--font' });
  return { IBM_Plex_Mono: font, Inter: font, JetBrains_Mono: font };
});

import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { CanonView } from '@/components/layout-lab/CanonView';
import { useCanonStore } from '@/components/layout-lab/canonStore';
import { LIGHT } from '@/components/layout-lab/theme';
import { ruleReach } from '@/lib/catalog/canon/ruleReach';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const REFUSAL = 'Unknown scope "bestiarys" — use global or a registered catalog id';
const BASE: ProjectRule[] = [{ id: 'pof-own', category: 'game', scope: 'global', title: 'PoF own rule', body: 'PoF only' }];

let postStatus = 200;
let fetchMock: ReturnType<typeof vi.fn>;
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

beforeEach(() => {
  postStatus = 200;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const ok = postStatus < 400;
      return { ok, status: postStatus, json: async () => (ok ? { success: true, data: JSON.parse(String(init.body)) } : { success: false, error: REFUSAL }) };
    }
    return { ok: false, status: 404, json: async () => ({ success: false, error: 'offline' }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  useCanonStore.setState({ rules: [...BASE] });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('canonStore.upsert', () => {
  it('a refused POST leaves the rules unchanged and returns the server reason', async () => {
    postStatus = 400;
    const res = await useCanonStore.getState().upsert({ id: 'typo', category: 'game', scope: 'bestiarys', title: 'T', body: 'B' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(REFUSAL);
    expect(useCanonStore.getState().rules).toEqual(BASE);
  });

  it('an accepted POST commits the rule locally', async () => {
    const rule: ProjectRule = { id: 'fresh', category: 'game', scope: 'global', title: 'T', body: 'B' };
    const res = await useCanonStore.getState().upsert(rule);
    expect(res.ok).toBe(true);
    expect(useCanonStore.getState().rules.map((r) => r.id)).toEqual(['pof-own', 'fresh']);
  });
});

describe('CanonView editor', () => {
  it('+ Add rule then Cancel writes nothing', () => {
    render(<CanonView t={LIGHT} />);
    fireEvent.click(screen.getAllByText('+ Add rule')[0]);
    fireEvent.click(screen.getByText('Cancel'));
    expect(posts()).toHaveLength(0);
    expect(useCanonStore.getState().rules).toEqual(BASE);
  });

  it('shows the live prompt reach; scope is a picker of global + registered catalogs', () => {
    render(<CanonView t={LIGHT} />);
    fireEvent.click(screen.getAllByText('+ Add rule')[1]); // the 'art' section
    const scope = screen.getByRole('combobox', { name: 'Scope' }) as HTMLSelectElement;
    const ids = allCatalogPipelines().map((p) => p.catalogId);
    expect([...scope.options].map((o) => o.value)).toEqual(['global', ...ids]);
    fireEvent.change(scope, { target: { value: 'items' } });
    const reach = ruleReach({ id: 'd', category: 'art', scope: 'items', title: '', body: '' }, allCatalogPipelines());
    expect(reach.stepCount).toBeGreaterThan(0);
    const line = screen.getByLabelText('Prompt reach').textContent ?? '';
    expect(line).toContain(`Enters ${reach.stepCount} prompt`);
    expect(line).toContain(reach.steps[0]);
    expect(posts()).toHaveLength(0);
  });

  it('a refused save keeps the editor open with the server reason and adds no rule', async () => {
    postStatus = 400;
    render(<CanonView t={LIGHT} />);
    fireEvent.click(screen.getAllByText('+ Add rule')[0]);
    const editor = screen.getByRole('group', { name: 'Canon rule editor' });
    fireEvent.change(within(editor).getByPlaceholderText('Rule title'), { target: { value: 'New law' } });
    fireEvent.change(within(editor).getByPlaceholderText('Rule body / guidance'), { target: { value: 'Body' } });
    fireEvent.click(within(editor).getByText('Save'));
    await waitFor(() => expect(within(editor).getByRole('alert').textContent).toContain(REFUSAL));
    expect(posts()).toHaveLength(1);
    expect(useCanonStore.getState().rules).toEqual(BASE);
  });
});
