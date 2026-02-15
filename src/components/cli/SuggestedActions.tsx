'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, RefreshCw, Package, ChevronRight, X, Undo2 } from 'lucide-react';
import type { CLISessionState } from './store/cliPanelStore';

// ── Suggestion types ──

export interface Suggestion {
  id: string;
  label: string;
  description: string;
  icon: typeof Play;
  /** Event to dispatch — callers handle the action */
  action: SuggestionAction;
}

export type SuggestionAction =
  | { type: 'prompt'; prompt: string }
  | { type: 'navigate'; tab: string }
  | { type: 'callback'; fn: () => void };

// ── Suggestion generation ──

function inferTaskType(sessionKey: string): 'checklist' | 'review' | 'fix' | 'quick' | 'unknown' {
  if (sessionKey.endsWith('-cli')) return 'checklist';
  if (sessionKey.endsWith('-review')) return 'review';
  if (sessionKey.endsWith('-fix')) return 'fix';
  if (sessionKey.endsWith('-quick')) return 'quick';
  return 'unknown';
}

function extractModuleId(sessionKey: string): string {
  // sessionKey format: "moduleId-cli" or "moduleId-review" etc.
  const parts = sessionKey.split('-');
  // Remove the last part (cli/review/fix/quick)
  parts.pop();
  return parts.join('-');
}

export function generateSuggestions(session: CLISessionState): Suggestion[] {
  const { lastTaskSuccess, sessionKey } = session;
  if (lastTaskSuccess === null) return [];

  const taskType = inferTaskType(sessionKey ?? '');
  const moduleId = extractModuleId(sessionKey ?? '');
  const suggestions: Suggestion[] = [];

  if (lastTaskSuccess) {
    // ── SUCCESS paths ──
    switch (taskType) {
      case 'checklist':
        suggestions.push({
          id: 'next-item',
          label: 'Run next checklist item',
          description: 'Continue with the next incomplete item',
          icon: ChevronRight,
          action: { type: 'navigate', tab: 'roadmap' },
        });
        suggestions.push({
          id: 'review-module',
          label: 'Run feature review',
          description: 'Scan all features for implementation status',
          icon: RefreshCw,
          action: { type: 'prompt', prompt: `__review:${moduleId}` },
        });
        break;

      case 'review':
        suggestions.push({
          id: 'fix-missing',
          label: 'Fix first missing feature',
          description: 'Address the top-priority missing item',
          icon: Play,
          action: { type: 'navigate', tab: 'overview' },
        });
        suggestions.push({
          id: 'start-checklist',
          label: 'Start roadmap checklist',
          description: 'Work through implementation tasks in order',
          icon: ChevronRight,
          action: { type: 'navigate', tab: 'roadmap' },
        });
        break;

      case 'fix':
        suggestions.push({
          id: 're-review',
          label: 'Re-run review',
          description: 'Verify the fix improved feature status',
          icon: RefreshCw,
          action: { type: 'prompt', prompt: `__review:${moduleId}` },
        });
        suggestions.push({
          id: 'next-fix',
          label: 'Fix next issue',
          description: 'Address the next feature needing attention',
          icon: Play,
          action: { type: 'navigate', tab: 'overview' },
        });
        break;

      default:
        suggestions.push({
          id: 'review-module',
          label: 'Run feature review',
          description: 'Scan features for updated status',
          icon: RefreshCw,
          action: { type: 'prompt', prompt: `__review:${moduleId}` },
        });
        break;
    }
  } else {
    // ── FAILURE paths ──
    suggestions.push({
      id: 'retry',
      label: 'Retry task',
      description: 'Run the same task again',
      icon: RefreshCw,
      action: { type: 'prompt', prompt: '__retry' },
    });

    if (taskType === 'checklist' || taskType === 'fix') {
      suggestions.push({
        id: 'skip-next',
        label: 'Skip to next item',
        description: 'Move on and come back to this later',
        icon: ChevronRight,
        action: { type: 'navigate', tab: 'roadmap' },
      });
    }
  }

  return suggestions.slice(0, 3);
}

// ── Undo snackbar ──

const UNDO_TIMEOUT_MS = 5000;

function UndoSnackbar({ onUndo, onExpire, accentColor }: { onUndo: () => void; onExpire: () => void; accentColor: string }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(onExpire, UNDO_TIMEOUT_MS);
    return () => { clearTimeout(timerRef.current); };
  }, [onExpire]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="border-b border-border bg-surface overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-text-muted">Suggestions dismissed</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium transition-all hover:brightness-110"
          style={{
            color: accentColor,
            backgroundColor: `${accentColor}14`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <Undo2 className="w-3 h-3" />
          Undo
        </button>
      </div>
    </motion.div>
  );
}

// ── Component ──

interface SuggestedActionsProps {
  session: CLISessionState;
  onAction: (action: SuggestionAction) => void;
  accentColor?: string;
}

export function SuggestedActions({ session, onAction, accentColor = '#00ff88' }: SuggestedActionsProps) {
  const [dismissState, setDismissState] = useState<'visible' | 'pending-undo' | 'dismissed'>('visible');
  const [dismissedForSession, setDismissedForSession] = useState<string | null>(null);

  const suggestions = useMemo(() => generateSuggestions(session), [session]);

  // Reset dismissed state when session changes (new task completes)
  const sessionActivity = `${session.id}-${session.lastActivityAt}`;
  if (dismissedForSession !== null && dismissedForSession !== sessionActivity) {
    setDismissState('visible');
    setDismissedForSession(null);
  }

  const handleDismiss = useCallback(() => {
    setDismissState('pending-undo');
    setDismissedForSession(sessionActivity);
  }, [sessionActivity]);

  const handleUndo = useCallback(() => {
    setDismissState('visible');
  }, []);

  const handleUndoExpire = useCallback(() => {
    setDismissState('dismissed');
  }, []);

  // Don't show when running or when no suggestions
  if (session.isRunning || suggestions.length === 0) return null;

  return (
    <AnimatePresence mode="wait">
      {dismissState === 'visible' && (
        <motion.div
          key="suggestions"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="border-b border-border bg-surface overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-2xs font-medium text-text-muted uppercase tracking-wider flex-shrink-0">
              Suggested
            </span>

            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => onAction(s.action)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium transition-all hover:brightness-110 whitespace-nowrap flex-shrink-0"
                    style={{
                      backgroundColor: `${accentColor}14`,
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                    }}
                    title={s.description}
                  >
                    <Icon className="w-3 h-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleDismiss}
              className="p-0.5 rounded text-text-muted hover:text-text transition-colors flex-shrink-0"
              title="Dismiss suggestions"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
      {dismissState === 'pending-undo' && (
        <UndoSnackbar
          key="undo"
          onUndo={handleUndo}
          onExpire={handleUndoExpire}
          accentColor={accentColor}
        />
      )}
    </AnimatePresence>
  );
}
