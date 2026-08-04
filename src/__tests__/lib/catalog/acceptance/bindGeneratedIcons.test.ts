import { describe, it, expect } from 'vitest';
import { bindGeneratedIcon, ICON_BINDING_KEY } from '@/lib/catalog/acceptance/bindGeneratedIcons';
import { bindIconsAll, type BindIconsDeps } from '@/lib/catalog/acceptance/bindIconsAll';
import { gallerySeed, gradeGallerySelection } from '@/lib/catalog/acceptance/galleryArtifact';
import { readHistory, selectedCandidate } from '@/components/layout-lab/steps/shared/genHistory';

const AT = '2026-08-04T00:00:00.000Z';
const URL = '/api/visual-gen/icon/items_Icon_2D_Art.jpg';

describe('bindGeneratedIcon', () => {
  it('binds library art onto the selected swatch candidate and flips the grade', () => {
    const data = gallerySeed('selected', 4);
    // Precondition: the produce stub grades deferred precisely because the selection is a swatch.
    expect(gradeGallerySelection(data, 'selected', 'Icon 2D Art').status).toBe('deferred');

    const out = bindGeneratedIcon(data, URL, AT);
    if ('skipped' in out) throw new Error(`expected a binding, got skip: ${out.skipped}`);

    expect(selectedCandidate(readHistory(out.data))?.imageUrl).toBe(URL);
    expect(out.data[ICON_BINDING_KEY]).toEqual({ candidateId: out.binding.candidateId, url: URL, boundAt: AT, source: 'generated/icons' });
    expect(gradeGallerySelection(out.data, 'selected', 'Icon 2D Art').status).toBe('pass');
  });

  it('does not mutate the input artifact data', () => {
    const data = gallerySeed('selected', 3);
    const before = JSON.stringify(data);
    bindGeneratedIcon(data, URL, AT);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('binds ONLY the selected candidate — the others stay honest swatches', () => {
    const data = gallerySeed('selected', 4);
    const out = bindGeneratedIcon(data, URL, AT);
    if ('skipped' in out) throw new Error('expected a binding');
    const withImage = readHistory(out.data).batches.flatMap((b) => b.candidates).filter((c) => c.imageUrl);
    expect(withImage).toHaveLength(1);
  });

  it('refuses to invent a batch: no generation history → skipped, grade unchanged', () => {
    const out = bindGeneratedIcon({ selected: 0 }, URL, AT);
    expect(out).toEqual({ skipped: 'no-history' });
  });

  it('leaves a candidate that already carries a real asset untouched', () => {
    const data = gallerySeed('selected', 2);
    const bound = bindGeneratedIcon(data, URL, AT);
    if ('skipped' in bound) throw new Error('expected a binding');
    expect(bindGeneratedIcon(bound.data, '/api/visual-gen/icon/other.jpg', AT)).toEqual({ skipped: 'already-real' });
  });
});

describe('bindIconsAll', () => {
  const artifact = (step: string, status: string, data: Record<string, unknown>) => ({
    catalogId: 'items', entityId: 'item-1', step, status, data,
  });

  function deps(over: Partial<BindIconsDeps> = {}): BindIconsDeps & { saved: unknown[] } {
    const saved: unknown[] = [];
    return {
      saved,
      listArtifacts: () => [artifact('Icon 2D Art', 'deferred', gallerySeed('selected', 4))],
      iconUrlFor: () => URL,
      grade: (_c, step, data) => gradeGallerySelection(data, 'selected', step),
      save: (catalogId, entityId, step, data, res) => { saved.push({ catalogId, entityId, step, data, res }); },
      now: () => AT,
      ...over,
    };
  }

  it('binds, re-grades and persists — reporting the move', () => {
    const d = deps();
    const s = bindIconsAll({}, d);
    expect(s).toMatchObject({ examined: 1, bound: 1, changed: 1 });
    expect(s.results[0]).toMatchObject({ step: 'Icon 2D Art', from: 'deferred', to: 'pass', changed: true, detail: URL });
    expect(d.saved).toHaveLength(1);
  });

  it('apply:false is a dry run — nothing is written', () => {
    const d = deps();
    expect(bindIconsAll({}, d, { apply: false }).changed).toBe(1);
    expect(d.saved).toHaveLength(0);
  });

  it('skips a step the library has no art for — it can never borrow a sibling’s image', () => {
    const d = deps({ iconUrlFor: () => null });
    const s = bindIconsAll({}, d);
    expect(s).toMatchObject({ examined: 0, bound: 0, changed: 0, skipped: 1 });
    expect(d.saved).toHaveLength(0);
  });

  it('never writes when the step has no server checker to re-grade with', () => {
    const d = deps({ grade: () => null });
    const s = bindIconsAll({}, d);
    expect(s).toMatchObject({ bound: 0, changed: 0, skipped: 1 });
    expect(d.saved).toHaveLength(0);
  });

  it('is idempotent — a second pass binds nothing', () => {
    const bound = bindGeneratedIcon(gallerySeed('selected', 4), URL, AT);
    if ('skipped' in bound) throw new Error('expected a binding');
    const d = deps({ listArtifacts: () => [artifact('Icon 2D Art', 'pass', bound.data)] });
    const s = bindIconsAll({}, d);
    expect(s).toMatchObject({ bound: 0, changed: 0, skipped: 1 });
    expect(d.saved).toHaveLength(0);
  });
});
