'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

export function SettingTooltip({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => { clearTimeout(timeout.current); setOpen(true); };
  const hide = () => { timeout.current = setTimeout(() => setOpen(false), 120); };

  return (
    <span
      className="focus-ring rounded-full relative inline-flex ml-1 cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      role="button"
      aria-label="Show guidance"
    >
      <Info className="w-3 h-3 text-text-muted hover:text-text transition-colors" />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2.5 rounded-lg bg-surface-overlay border border-border shadow-lg pointer-events-none"
          >
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line} className="text-2xs text-text-muted leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-surface-overlay border-r border-b border-border" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
