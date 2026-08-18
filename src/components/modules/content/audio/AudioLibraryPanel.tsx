'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Upload, RefreshCw, Loader2, Star, Search, X, AlertTriangle } from 'lucide-react';
import { tryApiFetch } from '@/lib/api-utils';
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineErrorRetry } from '@/components/modules/shared/InlineErrorRetry';
import { WaveformThumbnail } from './WaveformThumbnail';
import { AudioUsageMeter } from './AudioUsageMeter';
import { AudioImportStatus } from './AudioImportStatus';
import type { AudioImportResult } from '@/types/audio-import';
import type { AudioImportPreflight } from '@/lib/audio-import-status';

/** A pending destructive delete awaiting user confirmation. */
type PendingDelete =
  | { kind: 'asset'; id: string; label: string }
  | { kind: 'set'; id: string; label: string };

interface LibraryData {
  sets: AudioSet[];
  assets: AudioAsset[];
  usage: AudioUsageSummary | null;
  /** Server-resolved absolute AUDIO_DIR — the import CLI needs a real path, not `~/…`. */
  audioDir: string | null;
}

/** What `audio_import_runs` records, per set, plus the UE-side dependency check. */
interface ImportReality {
  bySet: Record<string, AudioImportResult>;
  preflight: AudioImportPreflight | null;
}

/** Defensive read of GET /api/audio/import-result — an unexpected shape must read
 *  as "nothing recorded" (never imported), never as a silent success. */
