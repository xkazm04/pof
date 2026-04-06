'use client';

import { useState, useCallback } from 'react';
import { Upload, X, AlertTriangle, Check, ClipboardPaste } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR,
  withOpacity, OPACITY_10, OPACITY_8, OPACITY_20, OPACITY_12, OPACITY_25,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import type { SimScenario } from './data';
import { ACCENT, decodeScenario } from './data';

export function ImportScenarioModal({ onImport, onClose }: {
  onImport: (scenario: SimScenario) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SimScenario | null>(null);

  const handleValidate = useCallback(() => {
    if (!input.trim()) { setError('Paste a scenario code first.'); setPreview(null); return; }
    const result = decodeScenario(input);
    if (result.ok) { setError(null); setPreview(result.scenario); }
    else { setError(result.error); setPreview(null); }
  }, [input]);

  const handleApply = useCallback(() => {
    if (preview) onImport({ ...preview, id: `imported-${Date.now()}` });
  }, [preview, onImport]);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }} onClick={e => e.stopPropagation()}
          className="w-full max-w-lg mx-4">
          <BlueprintPanel color={ACCENT} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundColor: ACCENT }} />
                  <Upload className="w-4 h-4 relative z-10" style={{ color: ACCENT }} />
                </div>
                <span className="text-sm font-bold text-text">Import Scenario</span>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-surface-2 text-text-muted hover:text-text transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-2xs text-text-muted">
              Paste a base64 scenario code below. Click Validate to preview, then Apply to load it.
            </p>

            {/* Textarea */}
            <textarea value={input}
              onChange={e => { setInput(e.target.value); setError(null); setPreview(null); }}
              placeholder="Paste scenario code here..." rows={4}
              className="w-full rounded-lg border bg-surface-1 text-xs text-text font-mono p-2.5 resize-none focus:outline-none focus:ring-1 transition-colors"
              style={{
                borderColor: error ? STATUS_ERROR : preview ? STATUS_SUCCESS : 'var(--color-border)',
                ...(error ? { focusRingColor: STATUS_ERROR } : {}),
              }}
              spellCheck={false} />

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-2xs px-2 py-1 rounded-md"
                style={{ backgroundColor: `${withOpacity(STATUS_ERROR, OPACITY_10)}`, color: STATUS_ERROR }}>
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {error}
              </motion.div>
            )}

            {/* Preview */}
            {preview && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-md px-2.5 py-2 space-y-0.5 text-2xs"
                style={{ backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_8)}`, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_20)}` }}>
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: STATUS_SUCCESS }}>
                  <Check className="w-3 h-3" /> Valid Scenario
                </div>
                <div className="text-text-muted">
                  <span className="font-medium text-text">{preview.name}</span> — Lv.{preview.player.level} vs {preview.enemies.reduce((s, e) => s + e.count, 0)} enemies, {preview.iterations} iterations
                </div>
              </motion.div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={onClose}
                className="text-2xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
                Cancel
              </button>
              {!preview ? (
                <button onClick={handleValidate} disabled={!input.trim()}
                  className="text-2xs px-3 py-1.5 rounded-md font-semibold transition-all disabled:opacity-40"
                  style={{ backgroundColor: `${withOpacity(ACCENT, OPACITY_12)}`, color: ACCENT, border: `1px solid ${withOpacity(ACCENT, OPACITY_25)}` }}>
                  <span className="flex items-center gap-1"><ClipboardPaste className="w-3 h-3" /> Validate</span>
                </button>
              ) : (
                <button onClick={handleApply}
                  className="text-2xs px-3 py-1.5 rounded-md font-semibold transition-all"
                  style={{ backgroundColor: `${withOpacity(STATUS_SUCCESS, OPACITY_12)}`, color: STATUS_SUCCESS, border: `1px solid ${withOpacity(STATUS_SUCCESS, OPACITY_25)}` }}>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Apply Scenario</span>
                </button>
              )}
            </div>
          </BlueprintPanel>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
