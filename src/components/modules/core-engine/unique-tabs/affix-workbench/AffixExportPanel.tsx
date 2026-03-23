'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, Copy, Check } from 'lucide-react';
import { STATUS_SUCCESS, OPACITY_10, OPACITY_20 } from '@/lib/chart-colors';

interface AffixExportPanelProps {
  visible: boolean;
  exportCode: string;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  accentColor: string;
}

export function AffixExportPanel({
  visible, exportCode, onCopy, onDownload, copied, accentColor,
}: AffixExportPanelProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-border bg-surface-deep overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <span className="text-xs font-bold text-text flex items-center gap-2">
                <Download className="w-3.5 h-3.5" style={{ color: STATUS_SUCCESS }} />
                UE5 C++ Export — Pre-rolled ItemInstance
              </span>
              <div className="flex items-center gap-2">
                <button onClick={onCopy} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: copied ? `${STATUS_SUCCESS}${OPACITY_20}` : `${accentColor}${OPACITY_10}`, color: copied ? STATUS_SUCCESS : accentColor }}>
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={onDownload} className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}>
                  <Download className="w-3 h-3" /> .cpp
                </button>
              </div>
            </div>
            <pre className="p-4 text-[11px] font-mono text-text-muted leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre">
              {exportCode}
            </pre>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
