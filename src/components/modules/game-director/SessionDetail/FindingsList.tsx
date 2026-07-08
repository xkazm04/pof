import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Wrench, Sparkles } from 'lucide-react';
import type { PlaytestFinding } from '@/types/game-director';
import { SEVERITY_TOKENS, CATEGORY_LABELS, severitySurface } from '@/lib/game-director-styles';
import { SeverityLegend } from '@/components/modules/game-director/SeverityLegend';
import { FindingFixButton } from '@/components/modules/game-director/FindingFixButton';

export function FindingsList({ findings, expandedId, onToggle, onFixDispatched }: {
  findings: PlaytestFinding[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onFixDispatched: (finding: PlaytestFinding) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="w-6 h-6 text-border-bright mb-2" />
        <p className="text-xs text-text-muted">No findings yet. Run a playtest to generate findings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SeverityLegend className="mb-1" />
      {findings.map((finding, idx) => {
        const token = SEVERITY_TOKENS[finding.severity];
        const surface = severitySurface(finding.severity);
        const Icon = token.icon;
        const isExpanded = expandedId === finding.id;
        const catLabel = CATEGORY_LABELS[finding.category] ?? finding.category;

        return (
          <motion.div
            key={finding.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: idx * 0.02 }}
            className="rounded-lg border overflow-hidden"
            style={surface}
          >
            <div className="flex items-stretch">
              <button
                onClick={() => onToggle(finding.id)}
                aria-expanded={isExpanded}
                className="focus-ring-inset rounded-l-lg flex-1 min-w-0 text-left flex items-start gap-3 px-3.5 py-3 hover:brightness-110 transition-colors"
              >
                <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: token.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-text">{finding.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted">{catLabel}</span>
                    {finding.relatedModule && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-border text-text-muted-hover">{finding.relatedModule}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted-hover leading-relaxed line-clamp-2">{finding.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-2xs text-text-muted">{finding.confidence}%</span>
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted" />
                  )}
                </div>
              </button>
              {/* Positive findings are praise, not bugs — no repair task offered. */}
              {finding.severity !== 'positive' && (
                <div className="flex items-center pr-3 pl-2 flex-shrink-0">
                  <FindingFixButton finding={finding} onDispatched={onFixDispatched} />
                </div>
              )}
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="px-3.5 pb-3 pt-1 border-t" style={{ borderColor: surface.borderColor }}>
                    {finding.suggestedFix && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wrench className="w-3 h-3 text-text-muted" />
                          <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold">Suggested Fix</span>
                        </div>
                        <p className="text-sm text-text-muted-hover leading-relaxed pl-4.5">{finding.suggestedFix}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-2xs text-text-muted">
                      {finding.gameTimestamp != null && (
                        <span>Game time: {finding.gameTimestamp}s</span>
                      )}
                      <span>Confidence: {finding.confidence}%</span>
                      <span className="capitalize">{finding.severity}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
