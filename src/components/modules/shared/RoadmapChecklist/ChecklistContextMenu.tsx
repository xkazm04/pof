'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Play, StickyNote, ClipboardCopy, RotateCcw, FileCode, ArrowUpToLine,
} from 'lucide-react';
import type { ChecklistItem } from '@/types/modules';
import type { VerificationInfo } from '@/stores/moduleStore';
import { STATUS_INFO } from '@/lib/chart-colors';
import { NOTE_ACCENT_COLOR } from './constants';

export function ChecklistContextMenu({
  x, y, item, itemIndex, isChecked, verification, accentColor,
  isRunning, onClose, onCopyPrompt, onRunWithClaude, onMarkAllAbove,
  onResetItem, onAddNote,
}: {
  x: number;
  y: number;
  item: ChecklistItem;
  itemIndex: number;
  isChecked: boolean;
  verification?: VerificationInfo;
  accentColor: string;
  isRunning: boolean;
  onClose: () => void;
  onCopyPrompt: (text: string) => void;
  onRunWithClaude: (itemId: string, prompt: string) => void;
  onMarkAllAbove: (itemId: string) => void;
  onResetItem: (itemId: string) => void;
  onAddNote: (itemId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Reposition if overflowing viewport
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    if (nx < 8) nx = 8;
    if (ny < 8) ny = 8;
    if (nx !== x || ny !== y) {
      const raf = requestAnimationFrame(() => setPos({ x: nx, y: ny }));
      return () => cancelAnimationFrame(raf);
    }
  }, [x, y]);

  // Close on click-outside, scroll, or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  const hasVerifiedFile = verification && (verification.status === 'full' || verification.status === 'partial');

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[200px] py-1 bg-surface border border-border-bright rounded-lg shadow-2xl backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Copy Prompt */}
      <ContextMenuItem
        icon={<ClipboardCopy className="w-3.5 h-3.5" />}
        label="Copy Prompt"
        shortcut="Ctrl+C"
        onClick={() => onCopyPrompt(item.prompt)}
      />

      {/* Run with Claude */}
      <ContextMenuItem
        icon={<Play className="w-3.5 h-3.5" />}
        label="Run with Claude"
        iconColor={accentColor}
        disabled={isRunning || isChecked}
        onClick={() => onRunWithClaude(item.id, item.prompt)}
      />

      <ContextMenuDivider />

      {/* Mark All Above Complete */}
      <ContextMenuItem
        icon={<ArrowUpToLine className="w-3.5 h-3.5" />}
        label="Mark All Above Done"
        disabled={itemIndex === 0}
        onClick={() => onMarkAllAbove(item.id)}
      />

      {/* Reset Item */}
      <ContextMenuItem
        icon={<RotateCcw className="w-3.5 h-3.5" />}
        label="Reset Item"
        disabled={!isChecked}
        onClick={() => onResetItem(item.id)}
      />

      <ContextMenuDivider />

      {/* View Generated Code */}
      {hasVerifiedFile && (
        <ContextMenuItem
          icon={<FileCode className="w-3.5 h-3.5" />}
          label="View Generated Code"
          iconColor={STATUS_INFO}
          onClick={() => {
            onRunWithClaude(
              item.id,
              `Show me the implementation code for "${item.label}". Display the relevant header and source file contents.`,
            );
          }}
        />
      )}

      {/* Add Note */}
      <ContextMenuItem
        icon={<StickyNote className="w-3.5 h-3.5" />}
        label="Add Note"
        iconColor={NOTE_ACCENT_COLOR}
        onClick={() => onAddNote(item.id)}
      />
    </div>
  );
}

function ContextMenuItem({
  icon, label, shortcut, disabled, iconColor, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  iconColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
        disabled
          ? 'text-text-muted/40 cursor-default'
          : 'text-text hover:bg-surface-hover'
      }`}
    >
      <span className="flex-shrink-0" style={iconColor && !disabled ? { color: iconColor } : undefined}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-2xs text-text-muted font-mono">{shortcut}</span>
      )}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="my-1 h-px bg-border" />;
}
