import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Crown,
  Copy,
  Check,
} from 'lucide-react';
import type { OverlapPair } from '@/lib/overlap-detection';
import { MOTION } from '@/lib/constants';
import { STATUS_SUCCESS, OPACITY_30 } from '@/lib/chart-colors';
import { REASON_CONFIG } from './constants';
import { moduleLabel, similarityColor } from './helpers';

export function OverlapRow({ overlap, isExpanded, isCopied, onToggle, onCopy }: {
  overlap: OverlapPair;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  const cfg = REASON_CONFIG[overlap.reason];
  const simPct = Math.round(overlap.similarity * 100);
  const simColor = similarityColor(overlap.similarity);

  const toggleLabel = `${isExpanded ? 'Collapse' : 'Expand'} overlap between ${overlap.featureA} (${moduleLabel(overlap.moduleA)}) and ${overlap.featureB} (${moduleLabel(overlap.moduleB)}) — ${simPct}% ${cfg.label}`;

  return (
    <div className={`group rounded-lg overflow-hidden flex items-stretch transition-colors hover:bg-surface-hover ${isExpanded ? 'bg-[#111130]' : ''}`}>
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={toggleLabel}
        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-bright focus-visible:ring-inset"
      >
        {/* Reason dot */}
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />

        {/* Module A → Feature A */}
        <span className="text-xs text-text font-medium truncate min-w-0" style={{ maxWidth: '28%' }}>
          <span className="text-text-muted">{moduleLabel(overlap.moduleA)}</span>
          <span className="text-text-muted mx-1">/</span>
          {overlap.featureA}
        </span>

        {/* Arrow */}
        <span className="flex-shrink-0 text-text-muted">
          <ArrowRight className="w-3 h-3" />
        </span>

        {/* Module B → Feature B */}
        <span className="text-xs text-text font-medium truncate min-w-0" style={{ maxWidth: '28%' }}>
          <span className="text-text-muted">{moduleLabel(overlap.moduleB)}</span>
          <span className="text-text-muted mx-1">/</span>
          {overlap.featureB}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Similarity badge */}
        <span
          className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ backgroundColor: `${simColor}18`, color: simColor }}
        >
          {simPct}%
        </span>

        {/* Reason badge */}
        <span
          className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
        >
          {cfg.label}
        </span>

        {/* Expand */}
        {isExpanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        }
      </button>

      {/* Copy button — sibling of toggle button to avoid nested interactive controls */}
      <button
        onClick={onCopy}
        aria-label={isCopied ? 'Copied overlap details to clipboard' : 'Copy overlap details to clipboard'}
        title={isCopied ? 'Copied!' : 'Copy overlap details'}
        className="px-2 my-1 mr-1 rounded text-text-muted hover:text-text hover:bg-border transition-all opacity-30 scale-95 group-hover:opacity-100 group-hover:scale-100 focus-visible:opacity-100 focus-visible:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-border-bright flex-shrink-0 flex items-center"
      >
        {isCopied ? <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> : <Copy className="w-3 h-3" />}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: MOTION.base }}
          className="border-t border-border bg-surface-deep"
        >
          <div className="grid grid-cols-2 gap-4 p-4">
            {/* Feature A */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {moduleLabel(overlap.moduleA)}
                </span>
              </div>
              <p className="text-xs text-text font-medium mb-1">{overlap.featureA}</p>
              <p className="text-2xs text-text-muted leading-relaxed">{overlap.descriptionA}</p>
            </div>

            {/* Feature B */}
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {moduleLabel(overlap.moduleB)}
                </span>
              </div>
              <p className="text-xs text-text font-medium mb-1">{overlap.featureB}</p>
              <p className="text-2xs text-text-muted leading-relaxed">{overlap.descriptionB}</p>
            </div>
          </div>

          {/* Ownership suggestion */}
          <div className="mx-4 mb-4 px-3 py-2.5 rounded-lg border bg-surface" style={{ borderColor: `${STATUS_SUCCESS}${OPACITY_30}` }}>
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium" style={{ color: STATUS_SUCCESS }}>
                  Suggested owner: {moduleLabel(overlap.suggestedOwner)}
                </span>
                <p className="text-2xs text-text-muted mt-0.5">
                  {overlap.ownershipReason}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
