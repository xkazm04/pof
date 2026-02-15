'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, MapPin, Volume2, Loader2, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle2, Music, Radio,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { AudioSceneDocument } from '@/types/audio-scene';
import type { RoomAudioReport } from '@/lib/spatial-audio-generator';

const ACCENT = '#f59e0b';

interface LevelDocItem {
  id: number;
  name: string;
  roomCount: number;
  connectionCount: number;
}

interface GenerateResult {
  audioScene: AudioSceneDocument;
  report: RoomAudioReport[];
  merged: boolean;
}

interface SpatialAudioGeneratorPanelProps {
  activeDoc: AudioSceneDocument | null;
  accentColor: string;
  onSceneCreated: () => void;
}

export function SpatialAudioGeneratorPanel({
  activeDoc,
  accentColor,
  onSceneCreated,
}: SpatialAudioGeneratorPanelProps) {
  const [levelDocs, setLevelDocs] = useState<LevelDocItem[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [mergeIntoActive, setMergeIntoActive] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);

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
      .catch(() => {})
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

  const selectedLevel = levelDocs.find((d) => d.id === selectedLevelId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-semibold text-text">Auto-Generate from Level Design</h3>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        Analyze room geometry, types, pacing, and encounter descriptions from a level design document
        to automatically generate spatial audio zones and contextual sound emitters.
      </p>

      {/* Level picker */}
      <SurfaceCard level={2}>
        <div className="p-4 space-y-3">
          <label className="text-2xs uppercase tracking-wider text-text-muted font-semibold block">
            Source Level Design
          </label>

          {loadingLevels ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading level documents...
            </div>
          ) : levelDocs.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-text-muted py-2">
              <AlertCircle className="w-3.5 h-3.5 text-[#f59e0b]" />
              No level design documents found. Create one in the Level Design module first.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {levelDocs.map((doc) => {
                const isSelected = selectedLevelId === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedLevelId(doc.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                    style={{
                      '--accent': accentColor,
                      '--accent-bg': `${accentColor}12`,
                    } as React.CSSProperties}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3" style={{ color: isSelected ? accentColor : undefined }} />
                        <span className={isSelected ? 'text-text font-medium' : 'text-text-muted-hover'}>
                          {doc.name}
                        </span>
                      </div>
                      <span className="text-2xs text-text-muted tabular-nums">
                        {doc.roomCount} rooms · {doc.connectionCount} connections
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Merge toggle */}
          {activeDoc && selectedLevelId && (
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={mergeIntoActive}
                onChange={(e) => setMergeIntoActive(e.target.checked)}
                className="rounded border-border"
              />
              <span>
                Merge into <span className="text-text font-medium">&ldquo;{activeDoc.name}&rdquo;</span> (append zones/emitters)
              </span>
            </label>
          )}
        </div>
      </SurfaceCard>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!selectedLevelId || generating || levelDocs.length === 0}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
        style={{
          backgroundColor: `${accentColor}15`,
          color: accentColor,
          border: `1px solid ${accentColor}30`,
        }}
      >
        {generating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Wand2 className="w-3.5 h-3.5" />
        )}
        {generating
          ? 'Generating spatial audio...'
          : `Generate from ${selectedLevel?.name ?? 'selected level'}`}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-[#f87171] bg-[#f8717110] border border-[#f8717130] rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <SurfaceCard level={2}>
              <div className="px-4 py-3 flex items-center gap-4">
                <CheckCircle2 className="w-4 h-4 text-[#4ade80] flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-text">
                    {result.merged ? 'Merged' : 'Created'} &ldquo;{result.audioScene?.name}&rdquo;
                  </p>
                  <p className="text-2xs text-text-muted mt-0.5">
                    {result.report.length} zones · {result.report.reduce((n, r) => n + r.emitterCount, 0)} emitters · Global reverb: {result.audioScene?.globalReverbPreset}
                  </p>
                </div>
              </div>
            </SurfaceCard>

            {/* Per-room report */}
            <div>
              <h4 className="text-xs font-semibold text-text mb-2">Room-by-Room Report</h4>
              <div className="space-y-1">
                {result.report.map((room) => {
                  const isExpanded = expandedRoom === room.roomId;
                  return (
                    <div key={room.roomId} className="rounded-lg border border-border bg-surface-deep overflow-hidden">
                      <button
                        onClick={() => setExpandedRoom(isExpanded ? null : room.roomId)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-surface-hover transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                        )}
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ROOM_TYPE_COLORS[room.roomType] ?? '#6b7280' }}
                        />
                        <span className="text-text font-medium flex-1 truncate">{room.roomName}</span>
                        <span className="text-2xs text-text-muted tabular-nums flex-shrink-0">
                          {room.reverbPreset} · {room.occlusionMode} · {room.emitterCount} emitters
                        </span>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
                              {/* Reasoning */}
                              <p className="text-2xs text-text-muted leading-relaxed italic">{room.reasoning}</p>

                              {/* Acoustic props */}
                              <div className="flex flex-wrap gap-2">
                                <PropPill icon={Volume2} label="Reverb" value={room.reverbPreset} color="#a78bfa" />
                                <PropPill icon={Radio} label="Occlusion" value={room.occlusionMode} color="#60a5fa" />
                              </div>

                              {/* Emitters */}
                              {room.emitterNames.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {room.emitterNames.map((name, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded text-2xs border border-border bg-surface text-text-muted-hover flex items-center gap-1"
                                    >
                                      <Music className="w-2.5 h-2.5" />
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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

// ── Helpers ──

const ROOM_TYPE_COLORS: Record<string, string> = {
  combat: '#ef4444',
  boss: '#eab308',
  puzzle: '#a855f7',
  exploration: '#22c55e',
  safe: '#3b82f6',
  transition: '#6b7280',
  cutscene: '#ec4899',
  hub: '#14b8a6',
};

function PropPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Volume2;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}25`,
        color,
      }}
    >
      <Icon className="w-2.5 h-2.5" />
      <span className="text-text-muted">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
