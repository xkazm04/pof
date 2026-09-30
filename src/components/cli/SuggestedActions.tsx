'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, Play, RefreshCw, ChevronRight, Send, X, Undo2 } from 'lucide-react';
import type { CLISessionState } from './store/cliPanelStore';
import { generateSuggestions, type Suggestion, type SuggestionAction, type SuggestionIcon } from '@/components/cli/suggestionIntents';
import { MODULE_COLORS, withOpacity, OPACITY_8, OPACITY_20 } from '@/lib/chart-colors';
import { CLI_ANIM } from '@/lib/constants';

// ── Suggestions ──
// Derived from the session's recorded run facts in suggestionIntents.ts (pure).

export { generateSuggestions };
export type { Suggestion, SuggestionAction };

const SUGGESTION_ICONS: Record<SuggestionIcon, typeof Play> = {
  retry: RefreshCw,
  next: ChevronRight,
  play: Play,
  callback: Send,
};

// ── Undo snackbar ──

const UNDO_TIMEOUT_MS = 5000;

function UndoSnackbar({ onUndo, onExpire, accentColor, reducedMotion }: { onUndo: () => void; onExpire: () => void; accentColor: string; reducedMotion: boolean }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(onExpire, UNDO_TIMEOUT_MS);
    return () => { clearTimeout(timerRef.current); };
  }, [onExpire]);

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : CLI_ANIM.medium}
      className="border-b border-border bg-surface overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-text-muted">Suggestions dismissed</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium transition-all hover:brightness-110 focus-ring"
          aria-label="Undo dismissing suggestions"
          style={{
            color: accentColor,
            backgroundColor: withOpacity(accentColor, OPACITY_8),
            border: `1px solid ${withOpacity(accentColor, OPACITY_20)}`,
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

export function SuggestedActions({ session, onAction, accentColor = MODULE_COLORS.setup }: SuggestedActionsProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;
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
          initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : CLI_ANIM.medium}
          className="border-b border-border bg-surface overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: accentColor }} />
            <span className="text-2xs font-medium text-text-muted uppercase tracking-wider flex-shrink-0">
              Suggested
            </span>

            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
              {suggestions.map((s) => {
                const Icon = SUGGESTION_ICONS[s.icon];
                return (
                  <button
                    key={s.id}
                    onClick={() => onAction(s.action)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-medium transition-all hover:brightness-110 whitespace-nowrap flex-shrink-0 focus-ring"
                    style={{
                      backgroundColor: withOpacity(accentColor, OPACITY_8),
                      color: accentColor,
                      border: `1px solid ${withOpacity(accentColor, OPACITY_20)}`,
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
              className="p-1 rounded text-text-muted hover:text-text transition-colors flex-shrink-0 focus-ring"
              title="Dismiss suggestions"
              aria-label="Dismiss suggestions"
            >
              <X className="w-3 h-3" aria-hidden="true" />
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
          reducedMotion={shouldReduceMotion}
        />
      )}
    </AnimatePresence>
  );
}
