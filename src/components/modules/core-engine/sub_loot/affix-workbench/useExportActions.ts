'use client';

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { tryApiFetch } from '@/lib/api-utils';
import { useUE5BridgeStore } from '@/stores/ue5BridgeStore';
import type { InjectItemResponse } from '@/types/ue5-bridge';
import { generateExportCode, getItemLevelScaling } from './data';
import type { CraftedAffix, ItemBase } from './data';

/** Hook for export, clipboard, and UE5 inject functionality. */
export function useExportActions(selectedBase: ItemBase, craftedAffixes: CraftedAffix[], itemLevel: number) {
  const [showExport, setShowExport] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [injectStatus, setInjectStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [injectError, setInjectError] = useState<string | null>(null);
  const ue5Status = useUE5BridgeStore((s) => s.connectionState.status);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateExportCode(selectedBase, craftedAffixes));
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    } catch {
      logger.warn('Clipboard copy failed');
    }
  }, [selectedBase, craftedAffixes]);

  const handleExportFile = useCallback(() => {
    const code = generateExportCode(selectedBase, craftedAffixes);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ItemInstance_${selectedBase.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.cpp`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedBase, craftedAffixes]);

  const handleInjectToUE5 = useCallback(async () => {
    if (craftedAffixes.length === 0) return;
    setInjectStatus('sending');
    setInjectError(null);
    const result = await tryApiFetch<InjectItemResponse>('/api/ue5-inject-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        definitionAsset: `DA_${selectedBase.name.replace(/\s+/g, '_')}`,
        itemLevel,
        affixes: craftedAffixes.map((a) => ({
          tag: a.tag, displayName: a.displayName,
          magnitude: a.magnitude * getItemLevelScaling(itemLevel),
          bIsPrefix: a.bIsPrefix,
        })),
      }),
    });
    if (result.ok) {
      setInjectStatus('success');
      setTimeout(() => setInjectStatus('idle'), 3000);
    } else {
      setInjectStatus('error');
      setInjectError(result.error);
      setTimeout(() => setInjectStatus('idle'), 5000);
    }
  }, [selectedBase, craftedAffixes, itemLevel]);

  return {
    showExport, copiedExport, injectStatus, injectError, ue5Status,
    setShowExport, handleCopy, handleExportFile, handleInjectToUE5,
  };
}
