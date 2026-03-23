'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { UI_TIMEOUTS } from '@/lib/constants';

/* ── Code block with copy button ─────────────────────────────────────── */

export function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [code]);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-400">
          {filename}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed text-zinc-300 overflow-x-auto max-h-[400px] overflow-y-auto font-mono bg-zinc-950/50">
        {code}
      </pre>
    </div>
  );
}
