'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api-utils';
import { STATUS_SUCCESS, MODULE_COLORS, STATUS_BLOCKER, STATUS_WARNING } from '@/lib/chart-colors';
import type { AntiPatternWarning as APWarning } from '@/types/pattern-library';

interface AntiPatternWarningProps {
  prompt: string;
  moduleId?: string;
  /** Called when user clicks to switch approach */
  onSwitchApproach?: (alternativePrompt: string) => void;
}

export function AntiPatternWarning({ prompt, moduleId, onSwitchApproach }: AntiPatternWarningProps) {
  const [warnings, setWarnings] = useState<APWarning[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef('');

  // Debounced check — only fires after 600ms of no typing + minimum 20 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = prompt.trim();
    if (trimmed.length < 20 || trimmed === lastCheckedRef.current) {
      if (trimmed.length < 20) setWarnings([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      lastCheckedRef.current = trimmed;
      try {
        const params = new URLSearchParams({ action: 'check-prompt', prompt: trimmed });
        if (moduleId) params.set('moduleId', moduleId);
        const data = await apiFetch<{ warnings: APWarning[] }>(
          `/api/pattern-library?${params}`,
        );
        setWarnings(data.warnings);
      } catch {
        // Silent fail — don't block user workflow
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prompt, moduleId]);

  // Reset dismissed set when warnings change
  useEffect(() => {
    setDismissed(new Set());
  }, [warnings]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  const handleSwitch = useCallback((warning: APWarning) => {
    if (!warning.antiPattern.alternative || !onSwitchApproach) return;
    const alt = warning.antiPattern.alternative;
    // Replace approach keywords in the prompt with the alternative
    onSwitchApproach(`Use ${alt.approach} approach instead of ${warning.antiPattern.approach}`);
    handleDismiss(warning.antiPattern.id);
  }, [onSwitchApproach, handleDismiss]);

  const visibleWarnings = warnings.filter((w) => !dismissed.has(w.antiPattern.id));

  if (visibleWarnings.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="border-t border-border overflow-hidden"
      >
        {visibleWarnings.map((warning) => {
          const { antiPattern } = warning;
          const severityColor = SEVERITY_COLORS[antiPattern.severity];

          return (
            <motion.div
              key={antiPattern.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-2 px-3 py-2 bg-surface-deep"
            >
              {/* Severity icon */}
              <ShieldAlert
                className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                style={{ color: severityColor }}
              />

              {/* Warning content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-2xs font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                    style={{
                      color: severityColor,
                      backgroundColor: `${severityColor}14`,
                    }}
                  >
                    {antiPattern.severity}
                  </span>
                  <span className="text-2xs font-semibold text-text truncate">
                    {antiPattern.title}
                  </span>
                </div>

                <p className="text-2xs text-text-muted mt-0.5 leading-relaxed line-clamp-2">
                  {warning.message}
                </p>

                {/* Switch approach button */}
                {antiPattern.alternative && onSwitchApproach && (
                  <button
                    onClick={() => handleSwitch(warning)}
                    className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-2xs font-medium transition-colors hover:bg-accent-subtle"
                    style={{ color: STATUS_SUCCESS }}
                  >
                    <ArrowRight className="w-2.5 h-2.5" />
                    Switch to {antiPattern.alternative.approach} ({Math.round(antiPattern.alternative.successRate * 100)}% success)
                  </button>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => handleDismiss(antiPattern.id)}
                className="flex-shrink-0 p-0.5 rounded text-text-muted hover:text-text hover:bg-border transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: MODULE_COLORS.evaluator,
  high: STATUS_BLOCKER,
  medium: STATUS_WARNING,
};
