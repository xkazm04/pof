'use client';

import { useState, useCallback } from 'react';
import {
  Play, X, ClipboardCopy, CheckCheck, Undo2, Check,
} from 'lucide-react';
import { useModuleStore } from '@/stores/moduleStore';
import { AccentButton } from '@/components/ui/AccentButton';
import type { ChecklistItem, SubModuleId } from '@/types/modules';
import { UI_TIMEOUTS } from '@/lib/constants';

export function BulkActionBar({
  selected, items, subModuleId, progress, accentColor,
  onRunPrompt, isRunning, onDone,
}: {
  selected: Set<string>;
  items: ChecklistItem[];
  subModuleId: string;
  progress: Record<string, boolean>;
  accentColor: string;
  onRunPrompt: (itemId: string, prompt: string) => void;
  isRunning: boolean;
  onDone: () => void;
}) {
  const toggleItem = useModuleStore((s) => s.toggleChecklistItem);
  const setItem = useModuleStore((s) => s.setChecklistItem);
  const [copied, setCopied] = useState(false);

  const selectedItems = items.filter((i) => selected.has(i.id));
  const allDone = selectedItems.every((i) => progress[i.id]);
  const allUndone = selectedItems.every((i) => !progress[i.id]);

  const handleMarkDone = useCallback(() => {
    for (const item of selectedItems) {
      if (!progress[item.id]) setItem(subModuleId as SubModuleId, item.id, true);
    }
  }, [selectedItems, progress, subModuleId, setItem]);

  const handleMarkUndone = useCallback(() => {
    for (const item of selectedItems) {
      if (progress[item.id]) setItem(subModuleId as SubModuleId, item.id, false);
    }
  }, [selectedItems, progress, subModuleId, setItem]);

  const handleCopyPrompts = useCallback(async () => {
    const text = selectedItems.map((i) => i.prompt).join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [selectedItems]);

  const handleBatchRun = useCallback(() => {
    // Run the first unchecked selected item — the CLI onComplete flow can queue the next
    const firstUnchecked = selectedItems.find((i) => !progress[i.id]);
    if (firstUnchecked) {
      onRunPrompt(firstUnchecked.id, firstUnchecked.prompt);
    }
  }, [selectedItems, progress, onRunPrompt]);

  return (
    <div className="sticky bottom-0 z-20 flex items-center gap-2 px-3 py-2 rounded-lg border border-border-bright bg-surface shadow-lg">
      <span className="text-2xs font-medium text-text-muted mr-1">
        {selected.size} selected
      </span>
      <div className="h-4 w-px bg-border" />

      {!allDone && (
        <button
          onClick={handleMarkDone}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 transition-colors"
        >
          <CheckCheck className="w-3 h-3" />
          Mark Done
        </button>
      )}
      {!allUndone && (
        <button
          onClick={handleMarkUndone}
          className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted bg-surface-hover hover:bg-border border border-border transition-colors"
        >
          <Undo2 className="w-3 h-3" />
          Mark Undone
        </button>
      )}

      <AccentButton
        onClick={handleBatchRun}
        disabled={isRunning || allDone}
        accentColor={accentColor}
        size="sm"
        leftIcon={<Play className="w-3 h-3" />}
      >
        Run with Claude
      </AccentButton>

      <button
        onClick={handleCopyPrompts}
        className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted bg-surface-hover hover:bg-border border border-border transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <ClipboardCopy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy Prompts'}
      </button>

      <div className="ml-auto">
        <button
          onClick={onDone}
          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          title="Exit select mode"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