function parseImportReality(raw: unknown): ImportReality {
  const d = raw as { bySet?: unknown; preflight?: unknown } | null;
  const bySet = d && typeof d.bySet === 'object' && d.bySet !== null
    ? (d.bySet as Record<string, AudioImportResult>)
    : {};
  const pf = d && typeof d.preflight === 'object' && d.preflight !== null
    ? (d.preflight as AudioImportPreflight)
    : null;
  return { bySet, preflight: pf && typeof pf.ok === 'boolean' ? pf : null };
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return 'auto';
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

export function AudioLibraryPanel() {
  const [data, setData] = useState<LibraryData>({ sets: [], assets: [], usage: null, audioDir: null });
  const [reality, setReality] = useState<ImportReality>({ bySet: {}, preflight: null });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  /** The set whose import was refused, so the inline banner can offer a real retry. */
  const [failedImportSetId, setFailedImportSetId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>(DEFAULT_FILTER);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [failedDelete, setFailedDelete] = useState<PendingDelete | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [res, imp] = await Promise.all([
        tryApiFetch<LibraryData>('/api/audio-gen'),
        // The recorded reality of every past import. A failure here leaves the
        // map empty, which renders as "never imported" — the honest default.
        tryApiFetch<unknown>('/api/audio/import-result'),
      ]);
      if (res.ok) {
        setData({
          sets: res.data.sets, assets: res.data.assets,
          usage: res.data.usage ?? null,
          audioDir: typeof res.data.audioDir === 'string' ? res.data.audioDir : null,
        });
      } else logger.warn('library fetch failed', { err: res.error });
      if (imp.ok) setReality(parseImportReality(imp.data));
      else {
        logger.warn('import-result fetch failed', { err: imp.error });
        setReality({ bySet: {}, preflight: null });
      }
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
    setImportError(null);
    setFailedImportSetId(null);
    const refuse = (reason: string) => {
      setFailedImportSetId(set.id);
      setImportError(`Import not dispatched for "${set.name}": ${reason} Nothing was imported.`);
    };

    // Preflight BEFORE spawning the CLI. The dispatch drives a UE-side python
    // script this repo does not ship; without it the session burns and fails at
    // runtime with no explanation. A missing/unverifiable dependency is reported
    // here with its reason and the dispatch does NOT happen.
    const pf = await tryApiFetch<unknown>(`/api/audio/import-result?setName=${encodeURIComponent(set.name)}`);
    const preflight = pf.ok ? parseImportReality(pf.data).preflight : null;
    setReality((r) => ({ ...r, preflight: preflight ?? r.preflight }));
    if (!preflight) {
      refuse(`the UE dependency check could not run${pf.ok ? '' : ` (${pf.error})`}.`);
      return;
    }
    if (!preflight.ok) {
      refuse(preflight.reason);
      return;
    }

    // The CLI needs a real absolute path. `~/.pof/audio/…` was never expanded by
    // the PowerShell env-var assignment that carried it.
    const audioDir = data.audioDir;
    if (!audioDir) {
      refuse('the server did not report the audio directory, so clip paths cannot be made absolute.');
      return;
    }

    setImporting(set.id);
    const appOrigin = getAppOrigin();
    const task = TaskFactory.importAudioSet({
      setName: set.name,
      eventKey: set.eventKey,
      surface: set.surface,
      loop: set.loopable,
      assets: assets.map((a) => ({ filename: a.filename, srcAbsPath: relPathToAbs(audioDir, a.relPath) })),
    }, appOrigin, `Audio Import (${set.name})`);
    importCli.execute(task);
  }

  // Both deletes are irreversible, so they route through a styled confirm dialog
  // (never the blocking native `confirm`) and surface any failure inline instead
  // of throwing an unhandled rejection.
  async function runDelete(pending: PendingDelete) {
    setDeleteError(null);
    const query = pending.kind === 'asset' ? `assetId=${pending.id}` : `setId=${pending.id}`;
    const res = await tryApiFetch<{ deleted: string }>(`/api/audio-gen?${query}`, { method: 'DELETE' });
    if (res.ok) {
      setFailedDelete(null);
      refresh();
    } else {
      logger.warn('audio delete failed', { pending, err: res.error });
      setFailedDelete(pending);
      setDeleteError(`Could not delete ${pending.label}: ${res.error}`);
    }
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

        {/* The UE-side dependency the "Import to UE" button drives. Stated up front
            so a user does not discover it by watching a CLI session fail. */}
        {reality.preflight && !reality.preflight.ok && (
          <div
            data-testid="audio-import-preflight"
            className="mb-3 flex items-start gap-1.5 px-2.5 py-2 rounded border text-2xs"
            style={{ borderColor: `${STATUS_WARNING}4d`, backgroundColor: `${STATUS_WARNING}14`, color: STATUS_WARNING }}
          >
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden />
            <span>Import to UE is blocked: {reality.preflight.reason}</span>
          </div>
        )}

        {importError && (
          <div className="mb-3" data-testid="audio-import-error">
            <InlineErrorRetry
              message={importError}
              onRetry={() => {
                const g = groups.find((x) => x.set.id === failedImportSetId);
                setImportError(null);
                if (g) handleImport(g.set, g.assets);
              }}
              onDismiss={() => setImportError(null)}
              dense
            />
          </div>
        )}

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
                  {s.kind}{s.eventKey ? ` · ${s.eventKey}` : ''}{s.surface ? ` · ${s.surface}` : ''}
                  {s.loopable && (
                    // The flag now actually reaches the import dispatch
                    // (AUDIO_LOOP → USoundWave.looping); before it was decorative.
                    <span title="Imported as looping — sets USoundWave.looping on every wave">{' · loop'}</span>
                  )}
                </span>
                <span className="text-2xs text-text-muted">· {assets.length}</span>
                <button onClick={() => handleImport(s, assets)} disabled={importing === s.id}
                        data-testid="import-to-ue"
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium disabled:opacity-50 focus-ring"
                        style={{ backgroundColor: `${MODULE_COLORS.content}15`, color: MODULE_COLORS.content, border: `1px solid ${MODULE_COLORS.content}30` }}>
                  {importing === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Import to UE
                </button>
                <button onClick={() => setPendingDelete({ kind: 'set', id: s.id, label: `set "${s.name}"` })} className="text-text-muted hover:text-red-400 focus-ring rounded" title="Delete set" aria-label={`Delete set ${s.name}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* What the DB actually recorded about this set's last import —
                  absence is stated as "never imported", never as success. */}
              <AudioImportStatus record={reality.bySet[s.name] ?? null} />

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
                    <button onClick={() => setPendingDelete({ kind: 'asset', id: a.id, label: `variation "${a.filename}"` })} className="text-text-muted hover:text-red-400 focus-ring rounded flex-shrink-0" title="Delete variation" aria-label="Delete variation">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {deleteError && (
        <div className="px-3 pb-3">
          <InlineErrorRetry
            message={deleteError}
            onRetry={() => { setDeleteError(null); if (failedDelete) runDelete(failedDelete); }}
            onDismiss={() => setDeleteError(null)}
            dense
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) runDelete(pendingDelete); }}
        title={pendingDelete?.kind === 'set' ? 'Delete this set?' : 'Delete this variation?'}
        description={
          pendingDelete?.kind === 'set'
            ? `This permanently deletes ${pendingDelete?.label} and all its variations. This cannot be undone.`
            : `This permanently deletes ${pendingDelete?.label}. This cannot be undone.`
        }
        confirmLabel="Delete"
      />
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

/**
 * Resolve a relPath stored in the DB to an absolute path for the import CLI.
 *
 * `audioDir` is the server-resolved `AUDIO_DIR` (os.homedir()-expanded), handed
 * to the client by GET /api/audio-gen. The previous form passed a literal
 * `~/.pof/audio/<rel>`, which the dispatch dropped into a PowerShell env var —
 * `~` is NOT expanded there, so the path was unusable and the claim that the
 * (absent) script would expanduser it was unverifiable.
 */
function relPathToAbs(audioDir: string, relPath: string): string {
  const sep = audioDir.includes('\\') ? '\\' : '/';
  const base = audioDir.replace(/[\\/]+$/, '');
  return `${base}${sep}${relPath.split('/').join(sep)}`;
}
