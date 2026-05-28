'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ChevronDown, Clock, FileWarning, KeyRound,
  RefreshCw, Pencil, ServerCrash, WifiOff,
} from 'lucide-react';
import { ACCENT_RED, STATUS_WARNING, STATUS_NEUTRAL, OVERLAY_WHITE, OPACITY_5, OPACITY_8, OPACITY_15, OPACITY_25, withOpacity } from '@/lib/chart-colors';
import { classifyForgeError, type ForgeErrorAction, type ForgeErrorCard as ForgeErrorCardData } from '@/lib/forge-errors';

const ICONS: Record<ForgeErrorCardData['iconName'], React.ComponentType<{ size?: number; className?: string }>> = {
  AlertTriangle, Clock, FileWarning, KeyRound, ServerCrash, WifiOff,
};

const ACTION_LABEL: Record<ForgeErrorAction, string> = {
  retry: 'Try again',
  'edit-description': 'Edit description',
  configure: 'Set up the AI key',
};

/**
 * Structured replacement for the raw red error box: a plain-English title,
 * one-sentence cause, action buttons (retry / edit), and a collapsible
 * "Technical details" disclosure preserving the original error message so
 * power users can still diagnose what actually broke.
 */
export function ForgeErrorCard({
  error,
  onRetry,
  onEditDescription,
}: {
  error: unknown;
  onRetry?: () => void;
  onEditDescription?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const card = classifyForgeError(error);
  const Icon = ICONS[card.iconName];
  // Configure-action cards are warnings (amber); the rest are red.
  const tone = card.kind === 'api-key-missing' ? STATUS_WARNING : ACCENT_RED;

  const onAction = (a: ForgeErrorAction) => {
    if (a === 'retry') onRetry?.();
    else if (a === 'edit-description') onEditDescription?.();
    else if (a === 'configure') window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      data-error-kind={card.kind}
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: withOpacity(tone, OPACITY_25),
        background: withOpacity(tone, OPACITY_5),
      }}
    >
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <Icon size={18} className="flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug" style={{ color: tone }}>{card.title}</div>
          <p className="text-xs leading-relaxed text-zinc-300 mt-0.5">{card.plainCause}</p>

          {card.actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {card.actions.map((a) => {
                const isPrimary = a === 'retry' || a === 'configure';
                const disabled = (a === 'retry' && !onRetry) || (a === 'edit-description' && !onEditDescription);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onAction(a)}
                    disabled={disabled}
                    data-action={a}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={isPrimary ? {
                      background: withOpacity(tone, OPACITY_15),
                      color: tone,
                      border: `1px solid ${withOpacity(tone, OPACITY_25)}`,
                    } : {
                      background: 'transparent',
                      color: STATUS_NEUTRAL,
                      border: `1px solid ${withOpacity(OVERLAY_WHITE, OPACITY_8)}`,
                    }}
                  >
                    {a === 'retry' && <RefreshCw size={11} />}
                    {a === 'edit-description' && <Pencil size={11} />}
                    {a === 'configure' && <KeyRound size={11} />}
                    {ACTION_LABEL[a]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Technical details disclosure */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="mt-2.5 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <motion.span animate={{ rotate: showDetails ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={11} />
            </motion.span>
            Technical details
          </button>
          {showDetails && (
            <pre className="mt-1.5 p-2 rounded bg-zinc-950/70 border border-zinc-800 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {card.rawMessage}
            </pre>
          )}
        </div>
      </div>
    </motion.div>
  );
}
