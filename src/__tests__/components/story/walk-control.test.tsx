/**
 * The /story Walk control, end to end in jsdom: StoryMap loads a stored graph, the Walk button
 * starts a job, the poll shows progress, and on `done` the merged evidence reaches the lens and the
 * leads reach the Audit tab. `fetch` is stubbed per URL; timers are fake so the poll is driven.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StoryMap } from '@/components/story/StoryMap';
import { UI_TIMEOUTS } from '@/lib/constants';
import { installCanvasStub, stubElementBox } from '@/__tests__/components/story/orrery/_canvas';
import { honestyGraph } from '@/__tests__/components/story/orrery/panelFixture';
import { HASH, walkReport } from '@/__tests__/components/story/walkFixture';
import type { WalkerReport } from '@/lib/story/types';

const POLL = UI_TIMEOUTS.storyWalkPoll;
const g = honestyGraph();
const SUMMARY = { id: 'fx::inspector', project: g.project, graphId: g.graphId, name: 'Inspector Fixture', hash: HASH, nodeCount: g.nodes.length };

type Reply = { status?: number; body: unknown };
const ok = (data: unknown, status = 200): Reply => ({ status, body: { success: true, data } });
const bad = (error: string, status: number): Reply => ({ status, body: { success: false, error } });

interface Script {
  post: Reply;
  polls: Reply[];
}

let calls: { url: string; method: string }[] = [];

function stubFetch(script: Script) {
  calls = [];
  let poll = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    let reply: Reply;
    if (url === '/api/story/graphs') reply = ok([SUMMARY]);
    else if (url.startsWith('/api/story/graphs/')) reply = ok({ ...SUMMARY, graph: g });
    else if (url === '/api/story/walk' && method === 'POST') reply = script.post;
    else if (url.startsWith('/api/story/walk/')) reply = script.polls[Math.min(poll++, script.polls.length - 1)];
    else reply = bad(`unexpected ${method} ${url}`, 500);
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const started = ok({ jobId: 'walk-1', state: 'queued', progress: { done: 0, total: 400 } }, 202);
const running = (done: number) => ok({ jobId: 'walk-1', state: 'running', progress: { done, total: 400 } });
const done = (report: WalkerReport = walkReport()) =>
  ok({ jobId: 'walk-1', state: 'done', progress: { done: 400, total: 400 }, report, durationMs: 12.5 });

const flush = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

async function mount() {
  const r = render(<StoryMap />);
  await flush();
  await flush();
  const btn = () => r.container.querySelector('[data-role=orrery-walk-btn]') as HTMLButtonElement;
  return { ...r, btn };
}

beforeEach(() => {
  vi.useFakeTimers();
  installCanvasStub();
  stubElementBox(1200, 760);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Walk control', () => {
  it('idle: offers Walk and says no sampled walk exists yet', async () => {
    stubFetch({ post: started, polls: [done()] });
    const { container, btn } = await mount();
    expect(btn()).not.toBeNull();
    expect(btn().disabled).toBe(false);
    expect(btn().textContent).toBe('Walk');
    expect(container.querySelector('[data-role=orrery-walk]')?.getAttribute('data-phase')).toBe('idle');
    expect(container.querySelector('[data-role=orrery-walk]')?.textContent).toContain('No sampled walk yet');
  });

  it('click POSTs the stored graph, then shows done/total progress while polling', async () => {
    const fetchMock = stubFetch({ post: started, polls: [running(150), done()] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    const post = fetchMock.mock.calls.find(([u, i]) => String(u) === '/api/story/walk' && i?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ graphId: g.graphId, project: g.project });
    expect(btn().disabled).toBe(true);
    expect(container.querySelector('[data-role=orrery-walk-status]')?.textContent).toContain('0 / 400');

    await flush(POLL);
    const bar = container.querySelector('[data-role=orrery-walk-progress]') as HTMLProgressElement;
    expect(bar.getAttribute('value')).toBe('150');
    expect(bar.getAttribute('max')).toBe('400');
    expect(container.querySelector('[data-role=orrery-walk-status]')?.textContent).toContain('150 / 400');
  });

  it('done: labels the data as sampled, merges it into the lens, and lists leads apart from defects', async () => {
    stubFetch({ post: started, polls: [done()] });
    const { container, btn } = await mount();
    const lensBefore = [...container.querySelectorAll('select[aria-label="Reach lens"] option')].map((o) => o.getAttribute('value'));
    expect(lensBefore).not.toContain('uniform');
    const auditBefore = container.querySelector('[data-role=orrery-tabcount]')?.textContent;

    fireEvent.click(btn());
    await flush();
    await flush(POLL);

    const walk = container.querySelector('[data-role=orrery-walk]')!;
    expect(walk.getAttribute('data-phase')).toBe('done');
    expect(walk.querySelector('[data-walk-label]')?.textContent).toBe('sampled (pof-walker@1, 400 walks, seed 7)');
    expect(walk.textContent).toContain('engine pof-walker@1 · 400 samples · seed 7 · 13 ms');

    // The lens now offers the sampled cohort, next to the imported one.
    const lens = container.querySelector('select[aria-label="Reach lens"]') as HTMLSelectElement;
    const values = [...lens.querySelectorAll('option')].map((o) => o.getAttribute('value'));
    expect(values).toContain('uniform');
    expect(values).toContain('all');
    fireEvent.click(walk.querySelector('[data-role=orrery-walk-lens]')!);
    expect(lens.value).toBe('uniform');

    // Per-cohort status: the sampled cohort is verified, the imported one is not, and says so.
    const cohorts = [...walk.querySelectorAll('[data-role=orrery-walk-cohorts] li')];
    const status = Object.fromEntries(cohorts.map((li) => [li.textContent!.split(' · ')[0].slice(2), li.getAttribute('data-status')]));
    expect(status).toEqual({ all: 'unverified', uniform: 'verified' });

    // Leads: their own group in the Audit tab; the tab count stays the structural one.
    expect(container.querySelector('[data-role=orrery-tabcount]')?.textContent).toBe(auditBefore);
    fireEvent.click([...container.querySelectorAll('[role=tab]')].find((t) => t.textContent?.startsWith('Audit'))!);
    const groups = [...container.querySelectorAll('[data-role=orrery-audit-group]')];
    const leads = groups.find((s) => s.textContent?.startsWith('Leads - reproduce before trusting'));
    expect(leads).toBeDefined();
    const item = leads!.closest('details')!.querySelector('[data-role=orrery-audit-item]');
    expect(item?.textContent).toContain('seed 7');
    expect(item?.textContent).toContain('path l.zero › l.half');
  });

  it('cells: unverified and verified cells are marked apart; a measured 0 and an unmeasured node differ', async () => {
    stubFetch({ post: started, polls: [done()] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    await flush(POLL);
    const search = container.querySelector('[data-role=orrery-search]') as HTMLInputElement;
    const pick = (q: string) => {
      fireEvent.change(search, { target: { value: q } });
      fireEvent.keyDown(search, { key: 'Enter' });
    };

    pick('l.half');
    const cells = [...container.querySelectorAll('[data-role=orrery-walk-cell]')];
    const by = Object.fromEntries(cells.map((c) => [c.firstElementChild?.textContent, c]));
    expect(by.all.getAttribute('data-status')).toBe('unverified');
    expect(by.all.getAttribute('data-source')).toBe('imported');
    expect(by.all.textContent).toContain('outranks sampled 70%');
    expect(by.uniform.getAttribute('data-status')).toBe('verified');
    expect(by.all.textContent).toContain('?');
    expect(by.uniform.textContent).toContain('✓');

    pick('l.none');
    const zero = container.querySelector('[data-role=orrery-walk-cell]');
    expect(zero?.querySelector('b')?.textContent).toBe('0%');
    expect(container.querySelector('[data-role=orrery-walk-cells]')?.getAttribute('data-measured')).toBe('true');

    pick('l.ghost');
    const none = container.querySelector('[data-role=orrery-walk-cells]');
    expect(none?.getAttribute('data-measured')).toBe('false');
    expect(none?.textContent).toContain('unmeasured, which is not 0%');
    expect(none?.querySelector('[data-role=orrery-walk-cell]')).toBeNull();
  });

  it('gradeable:false says the sample is optimistic', async () => {
    stubFetch({ post: started, polls: [done(walkReport({ gradeable: false, untypedEdges: ['e2', 'e3'] }))] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    await flush(POLL);
    const note = container.querySelector('[data-walk-gradeable=false]');
    expect(note?.textContent).toContain('2 guards');
    expect(note?.textContent).toContain('optimistic');
  });

  it("a refused POST shows the server's reason, and Retry tries again", async () => {
    const fetchMock = stubFetch({ post: bad('Unauthorized: a valid operator token is required for this endpoint', 401), polls: [] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    const alert = container.querySelector('[data-role=orrery-walk] [role=alert]');
    expect(alert?.textContent).toContain('Walk failed: Unauthorized: a valid operator token is required');
    const posts = () => fetchMock.mock.calls.filter(([u, i]) => String(u) === '/api/story/walk' && i?.method === 'POST').length;
    expect(posts()).toBe(1);
    fireEvent.click([...alert!.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'))!);
    await flush();
    expect(posts()).toBe(2);
  });

  it("a failed job shows the job's error", async () => {
    stubFetch({ post: started, polls: [ok({ jobId: 'walk-1', state: 'failed', progress: { done: 3, total: 400 }, error: 'walker exploded' })] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    await flush(POLL);
    expect(container.querySelector('[data-role=orrery-walk] [role=alert]')?.textContent).toContain('Walk failed: walker exploded');
  });

  it('an evicted job (404) fails with the reason instead of polling forever', async () => {
    stubFetch({ post: started, polls: [bad('walk job walk-1 not found', 404)] });
    const { container, btn } = await mount();
    fireEvent.click(btn());
    await flush();
    await flush(POLL);
    expect(container.querySelector('[data-role=orrery-walk] [role=alert]')?.textContent).toContain('walk job walk-1 not found');
    const n = calls.length;
    await flush(POLL * 4);
    expect(calls.length).toBe(n);
  });

  it('unmount mid-poll: no further fetch and no leaked timer', async () => {
    stubFetch({ post: started, polls: [running(10), running(20), running(30)] });
    const { btn, unmount } = await mount();
    fireEvent.click(btn());
    await flush();
    await flush(POLL);
    const polled = calls.filter((c) => c.url.startsWith('/api/story/walk/')).length;
    expect(polled).toBe(1);
    unmount();
    const before = calls.length;
    await flush(POLL * 10);
    expect(calls.length).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  });
});
