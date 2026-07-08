'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function RawLogBlock({ rawLog }: { rawLog: string }) {
  return (
    <div>
      <p className="text-2xs font-medium text-text mb-1 flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> Raw Log
      </p>
      <pre className="text-xs leading-relaxed p-3 rounded-md border border-border bg-surface text-text-muted overflow-x-auto max-h-48 overflow-y-auto">
        {rawLog}
      </pre>
    </div>
  );
}

/** Standalone raw-log disclosure used in Technical mode (its own toggle). */
export function RawLogDisclosure({ rawLog }: { rawLog: string }) {
  const [showRawLog, setShowRawLog] = useState(false);
  return (
    <>
      <button
        onClick={() => setShowRawLog(!showRawLog)}
        className="flex items-center gap-1.5 text-2xs text-text-muted hover:text-text transition-colors"
      >
        <FileText className="w-3 h-3" />
        {showRawLog ? 'Hide' : 'Show'} Raw Log
        {showRawLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      <AnimatePresence>
        {showRawLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre className="text-xs leading-relaxed p-3 rounded-md border border-border bg-surface text-text-muted overflow-x-auto max-h-48 overflow-y-auto">
              {rawLog}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
