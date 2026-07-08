import {
  History, GitBranch, RotateCcw, CheckCircle2, GitCompareArrows,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/Badge';
import type { VariantLineageNode } from '@/types/prompt-evolution';
import { ACCENT, STYLE_COLOR } from './constants';
import { StatsBadge } from './StatsBadge';

// ── One row in the lineage tree ──────────────────────────────────────────────

export function VersionNode({
  node,
  compareSlot,
  onToggleCompare,
  onRestore,
  isRestoring,
}: {
  node: VariantLineageNode;
  /** 1 or 2 if this node is picked for compare; 0 otherwise. */
  compareSlot: number;
  onToggleCompare: (id: string) => void;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}) {
  const { variant, stats, isActive } = node;
  const styleColor = STYLE_COLOR[variant.style];
  const picked = compareSlot > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        data-testid={`version-node-${variant.id}`}
        data-active={isActive ? 'true' : 'false'}
        className="flex items-start gap-2 py-1.5"
        style={{ paddingLeft: node.depth * 18 }}
      >
        {/* Lineage glyph */}
        <span className="mt-0.5 flex-shrink-0" aria-hidden>
          {node.depth > 0
            ? <GitBranch className="w-3.5 h-3.5 text-text-muted/60" />
            : <History className="w-3.5 h-3.5 text-text-muted/60" />}
        </span>

        <div
          className="flex-1 min-w-0 rounded-md border p-2.5"
          style={{
            borderColor: picked ? ACCENT : isActive ? `${ACCENT}66` : 'var(--border)',
            backgroundColor: isActive ? `${ACCENT}0d` : undefined,
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: styleColor }} />
            <span className="text-xs font-medium text-text truncate">{variant.label}</span>
            {isActive && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded"
                style={{ color: ACCENT, backgroundColor: `${ACCENT}1a` }}
                data-testid="current-badge"
              >
                <CheckCircle2 className="w-3 h-3" /> current
              </span>
            )}
            <span
              className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded border"
              style={{ borderColor: styleColor, color: styleColor }}
            >
              {variant.style}
            </span>
            {variant.mutationType && (
              <Badge variant="default" className="text-[11px]">{variant.mutationType}</Badge>
            )}
            <StatsBadge stats={stats} />
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="text-2xs text-text-muted">
              {variant.origin} · {new Date(variant.createdAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onToggleCompare(variant.id)}
                aria-pressed={picked}
                data-testid={`compare-${variant.id}`}
                className={`focus-ring inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                  picked ? 'text-white' : 'border-border text-text-muted hover:text-text'
                }`}
                style={picked ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                <GitCompareArrows className="w-3 h-3" />
                {picked ? `Compare ${compareSlot}` : 'Compare'}
              </button>
              <button
                onClick={() => onRestore(variant.id)}
                disabled={isActive || isRestoring}
                data-testid={`restore-${variant.id}`}
                title={isActive ? 'Already the current version' : 'Restore this version'}
                className="focus-ring inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-border text-text-muted hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
