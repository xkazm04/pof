'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scroll, MapPin, MessageSquare,
  ChevronDown, ChevronRight, Target, Zap,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type {
  GeneratedQuest,
  QuestObjective,
  DialogueNode,
} from '@/types/quest-generation';
import { MODULE_COLORS, ACCENT_VIOLET, ACCENT_GREEN, withOpacity, OPACITY_10 } from '@/lib/chart-colors';
import { CATEGORY_LABELS, OBJ_ICONS, DIFFICULTY_COLORS, MAX_PIPS, ACCENT } from './constants';

// ── Difficulty pips ──

function DifficultyPips({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(MAX_PIPS, level));
  const color = DIFFICULTY_COLORS[clamped - 1];

  return (
    <div className="flex items-center gap-0.5" title={`Difficulty ${clamped}/${MAX_PIPS}`}>
      {Array.from({ length: MAX_PIPS }, (_, i) => (
        <svg key={i} width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle
            cx="4" cy="4" r="3"
            fill={i < clamped ? color : 'transparent'}
            stroke={i < clamped ? color : 'var(--text-muted)'}
            strokeWidth="1"
            opacity={i < clamped ? 1 : 0.3}
          />
        </svg>
      ))}
    </div>
  );
}

// ── Quest card ──

export function QuestCard({ quest }: { quest: GeneratedQuest }) {
  const [expanded, setExpanded] = useState(false);
  const catCfg = CATEGORY_LABELS[quest.category];

  return (
    <SurfaceCard level={2} className="overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover/30 transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
        <Scroll className="w-3.5 h-3.5 flex-shrink-0" style={{ color: catCfg.color }} />
        <span className="text-xs font-semibold text-text truncate flex-1">{quest.name}</span>
        <span
          className="text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: catCfg.color, backgroundColor: `${catCfg.color}15` }}
        >
          {catCfg.label}
        </span>
        <DifficultyPips level={quest.difficulty} />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-border/40">
              {/* Description */}
              <p className="text-xs text-text-muted pt-2">{quest.description}</p>

              {/* Source hint */}
              <p className="text-2xs text-text-muted italic">{quest.sourceHint}</p>

              {/* Objectives */}
              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Objectives</span>
                <div className="mt-1 space-y-1">
                  {quest.objectives.map(obj => (
                    <ObjectiveRow key={obj.id} objective={obj} />
                  ))}
                </div>
              </div>

              {/* Rewards */}
              {quest.rewards.length > 0 && (
                <div>
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Rewards</span>
                  <div className="flex items-center gap-2 mt-1">
                    {quest.rewards.map((r, i) => (
                      <span key={i} className="text-2xs px-1.5 py-0.5 rounded font-medium" style={{ color: MODULE_COLORS.content, backgroundColor: withOpacity(MODULE_COLORS.content, OPACITY_10) }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dialogue preview */}
              {quest.dialogue.length > 0 && (
                <div>
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Dialogue Preview</span>
                  <div className="mt-1 space-y-1.5">
                    {quest.dialogue.slice(0, 3).map(node => (
                      <DialogueNodePreview key={node.id} node={node} />
                    ))}
                  </div>
                </div>
              )}

              {/* Room path */}
              {quest.roomPath.length > 0 && (
                <div className="flex items-center gap-1 text-2xs text-text-muted">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Path: {quest.roomPath.length} zone{quest.roomPath.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

// ── Objective row ──

function ObjectiveRow({ objective }: { objective: QuestObjective }) {
  const Icon = OBJ_ICONS[objective.type] || Target;
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3 h-3 text-text-muted flex-shrink-0" />
      <span className={`flex-1 ${objective.optional ? 'text-text-muted italic' : 'text-text'}`}>
        {objective.description}
        {objective.optional && ' (optional)'}
      </span>
      {objective.roomName && (
        <span className="text-2xs text-text-muted font-mono">{objective.roomName}</span>
      )}
    </div>
  );
}

// ── Dialogue preview ──

function DialogueNodePreview({ node }: { node: DialogueNode }) {
  return (
    <div className="rounded border border-border/40 bg-background/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <MessageSquare className="w-2.5 h-2.5" style={{ color: ACCENT }} />
        <span className="text-2xs font-semibold" style={{ color: ACCENT_VIOLET }}>{node.speaker}</span>
      </div>
      <p className="text-2xs text-text leading-relaxed">{node.text}</p>
      {node.choices.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {node.choices.map(ch => (
            <div key={ch.id} className="flex items-center gap-1 text-2xs">
              <Zap className="w-2 h-2" style={{ color: ACCENT_GREEN }} />
              <span style={{ color: ACCENT_GREEN }}>{ch.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
