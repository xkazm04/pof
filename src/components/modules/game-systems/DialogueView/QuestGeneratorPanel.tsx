'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Scroll, RefreshCw, Sparkles, AlertTriangle, Download,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CopyButton } from '@/components/ui/CopyButton';
import { apiFetch } from '@/lib/api-utils';
import { useProjectStore } from '@/stores/projectStore';
import type {
  QuestGenerationResult,
  QuestCategory,
} from '@/types/quest-generation';
import { withOpacity, OPACITY_80 } from '@/lib/chart-colors';
import { EMPTY_QUESTS, EMPTY_NOTES, ACCENT, CATEGORY_LABELS } from './constants';
import { WorldScanSummary } from './WorldScanSummary';
import { QuestCard } from './QuestCard';

// ── Quest Generator Panel ──

export function QuestGeneratorPanel() {
  const [result, setResult] = useState<QuestGenerationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelDocs, setLevelDocs] = useState<Array<{ id: number; name: string; roomCount: number }>>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const projectPath = useProjectStore((s) => s.projectPath);

  // Load available level docs
  useEffect(() => {
    apiFetch<{ docs: Array<{ id: number; name: string; roomCount: number }> }>('/api/quest-generation')
      .then(data => {
        setLevelDocs(data.docs);
        if (data.docs.length > 0 && selectedDocId === null) {
          setSelectedDocId(data.docs[0].id);
        }
      })
      .catch(() => { /* ignore */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ result: QuestGenerationResult }>(
        '/api/quest-generation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath: projectPath || undefined,
            levelDocId: selectedDocId || undefined,
          }),
        },
      );
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [projectPath, selectedDocId]);

  const quests = result?.quests ?? EMPTY_QUESTS;
  const notes = result?.coherenceNotes ?? EMPTY_NOTES;

  // ── Export ──
  //
  // The generated quests used to dead-end on screen: no way to get the
  // objectives/dialogue trees out of the panel. Batch payload keeps the
  // provenance (when it was generated, which level doc it read) alongside the
  // quests so an exported file is identifiable out of context.
  const batchJson = useMemo(() => {
    if (!result) return '';
    return JSON.stringify(
      {
        generatedAt: result.generatedAt,
        levelDocId: result.levelDocId,
        levelDocName: result.levelDocName,
        questCount: result.quests.length,
        quests: result.quests,
      },
      null,
      2,
    );
  }, [result]);

  // Filename is derived from `generatedAt` (never Date.now() — that would be a
  // render-purity violation and would drift from the payload's own stamp).
  const downloadJson = useCallback(() => {
    if (!batchJson || !result) return;
    const stamp = result.generatedAt.replace(/[:.]/g, '-');
    // Same transient-anchor shape as CodeViewer's triggerDownload — the anchor
    // must be in the document before click() for Firefox to honour it.
    const url = URL.createObjectURL(new Blob([batchJson], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `quests-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [batchJson, result]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <SurfaceCard level={2} className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
          <span className="text-sm font-semibold text-text">Quest Archeologist</span>
          <div className="ml-auto flex items-center gap-2">
            {levelDocs.length > 0 && (
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
                className="bg-background border border-border-bright rounded px-2 py-1 text-xs text-text outline-none"
              >
                <option value="">No level doc</option>
                {levelDocs.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.roomCount} rooms)</option>
                ))}
              </select>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-white transition-colors disabled:opacity-50 hover:brightness-125"
              style={{ backgroundColor: withOpacity(ACCENT, OPACITY_80) }}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating…' : 'Generate Quests'}
            </button>
          </div>
        </div>
        <p className="text-2xs text-text-muted mt-1.5">
          Scans project actors and level designs to procedurally generate quests with dialogue trees.
        </p>
      </SurfaceCard>

      {error && (
        <div className="rounded border border-red-400/30 bg-red-400/5 px-3 py-2 text-xs text-red-400">{error}</div>
      )}

      {!result && !loading && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <Scroll className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Click &quot;Generate Quests&quot; to scan your world and create quests</p>
          <p className="text-2xs text-text-muted mt-1">Works best with a level design document and scanned UE5 project</p>
        </SurfaceCard>
      )}

      {loading && !result && (
        <SurfaceCard level={2} className="px-4 py-8 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" style={{ color: ACCENT }} />
          <p className="text-sm text-text-muted">Scanning world actors and generating quests…</p>
        </SurfaceCard>
      )}

      {result && (
        <>
          {/* World scan summary */}
          <WorldScanSummary scan={result.worldScan} levelDocName={result.levelDocName} />

          {/* Export — honest: this hands the quests off as a file, it does not
              write anything into the UE5 project. */}
          {quests.length > 0 && (
            <SurfaceCard level={2} className="px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">
                Export {quests.length} quest{quests.length === 1 ? '' : 's'}
              </span>
              <span className="text-2xs text-text-muted">
                — JSON hand-off (objectives, dialogue trees, rewards). Not written to your UE5 project.
              </span>
              <div className="ml-auto flex items-center gap-1">
                <CopyButton
                  text={batchJson}
                  size="sm"
                  tooltip={`Copy all ${quests.length} quests as JSON`}
                  copiedTooltip="All quests copied"
                />
                <button
                  type="button"
                  onClick={downloadJson}
                  className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
                >
                  <Download className="w-3 h-3" aria-hidden />
                  Download .json
                </button>
              </div>
            </SurfaceCard>
          )}

          {/* Quest metrics — animate as a group first */}
          <motion.div
            className="flex flex-wrap gap-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {(['main', 'side', 'bounty', 'exploration', 'fetch'] as QuestCategory[]).map(c => {
              const count = quests.filter(q => q.category === c).length;
              const cfg = CATEGORY_LABELS[c];
              return (
                <motion.div
                  key={c}
                  className="min-w-[100px] flex-1"
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <SurfaceCard level={2} className="px-3 py-2 border-l-2" style={{ borderLeftColor: cfg.color }}>
                    <div className="text-2xs uppercase tracking-wider text-text-muted font-medium mb-0.5">{cfg.label}</div>
                    <div className="text-base font-semibold" style={{ color: count > 0 ? cfg.color : 'var(--text-muted)' }}>{count}</div>
                  </SurfaceCard>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Coherence notes */}
          {notes.length > 0 && (
            <SurfaceCard level={2} className="px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Coherence Check</span>
              </div>
              <div className="space-y-0.5">
                {notes.map((note, i) => (
                  <p key={i} className="text-xs text-text-muted">{note}</p>
                ))}
              </div>
            </SurfaceCard>
          )}

          {/* Quest list — stagger in after metrics */}
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } },
            }}
          >
            {quests.length === 0 ? (
              <SurfaceCard level={2} className="px-4 py-6 text-center">
                <p className="text-xs text-text-muted">No quests generated. Add enemy, NPC, or interactable actors to your project and create a level design document.</p>
              </SurfaceCard>
            ) : (
              quests.map(q => (
                <motion.div
                  key={q.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <QuestCard quest={q} />
                </motion.div>
              ))
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
