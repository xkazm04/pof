'use client';

import { useState } from 'react';
import { Check, ChevronDown, Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_NEUTRAL,
  OPACITY_15, OPACITY_25, withOpacity,
} from '@/lib/chart-colors';
import { auditPromptString, summarizeAudit, type PromptAuditRow } from '@/lib/prompts/prompt-builder';
import { CodeBlock } from './CodeBlock';

/**
 * Audit-chip + collapsible composed-prompt panel. Turns the otherwise-invisible
 * prompt that was sent to the LLM into an inspectable, teachable surface so
 * users can see at a glance which structural sections their forge call actually
 * carried.
 *
 * Colors follow the canonical status vocabulary (chart-colors): present = green,
 * missing-required = amber, missing-optional = neutral zinc.
 */
function chipStyle(row: PromptAuditRow): React.CSSProperties {
  if (row.present) {
    return {
      background: withOpacity(STATUS_SUCCESS, OPACITY_15),
      color: STATUS_SUCCESS,
      border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}`,
    };
  }
  if (row.required) {
    return {
      background: withOpacity(STATUS_WARNING, OPACITY_15),
      color: STATUS_WARNING,
      border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_25)}`,
    };
  }
  return {
    background: withOpacity(STATUS_NEUTRAL, OPACITY_15),
    color: STATUS_NEUTRAL,
    border: `1px solid ${withOpacity(STATUS_NEUTRAL, OPACITY_25)}`,
  };
}

export function PromptInspector({ prompt }: { prompt: string | null }) {
  const [open, setOpen] = useState(false);
  if (!prompt) return null;
  const rows = auditPromptString(prompt);
  const summary = summarizeAudit(rows);
  const missingRequired = rows.some((r) => r.required && !r.present);

  return (
    <section
      aria-label="Prompt Inspector"
      className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="prompt-inspector-body"
        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900/60 transition-colors"
      >
        <Eye size={14} className="flex-shrink-0" />
        <span className="font-mono uppercase tracking-[0.15em]">Prompt Inspector</span>
        <span className={`flex-1 text-left truncate ${missingRequired ? 'text-amber-400' : ''}`}>
          {summary}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>

      {/* Chip strip is always visible — it's the one-glance signal. */}
      <div role="list" aria-label="Prompt sections" className="flex flex-wrap gap-1.5 px-3 pb-2">
        {rows.map((row) => (
          <span
            key={row.section}
            role="listitem"
            data-section={row.section}
            data-state={row.present ? 'present' : row.required ? 'missing-required' : 'missing-optional'}
            title={row.present
              ? `${row.label} present`
              : row.required
                ? `${row.label} missing (required)`
                : `${row.label} not used (optional)`}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono"
            style={chipStyle(row)}
          >
            {row.present && <Check size={10} strokeWidth={3} />}
            {row.label}
          </span>
        ))}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="prompt-inspector-body"
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="border-t border-zinc-800 p-3">
              <CodeBlock code={prompt} filename="composed prompt" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
