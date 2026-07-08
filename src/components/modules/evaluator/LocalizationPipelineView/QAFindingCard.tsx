import { useState, useCallback } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronRight, Copy, Check,
  ShieldAlert, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import type { TranslationQAFinding } from '@/types/localization-pipeline';
import { SUPPORTED_LOCALES, QA_CHECKS } from '@/lib/localization/definitions';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT_EMERALD, SEVERITY_TOKENS } from '@/lib/chart-colors';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { SCALE, SEVERITY_BADGE } from './constants';

export function QAFindingCard({ finding }: { finding: TranslationQAFinding }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = SEVERITY_TOKENS[finding.severity];
  const meta = QA_CHECKS[finding.check];
  const locInfo = SUPPORTED_LOCALES.find((l) => l.code === finding.locale);
  const panelId = `loc-qa-${finding.id}`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(finding.fixPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [finding.fixPrompt]);

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
          {finding.severity === 'critical' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : finding.severity === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          ) : (
            <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: token.color }} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${SCALE.body} font-medium`}>{meta.label}</span>
              <Badge variant={SEVERITY_BADGE[finding.severity]}>{finding.severity}</Badge>
              <span className="text-2xs text-text-muted">{locInfo?.nativeName ?? finding.locale}</span>
            </div>
            <p className="text-2xs text-text-muted mt-0.5">{finding.message}</p>
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
                  <p className="text-2xs font-medium text-text mb-1">Source:</p>
                  <p dir="ltr" className="text-2xs text-text-muted">&quot;{finding.sourceText}&quot;</p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Translation:</p>
                  <p dir={locInfo?.direction ?? 'ltr'} lang={finding.locale} className="text-2xs text-text-muted">
                    &quot;{finding.translatedText}&quot;
                  </p>
                </div>
                <div>
                  <p className="text-2xs font-medium text-text mb-1">Suggestion:</p>
                  <p className="text-2xs text-text-muted">{finding.suggestion}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs bg-surface hover:bg-surface-2 text-text-muted transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" style={{ color: ACCENT_EMERALD }} /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy fix prompt'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SurfaceCard>
  );
}
