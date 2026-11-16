'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Table, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { copyToClipboard } from '@/lib/clipboard';
import { UI_TIMEOUTS } from '@/lib/constants';
import { ACCENT } from '../_shared/data';
import { BlueprintPanel, SectionHeader } from '../../unique-tabs/_design';
import {
  ATTRIBUTE_FIELDS, DEFAULT_ATTRIBUTE_ROWS, buildAttributeDefaultsPython,
  type AttributeRow,
} from './attribute-defaults-export';

export function AttributeDefaultsTab() {
  const [rows, setRows] = useState<AttributeRow[]>(() =>
    DEFAULT_ATTRIBUTE_ROWS.map((r) => ({ rowName: r.rowName, values: { ...r.values } })));
  // Feedback follows the verified write: 'failed' when the clipboard rejects.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const script = useMemo(() => buildAttributeDefaultsPython(rows), [rows]);

  const setValue = useCallback((rowName: string, field: string, value: number) => {
    setRows((prev) => prev.map((r) =>
      r.rowName === rowName ? { ...r, values: { ...r.values, [field]: value } } : r));
  }, []);

  const copyScript = useCallback(async () => {
    setCopyState((await copyToClipboard(script)) ? 'copied' : 'failed');
  }, [script]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const t = setTimeout(() => setCopyState('idle'), UI_TIMEOUTS.copyFeedback);
    return () => clearTimeout(t);
  }, [copyState]);

  return (
    <motion.div data-testid="combat-attribute-defaults" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <BlueprintPanel color={ACCENT} className="p-3 overflow-x-auto">
        <SectionHeader label="Attribute Defaults (DT_AttributeDefaults)" color={ACCENT} icon={Table} />
        <table className="w-full text-xs font-mono mt-2">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left pr-2">Attribute</th>
              {rows.map((r) => <th key={r.rowName} className="px-2 text-right">{r.rowName}</th>)}
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTE_FIELDS.map((field) => (
              <tr key={field} className="border-t border-border/30">
                <td className="pr-2 py-0.5">{field}</td>
                {rows.map((r) => (
                  <td key={r.rowName} className="px-2 py-0.5 text-right">
                    <input
                      type="number"
                      aria-label={`${r.rowName} ${field}`}
                      value={r.values[field] ?? 0}
                      onChange={(e) => setValue(r.rowName, field, Number(e.target.value))}
                      className="w-16 bg-surface/60 rounded px-1 text-right"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </BlueprintPanel>

      <BlueprintPanel color={ACCENT} className="p-3">
        <div className="flex items-center justify-between mb-2">
          <SectionHeader label="UE Python — create DT_AttributeDefaults" color={ACCENT} icon={Table} />
          <button onClick={() => { void copyScript(); }} aria-live="polite" className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border border-border/50 hover:bg-surface/50 cursor-pointer">
            {copyState === 'copied' ? <Check className="w-3 h-3" aria-hidden /> : <Copy className="w-3 h-3" aria-hidden />}
            {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
        </div>
        <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto text-text-muted">{script}</pre>
      </BlueprintPanel>
    </motion.div>
  );
}
