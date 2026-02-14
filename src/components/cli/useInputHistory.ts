'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Manages terminal input history with arrow-key navigation.
 */
export function useInputHistory() {
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pushHistory = useCallback((prompt: string) => {
    setInputHistory((prev) => [...prev, prompt].slice(-50));
    setHistoryIndex(-1);
  }, []);

  const navigateHistory = useCallback(
    (direction: 'up' | 'down'): string | null => {
      if (inputHistory.length === 0) return null;
      let newIndex = historyIndex;
      if (direction === 'up') {
        newIndex = historyIndex === -1 ? inputHistory.length - 1 : Math.max(0, historyIndex - 1);
      } else {
        newIndex = historyIndex === -1 ? -1 : Math.min(inputHistory.length - 1, historyIndex + 1);
        if (newIndex === inputHistory.length) newIndex = -1;
      }
      setHistoryIndex(newIndex);
      const val = newIndex >= 0 ? inputHistory[newIndex] : '';
      // Reset textarea height after history nav
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = '20px';
          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 88)}px`;
        }
      });
      return val;
    },
    [inputHistory, historyIndex],
  );

  const resetHeight = useCallback(() => {
    if (inputRef.current) inputRef.current.style.height = '20px';
  }, []);

  return { inputRef, pushHistory, navigateHistory, resetHeight };
}
