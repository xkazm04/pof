'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCommit, History, Plus, RotateCcw, Trash2, ChevronDown, ChevronRight,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  ACCENT_EMERALD, ACCENT_CYAN, ACCENT_VIOLET, STATUS_WARNING, STATUS_ERROR,
  withOpacity, OPACITY_8, OPACITY_10, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import type { CharacterGenome } from '@/types/character-genome';
import type { GenomeCheckpoint } from '@/types/genome-checkpoint';
import { useGenomeStore } from '@/stores/genomeStore';
import { groupDeltas } from '@/lib/genome/genome-diff';
import { summarizeSnapshotSeries } from '@/lib/genome/checkpoint-summary';
import { CHARACTER_DIFF_SPECS } from './diff-fields';

/* ── Named Version Checkpoints + Changelog Timeline ────────────────────── *
 * Vertical, newest-first changelog for the active genome. Each entry shows
 * the user-given name, a one-line auto-summary derived from `diffGenomes`
 * against the previous checkpoint, and expands to the full field-level diff.
 * Restore button rewrites the live genome to that snapshot.
 * ────────────────────────────────────────────────────────────────────────── */

const DIRECTION_COLOR = {
  up: ACCENT_EMERALD,
  down: STATUS_WARNING,
  neutral: ACCENT_CYAN,
} as const;

