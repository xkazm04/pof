'use client';

import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { useChatMessages } from '@/lib/dzin/core/chat';
import type { ChatStore } from '@/lib/dzin/core/chat';
import type { IntentBus } from '@/lib/dzin/core/intent';

import { useChatOverlay } from './useChatOverlay';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { createPofSlashCommands } from '@/lib/dzin/advisor/slashCommands';
import './chat.css';

interface ConversationShellProps {
  chatStore: ChatStore;
  bus: IntentBus;
  onSend: (text: string) => void;
}

export function ConversationShell({ chatStore, bus, onSend }: ConversationShellProps) {
  const messages = useChatMessages(chatStore);
  const overlay = useChatOverlay();
  const commands = useMemo(() => createPofSlashCommands(bus, chatStore), [bus, chatStore]);

  const handleSend = useCallback((text: string) => {
    // Slash commands handled by ChatInput/SlashCommandMenu
    // Regular text goes through the multimodal input pipeline
    chatStore.addMessage('user', text);
    onSend(text);
  }, [chatStore, onSend]);

  return (
    <>
      <motion.button
        type="button"
        onClick={overlay.toggle}
        className="fixed right-6 bottom-6 z-[9000] flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-colors cursor-pointer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Toggle Dzin chat"
      >
        <MessageCircle size={20} />
      </motion.button>

      <AnimatePresence>
        {overlay.state.isOpen && (
          <motion.div
            data-dzin-chat-shell=""
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed z-[9000] flex flex-col rounded-xl border border-border shadow-2xl shadow-black/40 overflow-hidden"
            style={{ left: overlay.state.x, top: overlay.state.y, width: overlay.state.width, height: overlay.state.height, background: 'var(--surface-deep, #0a0a0f)' }}
          >
            {/* Resize handles */}
            <div className="absolute top-0 left-2 right-2 h-2 cursor-n-resize" onPointerDown={overlay.resizeHandlers.onPointerDown('top')} />
            <div className="absolute top-2 right-0 bottom-2 w-2 cursor-e-resize" onPointerDown={overlay.resizeHandlers.onPointerDown('right')} />
            <div className="absolute bottom-0 left-2 right-2 h-2 cursor-s-resize" onPointerDown={overlay.resizeHandlers.onPointerDown('bottom')} />
            <div className="absolute top-2 left-0 bottom-2 w-2 cursor-w-resize" onPointerDown={overlay.resizeHandlers.onPointerDown('left')} />

            {/* Title Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-surface/80 border-b border-border cursor-grab active:cursor-grabbing select-none shrink-0" {...overlay.dragHandlers}>
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-blue-400" />
                <span className="text-sm font-medium text-text">Dzin</span>
              </div>
              <button type="button" onClick={overlay.toggle} className="p-1 rounded hover:bg-surface-deep text-text-muted hover:text-text transition-colors cursor-pointer" aria-label="Close chat">
                <X size={14} />
              </button>
            </div>

            <ChatMessages messages={messages} />
            <ChatInput onSend={handleSend} commands={commands} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
