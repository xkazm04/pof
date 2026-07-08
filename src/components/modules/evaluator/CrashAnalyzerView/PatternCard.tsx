'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { DecoratedCrashText } from '@/components/ui/CrashTerm';
import { formatTimeAgo } from '@/lib/format-time';
import { plainCrashType } from '@/lib/crash-glossary';
import type { CrashPattern } from '@/types/crash-analyzer';

export function PatternCard({ pattern, plainMode }: { pattern: CrashPattern; plainMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const plain = plainCrashType(pattern.crashType);

  return (
    <SurfaceCard>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {pattern.isSystemic ? (
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        ) : (
          <TrendingUp className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-text">{pattern.name}</span>
            {pattern.isSystemic && <Badge variant="error">systemic</Badge>}
            <Badge variant="warning">{pattern.occurrences}x</Badge>
            {plainMode && <span className="text-2xs text-text-muted">{plain.label}</span>}
          </div>
          <p className="text-2xs text-text-muted mt-0.5">
            <DecoratedCrashText text={pattern.description} />
          </p>
          {plainMode && (
            <p className="text-2xs text-text-muted/80 mt-0.5 italic">{plain.fix}</p>
          )}
        </div>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-border space-y-2">
              <div>
                <p className="text-2xs font-medium text-text">Root Cause</p>
                <p className="text-2xs text-text-muted"><DecoratedCrashText text={pattern.rootCause} /></p>
              </div>
              <div>
                <p className="text-2xs font-medium text-text">Signature Functions</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pattern.signatureFunctions.map((fn) => (
                    <span key={fn} className="px-1.5 py-0.5 rounded text-xs bg-surface-2 text-text-muted font-mono">
                      {fn}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-2xs text-text-muted">
                <span>Crash IDs: {pattern.crashIds.join(', ')}</span>
                <span>First: {formatTimeAgo(pattern.firstSeen)}</span>
                <span>Last: {formatTimeAgo(pattern.lastSeen)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
