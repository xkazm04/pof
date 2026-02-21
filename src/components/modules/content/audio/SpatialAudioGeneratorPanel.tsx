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
import { MODULE_COLORS } from '@/lib/constants';
import {
  STATUS_SUCCESS, STATUS_ERROR, ACCENT_VIOLET,
  STATUS_INFO, STATUS_NEUTRAL, OPACITY_10, OPACITY_30,
} from '@/lib/chart-colors';

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

  const selectedLevel = levelDocs.find((d) => d.id === selectedLevelId);

  return (
    <div className="space-y-6 w-full h-full p-6 bg-[#03030a] rounded-2xl border border-blue-900/30 shadow-[inset_0_0_80px_rgba(59,130,246,0.05)] relative overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-blue-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-900/40 border border-blue-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Wand2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-widest uppercase text-blue-100">Auto-Generate Spatial Nodes</h3>
              <p className="text-[10px] text-blue-400/60 uppercase tracking-wider mt-0.5">
                LEVEL_GEOMETRY_TO_ACOUSTIC_PROJECTION
              </p>
            </div>
          </div>
        </div>

        <p className="text-[11px] font-mono text-blue-200/70 leading-relaxed bg-black/40 border border-blue-900/40 p-4 rounded-xl shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]">
          [SYSTEM_INFO]: Analyze room geometry, types, pacing, and encounter descriptions from a level design document
          to automatically generate spatial audio zones and contextual sound emitters.
        </p>

        {/* Level picker */}
        <div className="bg-black/60 border border-blue-900/40 rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-blue-900/20 border-b border-blue-900/40 flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">SOURCE_LEVEL_DATA</span>
          </div>

          <div className="p-4 space-y-4">
            {loadingLevels ? (
              <div className="flex items-center justify-center gap-3 py-6 text-[10px] font-bold uppercase tracking-widest text-blue-400 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                EXTRACTING_DOCUMENTS...
              </div>
            ) : levelDocs.length === 0 ? (
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-500 py-6 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                NO_LEVEL_DESIGN_RECORDS_FOUND
              </div>
            ) : (
              <div className="grid gap-2">
                {levelDocs.map((doc) => {
                  const isSelected = selectedLevelId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedLevelId(doc.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-[11px] transition-all border relative overflow-hidden group ${isSelected
                          ? 'border-blue-500/50 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                          : 'border-blue-900/40 bg-black/40 hover:bg-blue-900/20 hover:border-blue-500/30'
                        }`}
                    >
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]" />}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                          <MapPin className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-blue-500/50 group-hover:text-blue-400/80 transition-colors'}`} />
                          <span className={`font-bold uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-blue-300/80'}`}>
                            {doc.name}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-blue-400/60 uppercase tracking-widest">
                          {doc.roomCount} ZONES // {doc.connectionCount} LINKS
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Merge toggle */}
            {activeDoc && selectedLevelId && (
              <label className="flex items-center gap-3 p-3 rounded-lg border border-blue-900/30 bg-black/40 cursor-pointer group hover:border-blue-500/40 transition-colors mt-2">
                <input
                  type="checkbox"
                  checked={mergeIntoActive}
                  onChange={(e) => setMergeIntoActive(e.target.checked)}
                  className="w-4 h-4 rounded border-blue-900/50 bg-black/60 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0 transition-colors outline-none accent-blue-500"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300/80 flex-1">
                  APPEND_TO_ACTIVE: <span className="text-blue-200">"{activeDoc.name}"</span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!selectedLevelId || generating || levelDocs.length === 0}
          className="relative w-full overflow-hidden flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 group outline-none"
          style={{
            backgroundColor: 'rgba(59,130,246,0.15)',
            color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.5)',
            boxShadow: '0 0 20px rgba(59,130,246,0.2), inset 0 0 10px rgba(59,130,246,0.1)',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />
          <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[200%] transition-transform duration-1000 ease-out pointer-events-none" />

          {generating ? (
            <div className="flex items-center gap-2 animate-pulse">
              <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              SYNTHESIZING_AUDIO_PROPAGATION...
            </div>
          ) : (
            <>
              <Wand2 className="w-4 h-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(currentColor,0.8)] transition-all" />
              EXECUTE GENERATION PROTOCOL
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ERR_CODE: {error}
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="space-y-4 pt-4 border-t border-blue-900/40"
            >
              {/* Summary bar */}
              <div className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-4 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">
                    {result.merged ? 'MERGE_COMPLETE' : 'SYNTHESIS_COMPLETE'}: {result.audioScene?.name}
                  </p>
                  <p className="text-[9px] font-mono text-emerald-400/70 mt-1 uppercase tracking-widest">
                    {result.report.length} ZONES // {result.report.reduce((n, r) => n + r.emitterCount, 0)} EMITTERS // REVERB: {result.audioScene?.globalReverbPreset}
                  </p>
                </div>
              </div>

              {/* Per-room report */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500/60" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400">TELEMETRY_LOG</h4>
                </div>
                <div className="space-y-2">
                  {result.report.map((room) => {
                    const isExpanded = expandedRoom === room.roomId;
                    return (
                      <div key={room.roomId} className="rounded-xl border border-blue-900/40 bg-black/40 overflow-hidden shadow-inner transition-colors hover:border-blue-500/30">
                        <button
                          onClick={() => setExpandedRoom(isExpanded ? null : room.roomId)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[11px] text-left transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: ROOM_TYPE_COLORS[room.roomType] ?? STATUS_NEUTRAL }}
                          />
                          <span className="text-blue-100 font-bold uppercase tracking-widest flex-1 truncate">{room.roomName}</span>
                          <span className="text-[9px] font-mono text-blue-400/60 uppercase tracking-widest flex-shrink-0 text-right">
                            {room.reverbPreset} <br /> {room.emitterCount} SOURCE(S)
                          </span>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-blue-900/40 bg-black/60">
                                {/* Reasoning */}
                                <div className="p-3 rounded-lg bg-blue-900/10 border border-blue-900/30">
                                  <p className="text-[10px] font-mono text-blue-200/80 leading-relaxed"><span className="text-blue-400 font-bold uppercase tracking-widest">LOGIC_TRACE: </span>{room.reasoning}</p>
                                </div>

                                {/* Acoustic props */}
                                <div className="flex flex-wrap gap-2">
                                  <PropPill icon={Volume2} label="REVERB" value={room.reverbPreset} color={ACCENT_VIOLET} />
                                  <PropPill icon={Radio} label="OCCLUSION" value={room.occlusionMode} color={STATUS_INFO} />
                                </div>

                                {/* Emitters */}
                                {room.emitterNames.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500/80">GENERATED_EMITTERS</span>
                                    <div className="flex flex-wrap gap-2">
                                      {room.emitterNames.map((name, i) => (
                                        <span
                                          key={i}
                                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-mono border border-blue-500/20 bg-blue-500/10 text-blue-200 flex items-center gap-1.5 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]"
                                        >
                                          <Music className="w-3 h-3 text-blue-400" />
                                          {name}
                                        </span>
                                      ))}
                                    </div>
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
    </div>
  );
}

// ── Helpers ──

const ROOM_TYPE_COLORS: Record<string, string> = {
  combat: MODULE_COLORS.evaluator,
  boss: '#eab308',
  puzzle: '#a855f7',
  exploration: STATUS_SUCCESS,
  safe: MODULE_COLORS.core,
  transition: STATUS_NEUTRAL,
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
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-blue-900/30 shadow-inner"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color,
      }}
    >
      <Icon className="w-3 h-3 opacity-80" />
      <span className="opacity-60">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
