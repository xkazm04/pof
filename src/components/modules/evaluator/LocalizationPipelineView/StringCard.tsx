import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { LocalizableString } from '@/types/localization-pipeline';
import { CONTEXT_LABELS } from '@/lib/localization/definitions';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { SCALE } from './constants';

export function StringCard({ str }: { str: LocalizableString }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `loc-string-${str.id}`;

  return (
    <SurfaceCard level={2}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex items-start gap-2 w-full text-left rounded-md ${FOCUS_RING_CLASS}`}
      >
        {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`${SCALE.body} font-medium truncate`}>&quot;{str.sourceText}&quot;</span>
            <Badge variant={str.currentUsage === 'nsloctext' || str.currentUsage === 'loctext' ? 'success' : str.currentUsage === 'hardcoded' ? 'error' : 'warning'}>
              {str.currentUsage}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xs text-text-muted">{CONTEXT_LABELS[str.context]}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{str.sourceModule}</span>
            <span className="text-2xs text-text-muted">·</span>
            <span className="text-2xs text-text-muted">{str.locNamespace}/{str.locKey}</span>
          </div>
        </div>
        <span className="text-2xs text-text-muted shrink-0">{Math.round(str.detectionConfidence * 100)}%</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border">
              {str.locations.map((loc, i) => (
                <div key={i} className="text-2xs">
                  <span className="text-text-muted">{loc.filePath}:{loc.lineNumber}</span>
                  <pre className="mt-1 p-2 rounded bg-surface text-text-muted overflow-x-auto text-xs leading-relaxed">
                    {loc.codeSnippet}
                  </pre>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
