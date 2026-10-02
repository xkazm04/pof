'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Wand2, MapPin, Volume2, Loader2,
  AlertCircle, CheckCircle2, Radio,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  STATUS_SUCCESS,
  withOpacity, OPACITY_10, OPACITY_20, OPACITY_30, OPACITY_50,
} from '@/lib/chart-colors';
import { tryApiFetch } from '@/lib/api-utils';
import type { LevelDocItem, GenerateResult, SyncPreview, SpatialAudioGeneratorPanelProps } from './types';
import { RoomReportItem } from './RoomReportItem';
import { SyncPlanPreview, syncSummaryLine } from './SyncPlanPreview';

const SYNC_URL = '/api/spatial-audio-generate';
const NO_OVERWRITE: ReadonlySet<string> = new Set();
const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export function SpatialAudioGeneratorPanel({
  activeDoc,
  accentColor,
  onSceneCreated,
}: SpatialAudioGeneratorPanelProps) {
  const ACCENT = accentColor;

  const [levelDocs, setLevelDocs] = useState<LevelDocItem[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [syncIntoActive, setSyncIntoActive] = useState(false);
  const targetSceneId = syncIntoActive && activeDoc ? activeDoc.id : null;

  const [overwrite, setOverwrite] = useState<ReadonlySet<string>>(NO_OVERWRITE);
  const [planEpoch, setPlanEpoch] = useState(0);
  // The last settled preview and the request it answered: a preview is
  // "planning" while the current request is not the one it answered.
  const [settled, setSettled] = useState<{ key: string; preview: SyncPreview | null }>({ key: '', preview: null });

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  // A different source level or target scene starts from a clean overwrite choice.
  const planKey = `${selectedLevelId}:${targetSceneId}`;
  const [lastPlanKey, setLastPlanKey] = useState(planKey);
  if (planKey !== lastPlanKey) {
    setLastPlanKey(planKey);
    setOverwrite(NO_OVERWRITE);
  }

  // Load available level design docs
  useEffect(() => {
    let cancelled = false;
    tryApiFetch<LevelDocItem[]>(SYNC_URL, post({ action: 'list-levels' }))
      .then((r) => {
        if (cancelled || !r.ok) return;
        setLevelDocs(r.data);
        if (r.data.length === 1) setSelectedLevelId(r.data[0].id);
      })
      .finally(() => { if (!cancelled) setLoadingLevels(false); });
    return () => { cancelled = true; };
  }, []);

  // The plan is shown BEFORE anything is written: re-planned whenever the
  // source, the target or the overwrite choice changes, and after an apply.
  const requestKey = `${planKey}:${[...overwrite].join(',')}:${planEpoch}`;
  useEffect(() => {
    if (!selectedLevelId) return;
    let cancelled = false;
    tryApiFetch<SyncPreview>(SYNC_URL, post({
      action: 'preview',
      levelDocId: selectedLevelId,
      audioSceneId: targetSceneId ?? undefined,
      overwrite: [...overwrite],
    }))
      .then((r) => {
        if (cancelled) return;
        setSettled({ key: requestKey, preview: r.ok ? r.data : null });
        setError(r.ok ? null : r.error);
      });
    return () => { cancelled = true; };
  }, [selectedLevelId, targetSceneId, overwrite, requestKey]);
  const preview = settled.preview;
  const previewing = selectedLevelId !== null && settled.key !== requestKey;

  const toggleOverwrite = useCallback((roomId: string) => {
    setOverwrite((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (!selectedLevelId) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    const r = await tryApiFetch<GenerateResult>(SYNC_URL, post({
      action: 'generate',
      levelDocId: selectedLevelId,
      audioSceneId: targetSceneId ?? undefined,
      overwrite: [...overwrite],
    }));
    setGenerating(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(r.data);
    setOverwrite(NO_OVERWRITE);
    setPlanEpoch((n) => n + 1);
    onSceneCreated();
  }, [selectedLevelId, targetSceneId, overwrite, onSceneCreated]);

  const opCount = preview?.ops.length ?? 0;
  const nothingToApply = targetSceneId !== null && opCount === 0;
  // Keep the plan on screen while an overwrite toggle re-plans, never another level's plan.
  const visiblePreview = selectedLevelId && settled.key.startsWith(`${planKey}:`) ? preview : null;

  return (
    <div className="p-6 space-y-6 overflow-y-auto bg-surface-deep rounded-2xl border border-border relative w-full h-full">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: withOpacity(ACCENT, OPACITY_10), border: `1px solid ${withOpacity(ACCENT, OPACITY_20)}` }}
          >
            <Wand2 className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">Auto-Generate Spatial Audio</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Turn level geometry into acoustic zones and emitters
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-text-muted leading-relaxed">
        Analyze room geometry, types, pacing, and encounter descriptions from a level design document
        to automatically generate spatial audio zones and contextual sound emitters.
      </p>

      {/* Level picker */}
      <SurfaceCard className="overflow-hidden">
        <div className="px-4 py-3 bg-surface border-b border-border flex items-center gap-2">
          <Radio className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">Source level</span>
        </div>

        <div className="p-4 space-y-4">
          {loadingLevels ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading level documents…
            </div>
          ) : levelDocs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted py-6 bg-surface-deep border border-dashed border-border rounded-lg">
              <AlertCircle className="w-4 h-4" />
              No level design documents found
            </div>
          ) : (
            <div className="grid gap-2">
              {levelDocs.map((doc) => {
                const isSelected = selectedLevelId === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedLevelId(doc.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-xs transition-all border relative overflow-hidden group ${
                      isSelected ? '' : 'border-border bg-surface-deep hover:bg-surface-hover'
                    }`}
                    style={isSelected
                      ? { borderColor: withOpacity(ACCENT, OPACITY_50), backgroundColor: withOpacity(ACCENT, OPACITY_10) }
                      : undefined}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: ACCENT }} />
                    )}
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4" style={{ color: isSelected ? ACCENT : 'var(--text-muted)' }} />
                        <span className={`font-semibold ${isSelected ? 'text-text' : 'text-text-muted'}`}>
                          {doc.name}
                        </span>
                      </div>
                      <span className="text-2xs font-mono text-text-muted">
                        {doc.roomCount} zones · {doc.connectionCount} links
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Merge toggle */}
          {activeDoc && selectedLevelId && (
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-deep cursor-pointer hover:bg-surface-hover transition-colors mt-2">
              <input
                type="checkbox"
                checked={syncIntoActive}
                onChange={(e) => setSyncIntoActive(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-deep focus-ring outline-none"
                style={{ accentColor: ACCENT }}
              />
              <span className="text-xs text-text-muted flex-1">
                Sync into active scene: <span className="text-text font-semibold">&quot;{activeDoc.name}&quot;</span>
                <span className="block text-2xs mt-0.5">Adds new rooms, follows level edits, keeps hand-tuned zones. Nothing is written until you apply.</span>
              </span>
            </label>
          )}
        </div>
      </SurfaceCard>

      {/* Plan preview: what applying would write */}
      {visiblePreview && (
        <SurfaceCard className="p-4">
          <SyncPlanPreview preview={visiblePreview} overwrite={overwrite} onToggleOverwrite={toggleOverwrite} />
        </SurfaceCard>
      )}

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={!selectedLevelId || !visiblePreview || previewing || generating || nothingToApply || levelDocs.length === 0}
        className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 group outline-none"
        style={{
          backgroundColor: withOpacity(ACCENT, OPACITY_10),
          color: ACCENT,
          border: `1px solid ${withOpacity(ACCENT, OPACITY_50)}`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

        {generating || previewing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {generating ? 'Applying sync…' : 'Planning sync…'}
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            {nothingToApply
              ? 'Scene is in sync — nothing to apply'
              : targetSceneId !== null
                ? `Apply ${opCount} change${opCount === 1 ? '' : 's'} to "${activeDoc?.name}"`
                : 'Create audio scene from level'}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 text-xs rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Sync failed: {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
            className="space-y-4 pt-4 border-t border-border"
          >
            {/* Summary bar */}
            <div
              className="px-4 py-3 rounded-xl flex items-center gap-4 border"
              style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_10), borderColor: withOpacity(STATUS_SUCCESS, OPACITY_30) }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_20), borderColor: withOpacity(STATUS_SUCCESS, OPACITY_30) }}
              >
                <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_SUCCESS }} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-text">
                  {result.merged ? 'Sync applied' : 'Scene created'}: {result.audioScene?.name}
                </p>
                <p className="text-2xs font-mono text-text-muted mt-1">
                  {syncSummaryLine(result)} · {result.audioScene?.zones.length} zones · {result.audioScene?.emitters.length} emitters · Reverb: {result.audioScene?.globalReverbPreset}
                </p>
              </div>
            </div>

            {/* Per-room report */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <h4 className="text-xs font-semibold text-text">Per-room report</h4>
              </div>
              <div className="space-y-2">
                {result.report.map((room) => {
                  const isExpanded = expandedRoom === room.roomId;
                  return (
                    <RoomReportItem
                      key={room.roomId}
                      room={room}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedRoom(isExpanded ? null : room.roomId)}
                      prefersReduced={prefersReduced}
                      accent={ACCENT}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
