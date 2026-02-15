'use client';

import { useCallback } from 'react';
import { Send, Square } from 'lucide-react';

interface TerminalInputProps {
  input: string;
  setInput: (val: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isStreaming: boolean;
  onSubmit: (resume: boolean) => void;
  onAbort: () => void;
  onNavigateHistory: (direction: 'up' | 'down') => string | null;
}

export function TerminalInput({
  input, setInput, inputRef, isStreaming,
  onSubmit, onAbort, onNavigateHistory,
}: TerminalInputProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e.ctrlKey || e.metaKey); }
    if (e.key === 'ArrowUp') {
      const el = inputRef.current;
      if (el && el.selectionStart === 0 && el.selectionEnd === 0) {
        const val = onNavigateHistory('up');
        if (val !== null) setInput(val);
      }
    }
    if (e.key === 'ArrowDown') {
      const el = inputRef.current;
      if (el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
        const val = onNavigateHistory('down');
        if (val !== null) setInput(val);
      }
    }
    if (e.key === 'Escape' && isStreaming) onAbort();
  }, [inputRef, isStreaming, onSubmit, onAbort, onNavigateHistory, setInput]);

  return (
    <div className="flex items-start gap-2 px-3 py-2 border-t border-border bg-surface-deep">
      <span className="text-[#3b82f6] text-xs font-mono mt-[5px]">{'>'}</span>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          const el = e.target;
          el.style.height = '20px';
          el.style.height = `${Math.min(el.scrollHeight, 88)}px`;
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Prompt... (Shift+Enter for newline, Ctrl+Enter to resume)"
        className="flex-1 bg-transparent text-xs text-text placeholder-text-muted outline-none font-mono resize-none overflow-y-auto leading-[20px]"
        style={{ height: '20px', maxHeight: '88px' }}
      />
      {isStreaming ? (
        <button onClick={onAbort} className="p-1 mt-[3px] text-red-400 hover:bg-status-red-medium rounded transition-colors">
          <Square className="w-3 h-3" />
        </button>
      ) : (
        <button onClick={() => onSubmit(false)} disabled={!input.trim()} className="p-1 mt-[3px] text-[#3b82f6] hover:bg-[#3b82f6]/20 rounded transition-colors">
          <Send className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
