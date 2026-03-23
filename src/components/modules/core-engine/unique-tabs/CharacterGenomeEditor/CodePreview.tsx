'use client';

import { useState, useCallback } from 'react';
import { Code2, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS } from '@/lib/chart-colors';
import { ACCENT } from './field-data';

/* ── Code Preview Modal ────────────────────────────────────────────────── */

export function CodePreview({ code, title, onClose }: {
  code: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-surface-deep border border-border/60 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm font-bold text-text">{title}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors"
            style={{
              borderColor: copied ? `${STATUS_SUCCESS}50` : `${ACCENT}40`,
              backgroundColor: copied ? `${STATUS_SUCCESS}15` : `${ACCENT}10`,
              color: copied ? STATUS_SUCCESS : ACCENT,
            }}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-muted leading-relaxed custom-scrollbar whitespace-pre">
          {code}
        </pre>
      </motion.div>
    </motion.div>
  );
}
