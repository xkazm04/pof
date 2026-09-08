import { describe, it, expect } from 'vitest';
import { startStyleDnaJob, getStyleDnaJob } from '@/lib/visual-gen/style-dna-job-store';
import type { StyleDna } from '@/lib/visual-gen/style-dna';

/**
 * Distilling a mood board is N vision calls in series. With the local eye that is minutes,
 * and since 2026-09-08 it sits behind a 15-minute ceiling — so the panel cannot await it.
 * This is the job rail `view-gate` already runs on, applied to style-dna.
 */

const DNA: StyleDna = {
  palette: ['ash grey', 'ember orange'],
  materials: ['pitted steel'],
  mood: ['grim'],
  render: ['painterly'],
  motifs: ['broken arches'],
};

const img = [{ base64: 'AAA', mime: 'image/png' }];

/** Resolve on demand, so a test can assert the job id arrives BEFORE the work finishes. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('style-dna job store — the panel gets an id, not a wait', () => {
  it('returns a job id immediately, while the distiller is still running', async () => {
    const gate = deferred<{ ok: true; dna: StyleDna; raw: string }>();
    const id = startStyleDnaJob(
      { images: img, name: 'Ashen' },
      { distil: () => gate.promise, save: () => ({ id: 'p1', name: 'Ashen', active: true }) as never },
    );
    expect(id).toMatch(/^styledna-/);
    expect(getStyleDnaJob(id)?.status).toBe('running');
    gate.resolve({ ok: true, dna: DNA, raw: 'RAW' });
    await gate.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(getStyleDnaJob(id)?.status).toBe('done');
  });

  it('carries the saved profile on the finished job', async () => {
    const id = startStyleDnaJob(
      { images: img, name: 'Ashen' },
      {
        distil: async () => ({ ok: true, dna: DNA, raw: 'RAW' }),
        save: (spec) => ({ id: 'p2', name: spec.name, active: true, sourceImageCount: spec.sourceImageCount }) as never,
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    const job = getStyleDnaJob(id);
    expect(job?.status).toBe('done');
    expect(job?.profile).toMatchObject({ id: 'p2', name: 'Ashen' });
  });

  it('records the REASON when the distiller fails — never a silently empty profile', async () => {
    let saved = false;
    const id = startStyleDnaJob(
      { images: img },
      { distil: async () => ({ ok: false, error: 'every eye refused the board' }), save: () => { saved = true; return {} as never; } },
    );
    await new Promise((r) => setTimeout(r, 0));
    const job = getStyleDnaJob(id);
    expect(job?.status).toBe('error');
    expect(job?.error).toMatch(/every eye refused the board/);
    expect(job?.profile).toBeUndefined();
    // The saved half must not happen on a failed distil — a profile with no DNA behind it
    // would be injected into every later generation prompt as if it meant something.
    expect(saved).toBe(false);
  });

  it('records a THROWN distiller as an error rather than leaving the job running forever', async () => {
    const id = startStyleDnaJob(
      { images: img },
      { distil: async () => { throw new Error('daemon died mid-board'); }, save: () => ({}) as never },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(getStyleDnaJob(id)?.status).toBe('error');
    expect(getStyleDnaJob(id)?.error).toMatch(/daemon died mid-board/);
  });

  it('reports an unknown job id as missing rather than inventing one', () => {
    expect(getStyleDnaJob('styledna-nope')).toBeUndefined();
  });
});
