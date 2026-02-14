'use client';

import { RefreshCw } from 'lucide-react';

interface FetchErrorProps {
  message: string;
  onRetry: () => void;
}

export function FetchError({ message, onRetry }: FetchErrorProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 max-w-xs text-center">
        <p className="text-sm text-red-400">{message}</p>
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
