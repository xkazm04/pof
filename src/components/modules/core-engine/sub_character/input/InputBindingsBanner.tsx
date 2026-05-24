'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  STATUS_ERROR, STATUS_SUCCESS, OPACITY_5, OPACITY_15, OPACITY_20, withOpacity,
} from '@/lib/chart-colors';

interface Props {
  conflicts: Map<string, string[]>;
  totalBindings: number;
}

/** Status banner for the input bindings table: red if any key collides, green otherwise. */
export function InputBindingsBanner({ conflicts, totalBindings }: Props) {
  if (conflicts.size > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-start gap-2.5 p-3 rounded-lg border mb-4 relative overflow-hidden"
        style={{
          borderColor: withOpacity(STATUS_ERROR, OPACITY_20),
          backgroundColor: withOpacity(STATUS_ERROR, OPACITY_5),
        }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
          style={{
            background: `repeating-linear-gradient(180deg, ${STATUS_ERROR} 0px, ${STATUS_ERROR} 4px, transparent 4px, transparent 8px)`,
          }}
        />
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 ml-1" style={{ color: STATUS_ERROR }} />
        <div>
          <div className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: STATUS_ERROR }}>
            {conflicts.size} Conflict{conflicts.size > 1 ? 's' : ''} Detected
          </div>
          <div className="text-xs text-text-muted mt-1 space-y-0.5 font-mono">
            {Array.from(conflicts.entries()).map(([key, actions]) => (
              <div key={key}>
                <span className="font-bold" style={{ color: STATUS_ERROR }}>{key}</span>
                <span className="text-text-muted"> → </span>
                {actions.join(', ')}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2.5 p-3 rounded-lg border mb-4"
      style={{
        borderColor: withOpacity(STATUS_SUCCESS, OPACITY_15),
        backgroundColor: withOpacity(STATUS_SUCCESS, OPACITY_5),
      }}
    >
      <ShieldCheck className="w-4 h-4 flex-shrink-0" style={{ color: STATUS_SUCCESS }} />
      <div>
        <span className="text-xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>No Conflicts</span>
        <span className="text-xs font-mono text-text-muted ml-2">
          {totalBindings} actions with unique bindings
        </span>
      </div>
    </motion.div>
  );
}
