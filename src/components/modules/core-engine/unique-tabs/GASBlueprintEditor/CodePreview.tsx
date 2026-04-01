'use client';

import { useState, useMemo } from 'react';
import { GitCompare } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_CYAN } from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';

export function CodePreview({ code, prevCode }: { code: string; prevCode: string | null }) {
  const [showDiff, setShowDiff] = useState(false);

  const diffLines = useMemo(() => {
    if (!prevCode || !showDiff) return null;
    const oldLines = prevCode.split('\n');
    const newLines = code.split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const result: { line: string; type: 'same' | 'added' | 'removed' }[] = [];
    let i = 0, j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && oldLines[i] === newLines[j]) {
        result.push({ line: oldLines[i], type: 'same' });
        i++; j++;
      } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
        result.push({ line: newLines[j], type: 'added' });
        j++;
      } else {
        result.push({ line: oldLines[i], type: 'removed' });
        i++;
      }
    }
    return result;
  }, [code, prevCode, showDiff]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-1.5"
    >
      {prevCode && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono uppercase tracking-[0.15em]"
            style={{
              backgroundColor: showDiff ? `${ACCENT_CYAN}15` : 'transparent',
              color: showDiff ? ACCENT_CYAN : 'var(--text-muted)',
              border: `1px solid ${showDiff ? `${ACCENT_CYAN}40` : 'var(--border)'}`,
            }}
          >
            <GitCompare className="w-3 h-3" />
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
        </div>
      )}

      <BlueprintPanel color={ACCENT_CYAN} className="p-0" noBrackets>
        <div className="max-h-[300px] overflow-auto custom-scrollbar">
          <pre className="text-2xs font-mono leading-relaxed p-2.5">
            {diffLines ? (
              diffLines.map((d, i) => (
                <div
                  key={i}
                  className="px-1"
                  style={{
                    backgroundColor: d.type === 'added' ? `${STATUS_SUCCESS}10` : d.type === 'removed' ? `${STATUS_ERROR}10` : 'transparent',
                    color: d.type === 'added' ? STATUS_SUCCESS : d.type === 'removed' ? STATUS_ERROR : 'var(--text-muted)',
                  }}
                >
                  <span className="inline-block w-3 text-center opacity-60">{d.type === 'added' ? '+' : d.type === 'removed' ? '-' : ' '}</span>
                  {d.line}
                </div>
              ))
            ) : (
              code.split('\n').map((line, i) => (
                <div key={i} className="text-text-muted">{line}</div>
              ))
            )}
          </pre>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
