import { useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight,
  ShieldAlert, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { LocalizationHazard } from '@/types/localization-pipeline';
import { SEVERITY_TOKENS } from '@/lib/chart-colors';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { SCALE, SEVERITY_BADGE } from './constants';
import { CopyTextButton } from './CopyTextButton';

export function HazardCard({ hazard }: { hazard: LocalizationHazard }) {
  const [expanded, setExpanded] = useState(false);
  const token = SEVERITY_TOKENS[hazard.severity];
  const panelId = `loc-hazard-${hazard.id}`;

  return (
    <SurfaceCard level={2}>
      <div className="rounded-md border p-3" style={{ backgroundColor: token.bg, borderColor: token.border }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex items-start gap-2 w-full text-left rounded ${FOCUS_RING_CLASS}`}
        >
          {hazard.severity === 'critical' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : hazard.severity === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`${SCALE.body} font-medium`}>{hazard.type.replace(/_/g, ' ')}</span>
              <Badge variant={SEVERITY_BADGE[hazard.severity]}>{hazard.severity}</Badge>
            </div>
            <p className="text-2xs text-text-muted mt-0.5">{hazard.description}</p>
          </div>
          {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" />}
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
              <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Suggestion:</p>
                  <p className="text-2xs text-text-muted">{hazard.suggestion}</p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Location:</p>
                  <p className="text-2xs text-text-muted">{hazard.location.filePath}:{hazard.location.lineNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <CopyTextButton text={hazard.fixPrompt} label="Copy fix prompt" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SurfaceCard>
  );
}
