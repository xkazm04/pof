'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, StickyNote } from 'lucide-react';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';

export function NotesSection({ itemId, notes, isExpanded, isEditing, onToggle, onStartEdit, onSave, onCancelEdit }: {
  itemId: string;
  notes: string;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onSave: (text: string) => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState(notes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(notes);
  }, [notes]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  if (!isExpanded && notes) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-1 mt-1.5 text-2xs text-amber-500 hover:text-amber-400 transition-colors"
      >
        <ChevronRight className="w-2.5 h-2.5" />
        <StickyNote className="w-2.5 h-2.5" />
        <TruncateWithTooltip className="truncate max-w-[200px] block" side="bottom">{notes}</TruncateWithTooltip>
      </button>
    );
  }

  if (!isExpanded) return null;

  return (
    <div className="mt-2 pl-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-2xs text-text-muted hover:text-text transition-colors mb-1.5"
      >
        <ChevronDown className="w-2.5 h-2.5" />
        Notes
      </button>
      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onSave(draft);
              }
              if (e.key === 'Escape') {
                setDraft(notes);
                onCancelEdit();
              }
            }}
            placeholder="Add notes about this item..."
            className="w-full px-2.5 py-1.5 bg-background border border-border-bright rounded-md text-xs text-text outline-none focus:border-amber-500/50 resize-none"
            rows={3}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onSave(draft)}
              className="px-2 py-1 rounded text-2xs font-medium bg-status-amber-subtle text-amber-500 border border-status-amber-strong hover:bg-status-amber-medium transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setDraft(notes); onCancelEdit(); }}
              className="px-2 py-1 rounded text-2xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <span className="text-2xs text-text-muted ml-auto">Ctrl+Enter to save</span>
          </div>
        </div>
      ) : (
        <div
          onClick={onStartEdit}
          className="px-2.5 py-1.5 rounded-md bg-background border border-border text-xs text-text-muted cursor-text hover:border-border-bright transition-colors min-h-[32px]"
        >
          {notes || <span className="italic">Click to add notes...</span>}
        </div>
      )}
    </div>
  );
}
