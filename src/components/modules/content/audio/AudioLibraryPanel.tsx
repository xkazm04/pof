'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Upload, RefreshCw, Loader2, Star, Search, X } from 'lucide-react';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS, getAppOrigin } from '@/lib/constants';
import { STATUS_WARNING } from '@/lib/chart-colors';
import type { AudioAsset, AudioSet, AudioUsageSummary } from '@/types/audio-asset';
import {
  DEFAULT_FILTER,
  DURATION_BUCKETS,
  deriveFacets,
  filterAssets,
  isFilterActive,
  joinAssets,
  type LibraryFilter,
} from '@/lib/audio-library/filter';
import { WaveformThumbnail } from './WaveformThumbnail';
import { AudioUsageMeter } from './AudioUsageMeter';

interface LibraryData { sets: AudioSet[]; assets: AudioAsset[]; usage: AudioUsageSummary | null }

function fmtDuration(ms: number): string {
  if (ms <= 0) return 'auto';
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

export function AudioLibraryPanel() {
  const [data, setData] = useState<LibraryData>({ sets: [], assets: [], usage: null });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(DEFAULT_FILTER);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tryApiFetch<LibraryData>('/api/audio-gen');
      if (res.ok) setData({ sets: res.data.sets, assets: res.data.assets, usage: res.data.usage ?? null });
      else logger.warn('library fetch failed', { err: res.error });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const importCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-import',
    label: 'Audio Import',
    accentColor: MODULE_COLORS.content,
    onComplete: () => { setImporting(null); refresh(); },
  });

  const facets = useMemo(() => deriveFacets(data.sets), [data.sets]);

  // Faceted search → results grouped back under their set (preserving set order),
  // so per-set actions (Import to UE, delete set) stay available.
  const groups = useMemo(() => {
    const matched = filterAssets(joinAssets(data.sets, data.assets), filter);
    const bySet = new Map<string, AudioAsset[]>();
    for (const { asset } of matched) {
      const list = bySet.get(asset.setId) ?? [];
      list.push(asset);
      bySet.set(asset.setId, list);
    }
    return data.sets
      .map((set) => ({ set, assets: bySet.get(set.id) ?? [] }))
      .filter((g) => g.assets.length > 0);
  }, [data.sets, data.assets, filter]);

  const matchCount = useMemo(() => groups.reduce((n, g) => n + g.assets.length, 0), [groups]);
  const totalCount = data.assets.length;

  async function handleImport(set: AudioSet, assets: AudioAsset[]) {
    if (assets.length === 0) return;
    setImporting(set.id);
    const appOrigin = getAppOrigin();
    const task = TaskFactory.importAudioSet({
      setName: set.name,
      eventKey: set.eventKey,
      surface: set.surface,
      assets: assets.map((a) => ({ filename: a.filename, srcAbsPath: relPathToAbs(a.relPath) })),
    }, appOrigin, `Audio Import (${set.name})`);
    importCli.execute(task);
  }

  async function handleDeleteAsset(id: string) {
    await apiFetch<{ deleted: 'asset' }>(`/api/audio-gen?assetId=${id}`, { method: 'DELETE' });
    refresh();
  }
  async function handleDeleteSet(id: string) {
    if (!confirm('Delete this set and all its variations?')) return;
    await apiFetch<{ deleted: 'set' }>(`/api/audio-gen?setId=${id}`, { method: 'DELETE' });
    refresh();
  }

  async function handleToggleFavorite(asset: AudioAsset) {
    const next = !asset.favorite;
    // Optimistic — flip locally, reconcile from the server response.
    setData((d) => ({ ...d, assets: d.assets.map((a) => (a.id === asset.id ? { ...a, favorite: next } : a)) }));
    const res = await tryApiFetch<{ asset: AudioAsset }>('/api/audio-gen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset.id, favorite: next }),
    });
    if (!res.ok) {
      logger.warn('favorite toggle failed', { err: res.error });
      setData((d) => ({ ...d, assets: d.assets.map((a) => (a.id === asset.id ? { ...a, favorite: asset.favorite } : a)) }));
    }
  }

  const set = (patch: Partial<LibraryFilter>) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div className="flex h-full" data-testid="audio-library">
      {/* Faceted search sidebar */}
      <div className="w-64 border-r border-border bg-surface-deep flex-shrink-0 flex flex-col overflow-y-auto">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text">Library</h3>
          <button onClick={refresh} className="text-text-muted hover:text-text focus-ring rounded" title="Refresh" aria-label="Refresh library">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {data.usage && <AudioUsageMeter usage={data.usage} />}

          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
            <input
              type="search"
              value={filter.text}
              onChange={(e) => set({ text: e.target.value })}
              placeholder="Search prompts, files…"
              aria-label="Search audio library"
              data-testid="audio-search"
              className="w-full pl-7 pr-2 py-1.5 bg-surface border border-border rounded text-xs text-text placeholder-text-muted outline-none focus:border-border-bright"
            />
          </div>

          <Facet label="Kind">
            <FacetSelect value={filter.kind} onChange={(v) => set({ kind: v as LibraryFilter['kind'] })}
                         options={[['all', 'All kinds'], ...facets.kinds.map((k) => [k, k] as [string, string])]} testId="facet-kind" />
          </Facet>

          <Facet label="Surface">
            <FacetSelect value={filter.surface} onChange={(v) => set({ surface: v })}
                         options={[['all', 'All surfaces'], ...facets.surfaces.map((s) => [s, s] as [string, string])]} testId="facet-surface" />
          </Facet>

          <Facet label="Event key">
            <FacetSelect value={filter.eventKey} onChange={(v) => set({ eventKey: v })}
                         options={[['all', 'All events'], ...facets.eventKeys.map((e) => [e, e] as [string, string])]} testId="facet-event" />
          </Facet>

          <Facet label="Duration">
            <FacetSelect value={filter.duration} onChange={(v) => set({ duration: v })}
                         options={[['all', 'Any length'], ...DURATION_BUCKETS.map((b) => [b.id, b.label] as [string, string])]} testId="facet-duration" />
          </Facet>

          <button
            onClick={() => set({ favoritesOnly: !filter.favoritesOnly })}
            aria-pressed={filter.favoritesOnly}
            data-testid="facet-favorites"
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs border transition-colors ${
              filter.favoritesOnly
                ? 'border-transparent text-text'
                : 'border-border text-text-muted hover:bg-surface'
            }`}
            style={filter.favoritesOnly ? { backgroundColor: `${STATUS_WARNING}26`, borderColor: `${STATUS_WARNING}4d` } : undefined}
          >
            <Star className="w-3 h-3" style={{ color: STATUS_WARNING, fill: filter.favoritesOnly ? STATUS_WARNING : 'none' }} />
            Favorites only
          </button>

          {isFilterActive(filter) && (
            <button onClick={() => setFilter(DEFAULT_FILTER)} data-testid="facet-clear"
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-2xs text-text-muted hover:text-text border border-border hover:bg-surface">
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-text">Variations</h2>
          <span className="text-2xs text-text-muted" data-testid="audio-result-count">
            {isFilterActive(filter) ? `${matchCount} of ${totalCount}` : `${totalCount}`} variation{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        {loading && <div className="text-2xs text-text-muted">Loading…</div>}

        {!loading && totalCount === 0 && (
          <div className="text-xs text-text-muted">No audio yet. Generate variations in the Sound Forge tab.</div>
        )}

        {!loading && totalCount > 0 && groups.length === 0 && (
          <div className="text-xs text-text-muted" data-testid="audio-no-matches">
            No variations match these filters.{' '}
            <button onClick={() => setFilter(DEFAULT_FILTER)} className="underline hover:text-text">Clear</button>
          </div>
        )}

        <div className="space-y-4">
          {groups.map(({ set: s, assets }) => (
            <div key={s.id} data-testid={`set-${s.name}`} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-deep border-b border-border">
                <span className="text-xs font-semibold text-text truncate">{s.name}</span>
                <span className="text-2xs text-text-muted truncate">
                  {s.kind}{s.eventKey ? ` · ${s.eventKey}` : ''}{s.surface ? ` · ${s.surface}` : ''}{s.loopable ? ' · loop' : ''}
                </span>
                <span className="text-2xs text-text-muted">· {assets.length}</span>
                <button onClick={() => handleImport(s, assets)} disabled={importing === s.id}
                        data-testid="import-to-ue"
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium disabled:opacity-50 focus-ring"
                        style={{ backgroundColor: `${MODULE_COLORS.content}15`, color: MODULE_COLORS.content, border: `1px solid ${MODULE_COLORS.content}30` }}>
                  {importing === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Import to UE
                </button>
                <button onClick={() => handleDeleteSet(s.id)} className="text-text-muted hover:text-red-400 focus-ring rounded" title="Delete set" aria-label={`Delete set ${s.name}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-border">
                {assets.map((a) => (
                  <div key={a.id} data-testid={`asset-${a.id}`} className="flex items-center gap-3 px-3 py-2">
                    <button
                      onClick={() => handleToggleFavorite(a)}
                      aria-pressed={a.favorite}
                      aria-label={a.favorite ? 'Unstar variation' : 'Star variation'}
                      data-testid={`favorite-${a.id}`}
                      className="text-text-muted hover:text-text focus-ring rounded flex-shrink-0"
                    >
                      <Star className="w-4 h-4" style={{ color: a.favorite ? STATUS_WARNING : undefined, fill: a.favorite ? STATUS_WARNING : 'none' }} />
                    </button>
                    <WaveformThumbnail seed={a.promptHash ?? a.id} color={MODULE_COLORS.content} className="flex-shrink-0 rounded" />
                    <div className="min-w-0 w-36">
                      <div className="text-2xs text-text truncate">{a.filename}</div>
                      <div className="text-2xs text-text-muted tabular-nums">{fmtDuration(a.durationMs)}</div>
                    </div>
                    <audio controls src={`/api/audio-asset?relPath=${encodeURIComponent(a.relPath)}`} className="flex-1 h-7 min-w-0" />
                    <button onClick={() => handleDeleteAsset(a.id)} className="text-text-muted hover:text-red-400 focus-ring rounded flex-shrink-0" title="Delete variation" aria-label="Delete variation">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-2xs uppercase tracking-wider text-text-muted mb-1 font-semibold">{label}</label>
      {children}
    </div>
  );
}

function FacetSelect({ value, onChange, options, testId }: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  testId: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
            className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:border-border-bright outline-none">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/** Resolve a relPath stored in the DB to an absolute path for the import CLI. */
function relPathToAbs(relPath: string): string {
  // Server-side AUDIO_DIR isn't importable in this client component; pass a
  // tilde-prefixed path the import CLI/script can expand via os.path.expanduser.
  return `~/.pof/audio/${relPath}`;
}
