'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import type { SlashCommand } from '@/lib/dzin/core/chat';
import { SlashCommandMenu } from './SlashCommandMenu';

interface ChatInputProps {
  onSend: (text: string) => void;
  commands: SlashCommand[];
}

export function ChatInput({ onSend, commands }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setValue(text);
    if (text.startsWith('/')) { setShowCommands(true); setCommandQuery(text); }
    else { setShowCommands(false); setCommandQuery(''); }
    requestAnimationFrame(adjustHeight);
  }, [adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
    setShowCommands(false);
    setCommandQuery('');
    requestAnimationFrame(() => { if (textareaRef.current) textareaRef.current.style.height = 'auto'; });
  }, [value, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [showCommands, handleSend]);

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    const afterSlash = value.slice(1);
    const spaceIndex = afterSlash.indexOf(' ');
    const args = spaceIndex >= 0 ? afterSlash.slice(spaceIndex + 1).trim() : '';
    command.execute(args);
    setValue('');
    setShowCommands(false);
    setCommandQuery('');
    requestAnimationFrame(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.focus(); } });
  }, [value]);

  const handleCommandDismiss = useCallback(() => { setShowCommands(false); setCommandQuery(''); }, []);

  const isEmpty = value.trim().length === 0;

  return (
    <div data-dzin-chat-input="" className="relative border-t border-border p-3">
      {showCommands && (
        <SlashCommandMenu commands={commands} query={commandQuery} onSelect={handleCommandSelect} onDismiss={handleCommandDismiss} inputRef={textareaRef} />
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask Dzin anything... (/ for commands)"
          rows={1}
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isEmpty}
          className={`shrink-0 p-1.5 rounded-md transition-colors ${isEmpty ? 'text-text-muted cursor-not-allowed' : 'text-blue-400 hover:bg-surface cursor-pointer'}`}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
