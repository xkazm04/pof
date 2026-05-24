'use client';

import { useState, useMemo } from 'react';
import { GitCompare } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR, ACCENT_CYAN,
  withOpacity, OPACITY_10, OPACITY_25, OPACITY_8,
} from '@/lib/chart-colors';

export function CodePreview({ code, prevCode }: { code: string; prevCode: string | null }) {
  const [showDiff, setShowDiff] = useState(false);

  const diffLines = useMemo(() => {
    if (!prevCode || !showDiff) return null;
    const oldLines = prevCode.split('\n');
    const newLines = code.split('\n');
    const m = oldLines.length;
    const n = newLines.length;

    // LCS DP table (bottom-up)
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    // Walk the table to produce ordered diff
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
    <div className="space-y-1.5">
      {prevCode && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-medium"
            style={{
              backgroundColor: showDiff ? `${withOpacity(ACCENT_CYAN, OPACITY_10)}` : 'transparent',
              color: showDiff ? ACCENT_CYAN : 'var(--text-muted)',
              border: `1px solid ${showDiff ? withOpacity(ACCENT_CYAN, OPACITY_25) : 'var(--border)'}`,
            }}
          >
            <GitCompare className="w-3 h-3" />
            {showDiff ? 'Hide Diff' : 'Show Diff'}
          </button>
        </div>
      )}

      <div className="max-h-[300px] overflow-auto custom-scrollbar rounded-lg border border-border/40 bg-[#0a0a15]">
        <pre className="text-2xs font-mono leading-relaxed p-2.5">
          {diffLines ? (
            diffLines.map((d, i) => (
              <div
                key={i}
                className="px-1"
                style={{
                  backgroundColor: d.type === 'added' ? `${withOpacity(STATUS_SUCCESS, OPACITY_8)}` : d.type === 'removed' ? `${withOpacity(STATUS_ERROR, OPACITY_8)}` : 'transparent',
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
    </div>
  );
}
