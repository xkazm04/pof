'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Upload, RefreshCw, Loader2 } from 'lucide-react';
import { apiFetch, tryApiFetch } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { useModuleCLI } from '@/hooks/useModuleCLI';
import { TaskFactory } from '@/lib/cli-task';
import { MODULE_COLORS, getAppOrigin } from '@/lib/constants';
import type { AudioAsset, AudioSet } from '@/types/audio-asset';

interface LibraryData { sets: AudioSet[]; assets: AudioAsset[] }

export function AudioLibraryPanel() {
  const [data, setData] = useState<LibraryData>({ sets: [], assets: [] });
  const [loading, setLoading] = useState(true);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await tryApiFetch<LibraryData>('/api/audio-gen');
    if (res.ok) setData(res.data);
    else logger.warn('library fetch failed', { err: res.error });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const importCli = useModuleCLI({
    moduleId: 'audio',
    sessionKey: 'audio-import',
    label: 'Audio Import',
    accentColor: MODULE_COLORS.content,
    onComplete: () => { setImporting(null); refresh(); },
  });

  async function handleImport(set: AudioSet) {
    const assets = data.assets.filter((a) => a.setId === set.id);
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
    if (selectedSetId === id) setSelectedSetId(null);
    refresh();
  }

  const selectedSet = data.sets.find((s) => s.id === selectedSetId) ?? null;
  const selectedAssets = data.assets.filter((a) => a.setId === selectedSetId);

  return (
    <div className="flex h-full" data-testid="audio-library">
      <div className="w-60 border-r border-border bg-surface-deep flex-shrink-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text">Sets ({data.sets.length})</h3>
          <button onClick={refresh} className="text-text-muted hover:text-text" title="Refresh">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {loading && <div className="p-3 text-2xs text-text-muted">Loading…</div>}
          {!loading && data.sets.length === 0 && (
            <div className="p-3 text-2xs text-text-muted">No sets yet. Generate one in the Sound Forge tab.</div>
          )}
          {data.sets.map((s) => {
            const count = data.assets.filter((a) => a.setId === s.id).length;
            const active = s.id === selectedSetId;
            return (
              <button key={s.id} onClick={() => setSelectedSetId(s.id)}
                      data-testid={`set-${s.name}`}
                      className={`w-full text-left px-3 py-2 text-xs border-b border-border ${active ? 'bg-surface-hover text-text' : 'text-text-muted hover:bg-surface'}`}>
                <div className="truncate">{s.name}</div>
                <div className="text-2xs text-text-muted">{s.kind} · {count} variation(s){s.surface ? ` · ${s.surface}` : ''}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {!selectedSet ? (
          <div className="text-xs text-text-muted">Select a set to preview + manage variations.</div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-text">{selectedSet.name}</h2>
              <span className="text-2xs text-text-muted">{selectedSet.kind}{selectedSet.eventKey ? ` · ${selectedSet.eventKey}` : ''}{selectedSet.surface ? ` · ${selectedSet.surface}` : ''}{selectedSet.loopable ? ' · loopable' : ''}</span>
              <button onClick={() => handleImport(selectedSet)} disabled={selectedAssets.length === 0 || importing === selectedSet.id}
                      data-testid="import-to-ue"
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
                      style={{ backgroundColor: `${MODULE_COLORS.content}15`, color: MODULE_COLORS.content, border: `1px solid ${MODULE_COLORS.content}30` }}>
                {importing === selectedSet.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Import to UE
              </button>
              <button onClick={() => handleDeleteSet(selectedSet.id)} className="text-text-muted hover:text-red-400" title="Delete set">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {selectedAssets.map((a) => (
                <div key={a.id} data-testid={`asset-${a.id}`} className="flex items-center gap-3 p-2 rounded bg-surface-deep border border-border">
                  <span className="text-2xs text-text-muted truncate w-40">{a.filename}</span>
                  <audio controls src={`/api/audio-asset?relPath=${encodeURIComponent(a.relPath)}`} className="flex-1 h-7" />
                  <button onClick={() => handleDeleteAsset(a.id)} className="text-text-muted hover:text-red-400" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {selectedAssets.length === 0 && (
                <div className="text-2xs text-text-muted">No variations in this set.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Resolve a relPath stored in the DB to an absolute path for the import CLI. */
function relPathToAbs(relPath: string): string {
  // Server-side AUDIO_DIR isn't importable in this client component; pass a
  // tilde-prefixed path the import CLI/script can expand via os.path.expanduser.
  return `~/.pof/audio/${relPath}`;
}
