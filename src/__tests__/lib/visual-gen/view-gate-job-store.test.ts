/* eslint-disable no-restricted-syntax -- the hex literals below are palette fixtures
   standing in for colours MEASURED off a render, not UI colours from the token set. */
import { describe, it, expect, vi } from 'vitest';
import {
  startViewGateJob,
  getViewGateJob,
  memberNames,
  kitPaletteOf,
  worstMemberVerdict,
} from '@/lib/visual-gen/view-gate-job-store';
import type { MeshViewsResult, MeshViewsSpec, RenderedView } from '@/lib/visual-gen/mesh-views';
import type { ViewCritiqueDeps, ViewGateResult } from '@/lib/visual-gen/view-critique';

const view = (index: number, palette?: string[]): RenderedView => ({
  index,
  yawDeg: index * 60,
  imagePath: `/views/v${index}.png`,
  palette,
});

const rendered = (views: RenderedView[]): MeshViewsResult => ({ ok: true, views, durationMs: 3 });

const gate = (verdict: ViewGateResult['verdict']): ViewGateResult => ({ verdict, views: [] });

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('memberNames', () => {
  it('names a member from its mesh filename when none was given', () => {
    expect(memberNames([{ meshPath: '/gen/props__crate.glb' }])).toEqual(['props__crate']);
  });

  it('keeps an explicit name over the derived one', () => {
    expect(memberNames([{ meshPath: '/gen/a.glb', name: 'crate' }])).toEqual(['crate']);
  });

  it('disambiguates members that would otherwise share a name', () => {
    // Two kit members generated into different directories collide on basename, and a
    // coherence report naming the same member twice cannot be acted on.
    const names = memberNames([
      { meshPath: '/gen/tripo/crate.glb' },
      { meshPath: '/gen/triposr/crate.glb' },
    ]);
    expect(names).toEqual(['crate', 'crate#2']);
  });
});

describe('kitPaletteOf', () => {
  it('takes the palette of the lowest-indexed view that measured one', () => {
    expect(kitPaletteOf([view(1), view(0, ['#aabbcc'])])).toEqual(['#aabbcc']);
  });

  it('is undefined — never [] — when no view measured a palette', () => {
    // An empty array would read as "measured, and there are no colours".
    expect(kitPaletteOf([view(0), view(1)])).toBeUndefined();
  });
});

describe('worstMemberVerdict', () => {
  it('ranks a seen defect above an unseen side', () => {
    expect(worstMemberVerdict(['pass', 'unmeasured', 'fail'])).toBe('fail');
  });

  it('ranks an unseen side above a corroborated-but-explained warn', () => {
    // The aggregate answers "can this ship unattended"; a side nobody looked at is
    // exactly the failure mode this gate exists for.
    expect(worstMemberVerdict(['warn', 'unmeasured'])).toBe('unmeasured');
  });

  it('passes only when every member passed', () => {
    expect(worstMemberVerdict(['pass', 'pass'])).toBe('pass');
  });

  it('is unmeasured when there is nothing to aggregate', () => {
    expect(worstMemberVerdict([])).toBe('unmeasured');
  });
});

