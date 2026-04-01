'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Code, X } from 'lucide-react';
import type { EliteModifier } from './data';
import { generateModifierGE } from './data';

interface CodegenModalProps {
  mod: EliteModifier | null;
  onClose: () => void;
}

export function CodegenModal({ mod, onClose }: CodegenModalProps) {
  return (
    <AnimatePresence>
      {mod && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4" style={{ color: mod.color }} />
                <span className="text-sm font-bold text-text">
                  UE5 GameplayEffect — {mod.name}
                </span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full border"
                  style={{
                    backgroundColor: `${mod.color}15`,
                    borderColor: `${mod.color}40`,
                    color: mod.color,
                  }}
                >
                  {mod.icon} {mod.tier}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(generateModifierGE(mod))}
                  className="text-xs font-bold px-2 py-1 rounded border border-border/40 bg-surface-deep hover:bg-surface-hover transition-colors text-text-muted hover:text-text flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-text transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <pre className="text-xs font-mono text-text-muted leading-relaxed whitespace-pre-wrap">
                {generateModifierGE(mod)}
              </pre>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