interface CheckpointTimelineProps {
  /** Active genome the timeline belongs to. */
  activeGenome: CharacterGenome;
  /** Override the panel accent (defaults to the genome's color). */
  accent?: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Short locale form, e.g. "May 26, 4:09 PM" — no year (most users review
  // recent edits, not last-year archives).
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export function CheckpointTimeline({ activeGenome, accent }: CheckpointTimelineProps) {
  const allCheckpoints = useGenomeStore((s) => s.checkpoints);
  const createCheckpoint = useGenomeStore((s) => s.createCheckpoint);
  const restoreCheckpoint = useGenomeStore((s) => s.restoreCheckpoint);
  const deleteCheckpoint = useGenomeStore((s) => s.deleteCheckpoint);
  const renameCheckpoint = useGenomeStore((s) => s.renameCheckpoint);

  const color = accent ?? activeGenome.color;

  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  // Newest-first for display; summaries need oldest-first so each entry can
  // diff against its predecessor in chronological order.
  const checkpointsChrono = useMemo(
    () => allCheckpoints
      .filter((c) => c.genomeId === activeGenome.id)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allCheckpoints, activeGenome.id],
  );

  const summaries = useMemo(
    () => summarizeSnapshotSeries(checkpointsChrono.map((c) => c.snapshot), CHARACTER_DIFF_SPECS),
    [checkpointsChrono],
  );

  // Pair newest-first for rendering but keep each entry's chronological summary.
  const rows = useMemo(() => {
    const pairs = checkpointsChrono.map((checkpoint, i) => ({ checkpoint, summary: summaries[i] }));
    return pairs.slice().reverse();
  }, [checkpointsChrono, summaries]);

  const handleCreate = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = createCheckpoint(activeGenome.id, trimmed, newNote);
    if (created) {
      setNewName('');
      setNewNote('');
    }
  }, [newName, newNote, createCheckpoint, activeGenome.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  }, [handleCreate]);

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startRename = useCallback((cp: GenomeCheckpoint) => {
    setRenamingId(cp.id);
    setRenameDraft(cp.name);
  }, []);

  const commitRename = useCallback(() => {
    if (renamingId && renameDraft.trim()) {
      renameCheckpoint(renamingId, renameDraft);
    }
    setRenamingId(null);
    setRenameDraft('');
  }, [renamingId, renameDraft, renameCheckpoint]);

  return (
    <BlueprintPanel color={color} className="p-3">
      <SectionHeader icon={History} label="Version Checkpoints" color={color} />

      {/* ── Create row ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="Checkpoint name (e.g. v1.0 pre-nerf)"
          className="flex-1 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg px-2.5 py-1.5 text-text placeholder:text-text-muted/40 focus-ring"
        />
        <input
          type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="Optional note"
          className="flex-1 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg px-2.5 py-1.5 text-text placeholder:text-text-muted/40 focus-ring"
        />
        <button
          onClick={handleCreate} disabled={!newName.trim()}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          style={{
            borderColor: withOpacity(color, OPACITY_25),
            backgroundColor: withOpacity(color, OPACITY_10),
            color,
          }}
          title="Capture the current genome as a named checkpoint"
        >
          <Plus className="w-3 h-3" /> Capture
        </button>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <p className="text-xs font-mono text-text-muted px-1">
          No checkpoints yet — capture one to start tracking tuning decisions.
        </p>
      ) : (
        <ol className="relative pl-5 space-y-3">
          {/* Vertical rail */}
          <span
            aria-hidden
            className="absolute left-[7px] top-1 bottom-1 w-px"
            style={{ backgroundColor: withOpacity(color, OPACITY_25) }}
          />
          <AnimatePresence initial={false}>
            {rows.map(({ checkpoint, summary }) => {
              const isExpanded = expanded.has(checkpoint.id);
              const groups = groupDeltas(summary.deltas);
              const isRenaming = renamingId === checkpoint.id;
              return (
                <motion.li
                  key={checkpoint.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.18 }}
                  className="relative"
                >
                  {/* Node dot */}
                  <span
                    aria-hidden
                    className="absolute -left-[18px] top-1 w-3 h-3 rounded-full border-2"
                    style={{
                      backgroundColor: 'var(--surface-deep)',
                      borderColor: color,
                      boxShadow: `0 0 6px ${withOpacity(color, OPACITY_25)}`,
                    }}
                  />

                  <div className="rounded-lg border p-2.5"
                    style={{
                      borderColor: withOpacity(color, OPACITY_10),
                      backgroundColor: withOpacity(color, OPACITY_8),
                    }}>
                    {/* Header row */}
                    <div className="flex items-center gap-2 mb-1">
                      <GitCommit className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                            if (e.key === 'Escape') { setRenamingId(null); setRenameDraft(''); }
                          }}
                          className="flex-1 text-xs font-mono font-bold bg-transparent border-b border-border/40 text-text focus:outline-none px-0"
                        />
                      ) : (
                        <button
                          onClick={() => startRename(checkpoint)}
                          className="flex-1 text-left text-xs font-mono font-bold text-text hover:opacity-80 truncate"
                          title="Click to rename"
                        >
                          {checkpoint.name}
                        </button>
                      )}
                      <span className="text-xs font-mono text-text-muted/70 tabular-nums whitespace-nowrap">
                        {formatTimestamp(checkpoint.createdAt)}
                      </span>
                      <button
                        onClick={() => restoreCheckpoint(checkpoint.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border transition-colors hover:brightness-110"
                        style={{
                          borderColor: withOpacity(ACCENT_VIOLET, OPACITY_25),
                          backgroundColor: withOpacity(ACCENT_VIOLET, OPACITY_8),
                          color: ACCENT_VIOLET,
                        }}
                        title="Restore the active genome to this snapshot"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                      <button
                        onClick={() => deleteCheckpoint(checkpoint.id)}
                        className="p-1 rounded border transition-colors hover:brightness-110"
                        style={{
                          borderColor: withOpacity(STATUS_ERROR, OPACITY_25),
                          backgroundColor: withOpacity(STATUS_ERROR, OPACITY_8),
                          color: STATUS_ERROR,
                        }}
                        title="Delete checkpoint"
                        aria-label={`Delete checkpoint ${checkpoint.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Optional note */}
                    {checkpoint.note && (
                      <p className="text-xs font-mono text-text-muted/80 italic mb-1 pl-5">
                        {checkpoint.note}
                      </p>
                    )}

                    {/* Auto-summary toggler */}
                    <button
                      onClick={() => toggleExpanded(checkpoint.id)}
                      disabled={summary.deltas.length === 0}
                      className="w-full flex items-center gap-1 text-xs font-mono text-text-muted hover:text-text disabled:hover:text-text-muted disabled:cursor-default text-left pl-5"
                    >
                      {summary.deltas.length > 0 ? (
                        isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                      ) : (
                        <span className="inline-block w-3" />
                      )}
                      <span className="truncate">{summary.headline}</span>
                      {summary.deltas.length > 0 && (
                        <span className="text-text-muted/50 ml-auto whitespace-nowrap">
                          {summary.deltas.length} change{summary.deltas.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </button>

                    {/* Expanded field-level diff */}
                    <AnimatePresence initial={false}>
                      {isExpanded && summary.deltas.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-5 pt-2 space-y-2">
                            {groups.map(({ group, items }) => (
                              <div key={group} className="space-y-1">
                                <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted/70">{group}</div>
                                {items.map((d) => (
                                  <div key={`${group}-${d.label}`} className="flex items-center gap-2 text-xs font-mono pl-1">
                                    <span className="flex-1 text-text-muted truncate">{d.label}</span>
                                    <span className="text-text-muted/50 tabular-nums">{d.from}</span>
                                    {d.direction === 'up' && <ArrowUp className="w-3 h-3 flex-shrink-0" style={{ color: DIRECTION_COLOR.up }} />}
                                    {d.direction === 'down' && <ArrowDown className="w-3 h-3 flex-shrink-0" style={{ color: DIRECTION_COLOR.down }} />}
                                    <span className="font-bold tabular-nums" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.to}</span>
                                    {d.delta && (
                                      <span className="w-16 text-right tabular-nums" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.delta}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
    </BlueprintPanel>
  );
}
