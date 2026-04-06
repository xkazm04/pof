'use client';

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { ACCENT_CYAN_LIGHT, OPACITY_20, withOpacity } from '@/lib/chart-colors';

interface SelectorSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accent?: string;
  resultCount: number;
  totalCount: number;
}

export interface SelectorSearchHandle {
  focus: () => void;
}

export const SelectorSearch = forwardRef<SelectorSearchHandle, SelectorSearchProps>(
  function SelectorSearch(
    { value, onChange, placeholder, accent = ACCENT_CYAN_LIGHT, resultCount, totalCount },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      inputRef.current?.focus();
    }, []);

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus();
    };

    return (
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: value ? accent : 'var(--text-muted)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-9 pr-20 py-2.5 bg-surface-deep border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-border-bright transition-colors"
          style={value ? { borderColor: withOpacity(accent, OPACITY_20) } : undefined}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value && (
            <button
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-surface-hover transition-colors"
              aria-label="Clear search"
            >
              <X size={14} className="text-text-muted" />
            </button>
          )}
          <span className="text-2xs text-text-muted font-mono tabular-nums" aria-live="polite">
            {resultCount}/{totalCount}
          </span>
        </div>
      </div>
    );
  },
);
