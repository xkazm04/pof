'use client';

import { useCallback } from 'react';
import { CopyButton } from '../_shared';

/* ── Code block with copy button ─────────────────────────────────────── */

export function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const getText = useCallback(() => code, [code]);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
        <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-400">
          {filename}
        </span>
        <CopyButton getText={getText} />
      </div>
      <pre className="p-3 text-xs leading-relaxed text-zinc-300 overflow-x-auto max-h-[400px] overflow-y-auto font-mono bg-zinc-950/50">
        {code}
      </pre>
    </div>
  );
}
