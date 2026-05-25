'use client';

import React, { useEffect, useRef } from 'react';
import Markdown from 'markdown-to-jsx';
import { Check, Sparkles, X } from 'lucide-react';
import type { ChatMessage } from '@/lib/dzin/core/chat';
import { summarizeSuggestion } from '@/lib/dzin/advisor/suggestionActions';

function relativeTime(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000);
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  const mins = Math.floor(delta / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

const markdownOverrides = {
  overrides: {
    pre: {
      component: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
        <pre data-dzin-chat-code-block="" {...props}>{children}</pre>
      ),
    },
    code: {
      component: ({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) => {
        if (className && typeof className === 'string' && className.startsWith('lang-')) {
          return <code data-language={className.replace('lang-', '')} {...props}>{children}</code>;
        }
        return <code data-dzin-chat-inline-code="" {...props}>{children}</code>;
      },
    },
  },
};

/* ── Suggestion card ──────────────────────────────────────────────────── */

function SuggestionCard({
  message,
  onApply,
  onDismiss,
}: {
  message: ChatMessage;
  onApply?: (message: ChatMessage) => void;
  onDismiss?: (message: ChatMessage) => void;
}) {
  const suggestion = message.suggestedAction!;
  const { status, compose } = suggestion;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={12} className="text-blue-400" />
        <span className="text-xs font-semibold text-blue-400">Suggestion</span>
        <span className="text-xs text-text-muted">{relativeTime(message.timestamp)}</span>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p className="mt-1.5 text-xs text-text-muted">{summarizeSuggestion(compose)}</p>

        {status === 'pending' ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onApply?.(message)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer"
              aria-label="Apply suggestion"
            >
              <Check size={12} /> Apply
            </button>
            <button
              type="button"
              onClick={() => onDismiss?.(message)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border text-text-muted hover:text-text hover:border-border/80 transition-colors cursor-pointer"
              aria-label="Dismiss suggestion"
            >
              <X size={12} /> Dismiss
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {status === 'applied' ? (
              <span className="flex items-center gap-1 text-green-400">
                <Check size={12} /> Applied
              </span>
            ) : (
              <span className="text-text-muted">Dismissed</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Message item ─────────────────────────────────────────────────────── */

const MessageItem = React.memo(
  function MessageItem({
    message,
    onApplySuggestion,
    onDismissSuggestion,
  }: {
    message: ChatMessage;
    onApplySuggestion?: (message: ChatMessage) => void;
    onDismissSuggestion?: (message: ChatMessage) => void;
  }) {
    if (message.suggestedAction) {
      return (
        <SuggestionCard
          message={message}
          onApply={onApplySuggestion}
          onDismiss={onDismissSuggestion}
        />
      );
    }

    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const label = isUser ? 'You' : isSystem ? 'System' : 'Dzin';

    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${isUser ? 'text-text' : isSystem ? 'text-yellow-400' : 'text-blue-400'}`}>
            {label}
          </span>
          <span className="text-xs text-text-muted">{relativeTime(message.timestamp)}</span>
          {message.isStreaming && <span className="text-xs text-blue-400 animate-pulse">typing...</span>}
        </div>
        <div className="text-sm text-text leading-relaxed">
          {isUser || isSystem ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown options={markdownOverrides}>{message.content}</Markdown>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    // Handlers are intentionally excluded: they close over a stable engine
    // reference and read live state, so a memoized stale closure stays correct.
    if (
      prev.message.id === next.message.id &&
      !prev.message.isStreaming &&
      !next.message.isStreaming &&
      prev.message.content === next.message.content &&
      prev.message.suggestedAction?.status === next.message.suggestedAction?.status
    ) {
      return true;
    }
    return false;
  },
);

interface ChatMessagesProps {
  messages: ChatMessage[];
  onApplySuggestion?: (message: ChatMessage) => void;
  onDismissSuggestion?: (message: ChatMessage) => void;
}

export function ChatMessages({ messages, onApplySuggestion, onDismissSuggestion }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div data-dzin-chat-messages="" className="flex-1 overflow-y-auto min-h-0">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          Ask Dzin to compose your workspace...
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          onApplySuggestion={onApplySuggestion}
          onDismissSuggestion={onDismissSuggestion}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
