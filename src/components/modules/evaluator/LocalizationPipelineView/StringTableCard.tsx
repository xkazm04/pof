import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Table2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import type { StringTable } from '@/types/localization-pipeline';
import { FOCUS_RING_CLASS } from '@/lib/ui/focus-ring';
import { CopyTextButton } from './CopyTextButton';

export function StringTableCard({ table }: { table: StringTable }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `loc-table-${table.tableId}`;

  const csvContent = useMemo(() => {
    const header = 'Key,SourceString,Comment';
    // RFC 4180: a quote inside a quoted field is doubled, or UE's CSV import splits the row.
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = table.rows.map((r) => [r.key, r.sourceString, r.comment].map(cell).join(','));
    return [header, ...rows].join('\n');
  }, [table]);

  return (
    <SurfaceCard>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={`flex items-center gap-2 flex-1 min-w-0 text-left rounded ${FOCUS_RING_CLASS}`}
        >
          <Table2 aria-hidden="true" className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text truncate">{table.tableId}</p>
            <p className="text-2xs text-text-muted truncate">{table.namespace} — {table.rows.length} entries</p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <CopyTextButton text={csvContent} label="Copy CSV" />
          {expanded ? <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-2xs">
                  <thead>
                    <tr className="text-left text-text-muted">
                      <th className="pb-1.5 pr-4 font-medium">Key</th>
                      <th className="pb-1.5 pr-4 font-medium">Source String</th>
                      <th className="pb-1.5 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.key} className="border-t border-border/50">
                        <td className="py-1 pr-4 text-text-muted font-mono">{row.key}</td>
                        <td className="py-1 pr-4 text-text">{row.sourceString}</td>
                        <td className="py-1 text-text-muted">{row.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
