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
import type { LevelDocItem, GenerateResult, SpatialAudioGeneratorPanelProps } from './types';
import { RoomReportItem } from './RoomReportItem';

export function SpatialAudioGeneratorPanel({
  activeDoc,
  accentColor,
  onSceneCreated,
}: SpatialAudioGeneratorPanelProps) {
  const ACCENT = accentColor;

  const [levelDocs, setLevelDocs] = useState<LevelDocItem[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [mergeIntoActive, setMergeIntoActive] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  // Load available level design docs
  useEffect(() => {
    let cancelled = false;
    setLoadingLevels(true);
    fetch('/api/spatial-audio-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-levels' }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) {
          setLevelDocs(json.data);
          if (json.data.length === 1) setSelectedLevelId(json.data[0].id);
        }
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setLoadingLevels(false); });
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedLevelId) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/spatial-audio-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          levelDocId: selectedLevelId,
          audioSceneId: mergeIntoActive && activeDoc ? activeDoc.id : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Generation failed');
        return;
      }
      setResult(json.data);
      onSceneCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  }, [selectedLevelId, mergeIntoActive, activeDoc, onSceneCreated]);

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
                checked={mergeIntoActive}
                onChange={(e) => setMergeIntoActive(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-deep focus-ring outline-none"
                style={{ accentColor: ACCENT }}
              />
              <span className="text-xs text-text-muted flex-1">
                Append to active scene: <span className="text-text font-semibold">&quot;{activeDoc.name}&quot;</span>
              </span>
            </label>
          )}
        </div>
      </SurfaceCard>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!selectedLevelId || generating || levelDocs.length === 0}
        className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 group outline-none"
        style={{
          backgroundColor: withOpacity(ACCENT, OPACITY_10),
          color: ACCENT,
          border: `1px solid ${withOpacity(ACCENT, OPACITY_50)}`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
        <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating spatial audio…
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Generate Spatial Audio
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 text-xs rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Generation failed: {error}
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
                  {result.merged ? 'Merge complete' : 'Generation complete'}: {result.audioScene?.name}
                </p>
                <p className="text-2xs font-mono text-text-muted mt-1">
                  {result.report.length} zones · {result.report.reduce((n, r) => n + r.emitterCount, 0)} emitters · Reverb: {result.audioScene?.globalReverbPreset}
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
