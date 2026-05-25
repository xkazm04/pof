'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Barcode, Check, Copy } from 'lucide-react';
import {
  withOpacity, OPACITY_25, OPACITY_10, OPACITY_8, ACCENT_CYAN,
} from '@/lib/chart-colors';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { copyToClipboard } from '@/lib/clipboard';
import { BlueprintPanel } from '../_design';
import { SectionLabel } from '../_shared';
import { encodeBuildCode, type GenomeCodeKind } from '@/lib/genome/build-code';

/* ── Shareable Build-Code Export ───────────────────────────────────────────── *
 * Encodes a genome into a compact copy-paste build code (deflate + url-safe
 * base64). Two presentations: a compact icon button (for editor header rows)
 * and a fuller panel that reveals the code in a read-only field.
 * ────────────────────────────────────────────────────────────────────────── */

/** Compact icon button: encodes + copies the build code with a copied-flash. */
export function BuildCodeButton({
  kind, genome, color,
}: {
  kind: GenomeCodeKind;
  genome: unknown;
  color: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      const code = await encodeBuildCode(kind, genome);
      if (await copyToClipboard(code)) {
        setCopied(true);
        setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
      }
    } catch (e) {
      logger.warn('Failed to encode genome build code', e);
    }
  }, [kind, genome]);

  return (
    <button
      onClick={handleClick}
      title={copied ? 'Build code copied!' : 'Copy shareable build code'}
      aria-label="Copy shareable build code"
      className="p-1.5 rounded-lg border transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
      style={{ borderColor: withOpacity(color, OPACITY_25), backgroundColor: withOpacity(color, OPACITY_8), color }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Barcode className="w-3.5 h-3.5" />}
    </button>
  );
}

/** Expanded panel: reveals the build code in a read-only field with a copy button. */
export function BuildCodeExportPanel({
  kind, genome, color, onClose,
}: {
  kind: GenomeCodeKind;
  genome: unknown;
  color: string;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    encodeBuildCode(kind, genome)
      .then((c) => { if (active) setCode(c); })
      .catch((e) => { logger.warn('Failed to encode genome build code', e); if (active) setCode(''); });
    return () => { active = false; };
  }, [kind, genome]);

  const copy = useCallback(async () => {
    if (!code) return;
    if (await copyToClipboard(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    }
  }, [code]);

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      <BlueprintPanel color={color} className="p-3">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Barcode} label="Shareable Build Code" color={color} />
            <button onClick={onClose} className="text-xs text-text-muted hover:text-text">Close</button>
          </div>
          <p className="text-xs font-mono text-text-muted/70 leading-relaxed">
            Copy this code into chat or a doc. Anyone can paste it into the importer to load this genome with a field-level diff.
          </p>
          <div className="flex items-stretch gap-2">
            <input
              readOnly
              value={code || 'Encoding…'}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg px-2.5 py-2 text-text focus:outline-none focus:border-blue-500/50 truncate"
            />
            <button
              onClick={copy}
              disabled={!code}
              title={copied ? 'Copied!' : 'Copy build code'}
              aria-label="Copy build code"
              className="flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-bright"
              style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_25), backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_10), color: ACCENT_CYAN }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
