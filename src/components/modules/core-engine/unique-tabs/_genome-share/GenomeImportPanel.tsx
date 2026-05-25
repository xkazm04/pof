'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileUp, Check, AlertTriangle, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import {
  ACCENT_CYAN, ACCENT_EMERALD, STATUS_ERROR, STATUS_WARNING,
  withOpacity, OPACITY_25, OPACITY_10, OPACITY_8,
} from '@/lib/chart-colors';
import { BlueprintPanel } from '../_design';
import { SectionLabel } from '../_shared';
import {
  decodeBuildCode, looksLikeBuildCode, type GenomeCodeKind,
} from '@/lib/genome/build-code';
import {
  diffGenomes, groupDeltas, type DiffFieldSpec, type GenomeFieldDelta,
} from '@/lib/genome/genome-diff';

/* ── Generic Build-Code / JSON Import with Field-Level Diff ─────────────────── *
 * Shared between the Character and Item genome editors. Accepts either a PoF
 * build code (deflate + url-safe base64) or raw genome JSON, validates it
 * through the supplied sanitizer, then previews a field-level diff against the
 * current genome before the user applies it.
 * ────────────────────────────────────────────────────────────────────────── */

type SanitizeResult<T> = { genome: T; warnings: string[] } | { error: string };

interface PendingImport<T> {
  genome: T;
  warnings: string[];
  deltas: GenomeFieldDelta[];
}

interface GenomeImportPanelProps<T> {
  kind: GenomeCodeKind;
  /** Human label for this genome kind, used in copy ("character" / "item"). */
  kindLabel: string;
  accent: string;
  /** Currently-selected genome — the baseline the import is diffed against. */
  baseline: T | undefined;
  baselineName: string;
  getName: (g: T) => string;
  sanitize: (raw: unknown) => SanitizeResult<T>;
  diffSpecs: DiffFieldSpec<T>[];
  /** Apply the validated genome (the editor adds it to its collection). */
  onApply: (genome: T) => void;
  onClose: () => void;
}

const DIRECTION_COLOR = {
  up: ACCENT_EMERALD,
  down: STATUS_WARNING,
  neutral: ACCENT_CYAN,
} as const;

export function GenomeImportPanel<T>({
  kind, kindLabel, accent, baseline, baselineName, getName, sanitize, diffSpecs, onApply, onClose,
}: GenomeImportPanelProps<T>) {
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingImport<T> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runPreview = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    setError('');
    setPending(null);
    if (!text) {
      setError('Paste a build code or genome JSON to import');
      return;
    }

    let parsed: unknown;
    if (looksLikeBuildCode(text)) {
      setBusy(true);
      const decoded = await decodeBuildCode(text);
      setBusy(false);
      if (!decoded.ok) {
        setError(decoded.error);
        return;
      }
      if (decoded.data.kind !== kind) {
        setError(`That is a ${decoded.data.kind} build code — open the ${decoded.data.kind} editor to import it`);
        return;
      }
      parsed = decoded.data.data;
    } else {
      try {
        parsed = JSON.parse(text);
      } catch {
        setError('Not a recognized build code, and not valid JSON');
        return;
      }
    }

    const result = sanitize(parsed);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setPending({
      genome: result.genome,
      warnings: result.warnings,
      deltas: diffGenomes(baseline, result.genome, diffSpecs),
    });
  }, [kind, sanitize, baseline, diffSpecs]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setImportText(ev.target.result);
        void runPreview(ev.target.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [runPreview]);

  const apply = useCallback(() => {
    if (!pending) return;
    onApply(pending.genome);
    setImportText('');
    setPending(null);
    setError('');
    onClose();
  }, [pending, onApply, onClose]);

  const grouped = pending ? groupDeltas(pending.deltas) : [];

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
      <BlueprintPanel color={ACCENT_CYAN} className="p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel icon={Upload} label={`Import ${kindLabel} Genome`} color={ACCENT_CYAN} />
            <button onClick={onClose} className="text-xs text-text-muted hover:text-text">Cancel</button>
          </div>

          {!pending && (
            <>
              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setError(''); }}
                placeholder="Paste a build code (e.g. pofc1.…) or genome JSON here…"
                className="w-full h-24 text-xs font-mono bg-surface-deep border border-border/40 rounded-lg p-2.5 text-text placeholder:text-text-muted/40 focus:outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
              />
              {error && <p className="text-xs font-mono" style={{ color: STATUS_ERROR }}>{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => void runPreview(importText)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors disabled:opacity-50"
                  style={{ borderColor: withOpacity(ACCENT_CYAN, OPACITY_25), backgroundColor: withOpacity(ACCENT_CYAN, OPACITY_10), color: ACCENT_CYAN }}
                >
                  <Eye className="w-3 h-3" /> {busy ? 'Decoding…' : 'Preview Changes'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border/40 text-text-muted hover:text-text transition-colors"
                >
                  <FileUp className="w-3 h-3" /> Import from File
                </button>
                <input ref={fileInputRef} type="file" accept=".json,.txt" className="hidden" onChange={handleFileImport} />
              </div>
            </>
          )}

          {pending && (
            <div className="space-y-3">
              {/* Incoming summary */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-mono">
                <span className="text-text-muted">Importing</span>
                <span className="font-bold" style={{ color: accent }}>{getName(pending.genome)}</span>
                <span className="text-text-muted/60">·</span>
                <span className="text-text-muted">
                  diff vs <span className="text-text">{baselineName}</span>
                </span>
              </div>

              {/* Sanitizer warnings */}
              {pending.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg p-2" style={{ backgroundColor: withOpacity(STATUS_WARNING, OPACITY_8), border: `1px solid ${withOpacity(STATUS_WARNING, OPACITY_25)}` }}>
                  {pending.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs font-mono" style={{ color: STATUS_WARNING }}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Field-level diff */}
              {pending.deltas.length === 0 ? (
                <p className="text-xs font-mono text-text-muted">
                  No stat differences from <span className="text-text">{baselineName}</span> — this imports an identical copy.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {grouped.map(({ group, items }) => (
                    <div key={group} className="space-y-1">
                      <div className="text-xs font-mono uppercase tracking-[0.15em] text-text-muted/70">{group}</div>
                      {items.map((d) => (
                        <div key={`${group}-${d.label}`} className="flex items-center gap-2 text-xs font-mono pl-1">
                          <span className="flex-1 text-text-muted truncate">{d.label}</span>
                          <span className="text-text-muted/50">{d.from}</span>
                          {d.direction === 'up' && <ArrowUp className="w-3 h-3 flex-shrink-0" style={{ color: DIRECTION_COLOR.up }} />}
                          {d.direction === 'down' && <ArrowDown className="w-3 h-3 flex-shrink-0" style={{ color: DIRECTION_COLOR.down }} />}
                          <span className="font-bold" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.to}</span>
                          {d.delta && (
                            <span className="w-16 text-right tabular-nums" style={{ color: DIRECTION_COLOR[d.direction] }}>{d.delta}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={apply}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors"
                  style={{ borderColor: withOpacity(ACCENT_EMERALD, OPACITY_25), backgroundColor: withOpacity(ACCENT_EMERALD, OPACITY_10), color: ACCENT_EMERALD }}
                >
                  <Check className="w-3 h-3" /> Apply {pending.deltas.length > 0 ? `(${pending.deltas.length} change${pending.deltas.length === 1 ? '' : 's'})` : ''}
                </button>
                <button
                  onClick={() => { setPending(null); setError(''); }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border/40 text-text-muted hover:text-text transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </BlueprintPanel>
    </motion.div>
  );
}
