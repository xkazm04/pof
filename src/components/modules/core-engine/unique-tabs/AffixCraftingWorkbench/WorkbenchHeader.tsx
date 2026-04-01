'use client';

import {
  Hammer, RotateCcw, Shuffle, Download, Send, Check, Loader2, Table2,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_INFO,
  ACCENT_VIOLET, ACCENT_CYAN,
  OPACITY_10, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from '../_design';
import { ACCENT } from './constants';
import type { ViewMode } from './types';

interface WorkbenchHeaderProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onRandomRoll: () => void;
  onClear: () => void;
  showExport: boolean;
  onToggleExport: () => void;
  onInjectToUE5: () => void;
  ue5Status: string;
  craftedAffixCount: number;
  injectStatus: 'idle' | 'sending' | 'success' | 'error';
  injectError: string | null;
}

export function WorkbenchHeader({
  viewMode, setViewMode, onRandomRoll, onClear,
  showExport, onToggleExport, onInjectToUE5,
  ue5Status, craftedAffixCount, injectStatus, injectError,
}: WorkbenchHeaderProps) {
  const injectColor = injectStatus === 'success' ? STATUS_SUCCESS
    : injectStatus === 'error' ? STATUS_ERROR : ACCENT_CYAN;

  return (
    <>
      <BlueprintPanel color={ACCENT} className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SectionHeader label="Affix Crafting Workbench" color={ACCENT} icon={Hammer} />
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border overflow-hidden"
              style={{ borderColor: `${ACCENT}25` }}>
              <button onClick={() => setViewMode('workbench')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-[0.15em] transition-all"
                style={{
                  backgroundColor: viewMode === 'workbench' ? `${ACCENT}${OPACITY_20}` : 'transparent',
                  color: viewMode === 'workbench' ? ACCENT : 'var(--text-muted)',
                }}>
                <Hammer className="w-3 h-3" /> Workbench
              </button>
              <button onClick={() => setViewMode('breakpoints')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono uppercase tracking-[0.15em] transition-all"
                style={{
                  backgroundColor: viewMode === 'breakpoints' ? `${STATUS_INFO}${OPACITY_20}` : 'transparent',
                  color: viewMode === 'breakpoints' ? STATUS_INFO : 'var(--text-muted)',
                  borderLeft: `1px solid ${ACCENT}25`,
                }}>
                <Table2 className="w-3 h-3" /> Breakpoints
              </button>
            </div>

            {viewMode === 'workbench' && (
              <>
                <button onClick={onRandomRoll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.15em] transition-all"
                  style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, color: ACCENT_VIOLET, border: `1px solid ${ACCENT_VIOLET}${OPACITY_30}` }}>
                  <Shuffle className="w-3 h-3" /> Random Roll
                </button>
                <button onClick={onClear}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text transition-colors"
                  style={{ border: `1px solid ${ACCENT}25` }}>
                  <RotateCcw className="w-3 h-3" />
                </button>
                <button onClick={onToggleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.15em] transition-all"
                  style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}${OPACITY_20}` }}>
                  <Download className="w-3 h-3" /> Export C++
                </button>
                <button onClick={onInjectToUE5}
                  disabled={ue5Status !== 'connected' || craftedAffixCount === 0 || injectStatus === 'sending'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.15em] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: `${injectColor}${OPACITY_10}`, color: injectColor, border: `1px solid ${injectColor}${OPACITY_20}` }}
                  title={ue5Status !== 'connected' ? 'Connect to UE5 in Project Setup first' : craftedAffixCount === 0 ? 'Add affixes to the item first' : 'Inject this item into the running PIE session'}>
                  {injectStatus === 'sending' ? <Loader2 className="w-3 h-3 animate-spin" /> : injectStatus === 'success' ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                  {injectStatus === 'sending' ? 'Sending...' : injectStatus === 'success' ? 'Injected!' : injectStatus === 'error' ? 'Failed' : 'Send to UE5'}
                </button>
              </>
            )}
          </div>
        </div>
      </BlueprintPanel>

      {/* UE5 Inject Error Banner */}
      <AnimatePresence>
        {injectStatus === 'error' && injectError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono"
              style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_10}`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}${OPACITY_20}` }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{injectError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
