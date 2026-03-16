'use client';

import React, { useEffect, useRef } from 'react';
import Markdown from 'markdown-to-jsx';
import type { ChatMessage } from '@/lib/dzin/core/chat';

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

const MessageItem = React.memo(
  function MessageItem({ message }: { message: ChatMessage }) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    const label = isUser ? 'You' : isSystem ? 'System' : 'Dzin';

    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${isUser ? 'text-text' : isSystem ? 'text-yellow-400' : 'text-blue-400'}`}>
            {label}
          </span>
          <span className="text-[10px] text-text-muted">{relativeTime(message.timestamp)}</span>
          {message.isStreaming && <span className="text-[10px] text-blue-400 animate-pulse">typing...</span>}
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
    if (prev.message.id === next.message.id && !prev.message.isStreaming && !next.message.isStreaming && prev.message.content === next.message.content) return true;
    return false;
  },
);

interface ChatMessagesProps {
  messages: ChatMessage[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
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
      {messages.map((msg) => <MessageItem key={msg.id} message={msg} />)}
      <div ref={bottomRef} />
    </div>
  );
}
