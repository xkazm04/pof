'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { Lightbulb, X, HelpCircle } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { EVALUATOR_SECTIONS } from '@/lib/evaluator/tab-glossary';

const STORAGE_KEY = 'pof-evaluator-coachmark-dismissed';

/** True only after hydration — gates reading localStorage so SSR + first client render agree.
 *  (Mirrors the hook in {@link ../../layout-lab/hooks/useLabPrefs}.) */
const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Dismissible first-run coachmark for the Evaluator. Explains, in plain language,
 * what each tab-bar section is for — so the insider tab names (Nexus, Oracle,
 * Archeologist, …) aren't a barrier on first visit. Dismissal is persisted in
 * localStorage, so it shows once and then collapses to a small "What do the tabs
 * mean?" affordance that can reopen it. Pairs with the always-available per-tab
 * plain descriptions (tooltip + subtitle) sourced from the same glossary.
 */
export function EvaluatorCoachmark() {
  const hydrated = useHydrated();
  // null = not yet adopted from storage; thereafter a real boolean.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  // Adopt the persisted choice once, after hydration. Done in render (not an
  // effect) to dodge the `react-hooks/set-state-in-effect` lint rule, the same
  // way useLabPrefs adopts stored prefs.
  if (hydrated && dismissed === null) {
    setDismissed(readDismissed());
  }

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage full/blocked — keep dismissed in-memory */
    }
  }, []);

  const reopen = useCallback(() => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage blocked — still reopen in-memory */
    }
  }, []);

  if (dismissed === true) {
    return (
      <button
        type="button"
        onClick={reopen}
        className="focus-ring inline-flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors rounded-sm"
      >
        <HelpCircle className="w-3 h-3" aria-hidden="true" />
        What do the tabs mean?
      </button>
    );
  }

  return (
    <div
      role="note"
      aria-label="What the evaluator tabs mean"
      className="rounded-lg border border-border bg-surface px-3.5 py-3"
      style={{ borderLeft: `3px solid ${MODULE_COLORS.evaluator}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Lightbulb className="w-4 h-4 flex-shrink-0" style={{ color: MODULE_COLORS.evaluator }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text">New here? Here’s what each section does</p>
            <p className="text-2xs text-text-muted">
              The tab names are nicknames — hover any tab for a plain-language description.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tab guide"
          className="focus-ring p-0.5 rounded text-text-muted hover:text-text transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
        {EVALUATOR_SECTIONS.map((section) => (
          <li key={section.id} className="min-w-0">
            <span className="text-xs font-semibold text-text">{section.label}</span>
            <span className="text-text-muted"> — </span>
            <span className="text-xs text-text-muted">{section.blurb}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
