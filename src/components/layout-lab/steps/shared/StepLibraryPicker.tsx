'use client';

import { useCallback, useState } from 'react';
import { tryApiFetch } from '@/lib/api-utils';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { LabInput } from '../controls';
import type { LibraryAsset, AssetCategory } from '@/types/asset-library';
import type { LabTheme } from '../../theme';

const CATEGORIES: readonly (AssetCategory | 'all')[] = ['all', 'hdris', 'textures', 'models', 'materials'];

/**
 * Browse the project's own asset library from inside a pipeline step, and reference what it
 * already has.
 *
 * The library (`asset_library` — every asset downloaded through the Asset Browser, with its
 * source, license and tags) existed but was unreachable from a step, so steps described
 * assets in prose and the operator went hunting afterwards. Picking here does NOT touch
 * acceptance: it appends a reference to the produce direction, which is a produce INPUT.
 *
 * It deliberately shows the library's real size and says so when it is empty. PoF has
 * whatever the user has actually downloaded — not a bundled catalogue — and a picker that
 * implied otherwise would be a worse lie than having no picker at all.
 */
export function StepLibraryPicker({ t, referencedIds, onPick, onUnpick }: {
  t: LabTheme;
  /** Library ids already referenced, so a picked asset reads as picked. */
  referencedIds: readonly string[];
  onPick: (asset: LibraryAsset) => void;
  onUnpick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');

  const load = useCallback(async (query: string, cat: AssetCategory | 'all') => {
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (cat !== 'all') params.set('category', cat);
    const res = await tryApiFetch<LibraryAsset[]>(`/api/visual-gen/library?${params}`);
    if (res.ok) setAssets(res.data);
    else { setAssets(null); setError(res.error); }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && assets === null) void load(q, category);
  }

  function search(nextQ: string, nextCat: AssetCategory | 'all') {
    setQ(nextQ);
    setCategory(nextCat);
    void load(nextQ, nextCat);
  }

  return (
    <div data-testid="step-library" style={{ display: 'grid', gap: 8 }}>
      <button
        type="button" onClick={toggle} aria-expanded={open} data-testid="step-library-toggle"
        className={`focus-ring ${t.fontMono}`}
        style={{
          justifySelf: 'start', fontSize: 13, padding: '5px 10px', cursor: 'pointer', color: t.text,
          border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, background: 'transparent',
        }}
      >
        {open ? '▴' : '▾'} Reference an asset you already have
        {assets ? ` · ${assets.length}` : ''}
      </button>

      {open && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <LabInput t={t} value={q} onChange={(v) => search(v, category)} placeholder="Search the library…" />
            </div>
            <select
              value={category}
              onChange={(e) => search(q, e.target.value as AssetCategory | 'all')}
              aria-label="Filter by asset category"
              data-testid="step-library-category"
              className={`focus-ring ${t.fontMono}`}
              style={{ fontSize: 13, padding: '5px 8px', color: t.text, background: 'transparent', border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0 }}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && <InlineErrorRetry dense message={`Couldn’t read the asset library: ${error}`} onRetry={() => void load(q, category)} />}

          {assets?.length === 0 && (
            <span data-testid="step-library-empty" className={t.fontMono} style={{ fontSize: 13, color: t.muted, lineHeight: 1.5 }}>
              {q.trim() || category !== 'all'
                ? 'No library asset matches that filter.'
                : 'Your asset library is empty — download assets through the Asset Browser and they become referenceable here.'}
            </span>
          )}

          {assets?.map((a) => {
            const picked = referencedIds.includes(a.id);
            return (
              <div
                key={a.id} data-testid="step-library-row" data-asset={a.id} data-picked={String(picked)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '6px 8px', border: `1px solid ${picked ? t.ok : t.line}`, borderRadius: t.glass ? 6 : 0,
                }}
              >
                <span style={{ fontSize: 13, color: t.inkDeep, fontWeight: 600 }}>{a.name}</span>
                <span className={t.fontMono} style={{ fontSize: 12, color: t.muted }}>{a.source} · {a.category}</span>
                {/* License is shown on the ROW, not only in the prompt — the operator
                    should see what they are committing the step to before picking. */}
                <span data-testid="step-library-license" className={t.fontMono}
                  style={{ fontSize: 12, color: a.license.trim() ? t.muted : t.warn }}>
                  {a.license.trim() || 'license not recorded'}
                </span>
                <button
                  type="button"
                  onClick={() => (picked ? onUnpick(a.id) : onPick(a))}
                  data-testid={picked ? 'step-library-unpick' : 'step-library-pick'}
                  aria-label={`${picked ? 'Remove' : 'Reference'} ${a.name}`}
                  className={`focus-ring ${t.fontMono}`}
                  style={{
                    marginLeft: 'auto', fontSize: 13, padding: '3px 10px', cursor: 'pointer', color: t.text,
                    border: `1px solid ${t.line}`, borderRadius: t.glass ? 6 : 0, background: 'transparent',
                  }}
                >
                  {picked ? '✓ referenced' : '+ reference'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