describe('startViewGateJob', () => {
  it('renders then critiques each member and records both', async () => {
    const render = vi.fn(async (_s: MeshViewsSpec) => rendered([view(0, ['#112233']), view(1)]));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob({ members: [{ meshPath: '/gen/crate.glb' }] }, { render, critique });
    await settle();

    const job = getViewGateJob(id)!;
    expect(job.status).toBe('done');
    expect(job.members[0].name).toBe('crate');
    expect(job.members[0].render?.views).toHaveLength(2);
    expect(job.members[0].gate?.verdict).toBe('pass');
    expect(job.verdict).toBe('pass');
  });

  it('passes the member subject to the critique so wrong-shape is judgeable', async () => {
    const render = vi.fn(async (_s: MeshViewsSpec) => rendered([view(0)]));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    startViewGateJob(
      { members: [{ meshPath: '/gen/crate.glb', subject: 'a wooden crate' }] },
      { render, critique },
    );
    await settle();

    expect(critique.mock.calls[0][1]).toEqual({ subject: 'a wooden crate' });
  });

  it('records a failed render without inventing a gate verdict for it', async () => {
    const render = vi.fn(async (_s: MeshViewsSpec): Promise<MeshViewsResult> => ({ ok: false, error: 'Blender not found', views: [] }));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob({ members: [{ meshPath: '/gen/crate.glb' }] }, { render, critique });
    await settle();

    const job = getViewGateJob(id)!;
    expect(critique).not.toHaveBeenCalled();
    expect(job.members[0].gate).toBeUndefined();
    expect(job.members[0].error).toContain('Blender not found');
    // Nothing was looked at, so the job cannot report a pass.
    expect(job.verdict).toBe('unmeasured');
    expect(job.status).toBe('error');
  });

  it('keeps a member that failed alongside one that succeeded', async () => {
    const render = vi.fn(async (spec: MeshViewsSpec): Promise<MeshViewsResult> =>
      spec.meshPath.includes('bad')
        ? { ok: false, error: 'mesh not found', views: [] }
        : rendered([view(0, ['#445566'])]),
    );
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob(
      { members: [{ meshPath: '/gen/good.glb' }, { meshPath: '/gen/bad.glb' }] },
      { render, critique },
    );
    await settle();

    const job = getViewGateJob(id)!;
    expect(job.status).toBe('done');
    expect(job.members).toHaveLength(2);
    expect(job.members[1].error).toContain('mesh not found');
    // A member nobody could look at is an unseen side, not an absent one.
    expect(job.verdict).toBe('unmeasured');
  });

  it('grades kit coherence from the measured palettes when there are 2+ members', async () => {
    const render = vi.fn(async (spec: MeshViewsSpec): Promise<MeshViewsResult> =>
      rendered([view(0, spec.meshPath.includes('a.glb') ? ['#202020'] : ['#d0d0d0'])]),
    );
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob(
      { members: [{ meshPath: '/gen/a.glb' }, { meshPath: '/gen/b.glb' }] },
      { render, critique },
    );
    await settle();

    const job = getViewGateJob(id)!;
    expect(job.kit?.verdict).toBe('drifting');
    expect(job.kit?.advisory).toBe(true);
    expect(job.kit?.worstPair).toEqual(
      expect.objectContaining({ a: 'a', b: 'b' }),
    );
  });

  it('does not grade coherence for a single mesh', async () => {
    // Coherence is a relationship; a one-member "kit" grade would be noise.
    const render = vi.fn(async (_s: MeshViewsSpec) => rendered([view(0, ['#112233'])]));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob({ members: [{ meshPath: '/gen/crate.glb' }] }, { render, critique });
    await settle();

    expect(getViewGateJob(id)!.kit).toBeUndefined();
  });

  it('survives a thrown critique by recording it as unjudged, not as a pass', async () => {
    const render = vi.fn(async (_s: MeshViewsSpec) => rendered([view(0)]));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps): Promise<never> => {
      throw new Error('vision quota exhausted');
    });

    const id = startViewGateJob({ members: [{ meshPath: '/gen/crate.glb' }] }, { render, critique });
    await settle();

    const job = getViewGateJob(id)!;
    expect(job.members[0].gate).toBeUndefined();
    expect(job.members[0].error).toContain('vision quota exhausted');
    expect(job.verdict).toBe('unmeasured');
  });

  it('gives each member its own output directory under the job', async () => {
    const render = vi.fn(async (_s: MeshViewsSpec) => rendered([view(0)]));
    const critique = vi.fn(async (_v: RenderedView[], _d?: ViewCritiqueDeps) => gate('pass'));

    const id = startViewGateJob(
      { members: [{ meshPath: '/gen/a.glb' }, { meshPath: '/gen/b.glb' }], outDir: '/out' },
      { render, critique },
    );
    await settle();

    const dirs = render.mock.calls.map((c) => c[0].outDir);
    expect(dirs).toEqual([`/out/${id}/a`, `/out/${id}/b`]);
  });

  it('reports an unknown job as undefined rather than an empty one', () => {
    expect(getViewGateJob('nope')).toBeUndefined();
  });
});
