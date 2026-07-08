import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { ReconciliationSuggestion } from '@/types/gdd-compliance';
import { MODULE_COLORS, STATUS_WARNING } from '@/lib/chart-colors';
import { EFFORT_LABELS } from './constants';

export function SuggestionsPanel({ suggestions }: { suggestions: ReconciliationSuggestion[] }) {
  const { open, toggle, buttonProps, panelProps } = useDisclosure(true);

  const typeConfig: Record<string, { color: string; label: string }> = {
    'update-gdd': { color: MODULE_COLORS.core, label: 'Update GDD' },
    'implement-feature': { color: MODULE_COLORS.content, label: 'Implement' },
  };

  return (
    <div className="border border-border rounded-lg bg-surface">
      <button
        onClick={toggle}
        {...buttonProps}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Lightbulb className="w-4 h-4" style={{ color: STATUS_WARNING }} aria-hidden="true" />
        <span className="text-xs font-semibold text-text flex-1">
          Reconciliation Suggestions ({suggestions.length})
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div {...panelProps} className="border-t border-border">
          {suggestions.map((sug, i) => {
            const cfg = typeConfig[sug.type] ?? { color: 'var(--text-muted)', label: sug.type };
            return (
              <div
                key={sug.id}
                className={`flex items-start gap-3 px-4 py-2.5 ${
                  i < suggestions.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span className="text-2xs text-text-muted mt-0.5 tabular-nums w-4 text-right flex-shrink-0">
                  #{sug.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">{sug.title}</span>
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{
                        color: cfg.color,
                        backgroundColor: `${cfg.color}14`,
                        border: `1px solid ${cfg.color}38`,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">{sug.description}</p>
                </div>
                <span className="text-2xs text-text-muted flex-shrink-0 mt-0.5">
                  {EFFORT_LABELS[sug.effort] ?? sug.effort}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
