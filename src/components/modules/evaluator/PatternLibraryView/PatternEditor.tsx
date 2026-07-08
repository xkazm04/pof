'use client';

import { useState, useCallback } from 'react';
import { usePatternLibraryStore } from '@/stores/patternLibraryStore';
import type { ImplementationPattern } from '@/types/pattern-library';

// ── Pattern Editor (description + pitfalls patch) ───────────────────────────

export function PatternEditor({ pattern, onDone }: { pattern: ImplementationPattern; onDone: () => void }) {
  const updatePattern = usePatternLibraryStore((s) => s.updatePattern);
  const [description, setDescription] = useState(pattern.description);
  const [pitfallsText, setPitfallsText] = useState(pattern.pitfalls.join('\n'));
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const pitfalls = pitfallsText.split('\n').map((s) => s.trim()).filter(Boolean);
    await updatePattern(pattern.id, { description, pitfalls });
    setSaving(false);
    onDone();
  }, [pattern.id, description, pitfallsText, updatePattern, onDone]);

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <div>
        <label className="text-2xs text-text-muted font-medium mb-1 block">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-blue-500/40 resize-y"
        />
      </div>
      <div>
        <label className="text-2xs text-text-muted font-medium mb-1 block">Pitfalls (one per line)</label>
        <textarea
          value={pitfallsText}
          onChange={(e) => setPitfallsText(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs text-text focus:outline-none focus:border-blue-500/40 resize-y"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-1 rounded text-2xs text-text-muted hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded text-2xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
