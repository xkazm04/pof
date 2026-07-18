import { useState, useMemo, useCallback, useEffect } from 'react';
import type { LogEntry } from '../types';
import { groupLogs } from './helpers';
import type { SelectionToolbarState } from './types';

export function useTerminalOutput({
  logs, scrollRef, onBuildFix, scrollBtnVisible, isAutoScroll,
}: {
  logs: LogEntry[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onBuildFix: (prompt: string) => void;
  scrollBtnVisible: boolean;
  isAutoScroll: boolean;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbarState | null>(null);

  // Handle text selection for floating toolbar
  const handleMouseUp = useCallback(() => {
    // Small delay to let the selection finalize
    requestAnimationFrame(() => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionToolbar(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 2) {
        setSelectionToolbar(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const container = scrollRef.current;
      if (!container) return;

      // Empty rect (e.g. selection inside an offscreen/zero-size node) → bail
      if (rect.width === 0 && rect.height === 0) {
        setSelectionToolbar(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();

      // Anchor in container content coords (accounts for scroll)
      const anchorX = rect.left - containerRect.left + rect.width / 2;
      const anchorTop = rect.top - containerRect.top + container.scrollTop;
      const anchorBottom = rect.bottom - containerRect.top + container.scrollTop;

      setSelectionToolbar({ text, anchorX, anchorTop, anchorBottom });
    });
  }, [scrollRef]);

  // Dismiss toolbar on click away or scroll
  useEffect(() => {
    if (!selectionToolbar) return;

    const handleSelectionChange = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectionToolbar(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [selectionToolbar]);

  const handleSelectionCopy = useCallback(() => {
    if (!selectionToolbar) return;
    navigator.clipboard.writeText(selectionToolbar.text);
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar]);

  const handleSelectionSearch = useCallback(() => {
    if (!selectionToolbar) return;
    // Dispatch a search event that the parent module can handle
    window.dispatchEvent(
      new CustomEvent('pof-terminal-search', {
        detail: { query: selectionToolbar.text },
      })
    );
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar]);

  const handleSelectionFix = useCallback(() => {
    if (!selectionToolbar) return;
    onBuildFix(`Fix this error:\n\n${selectionToolbar.text}`);
    setSelectionToolbar(null);
    document.getSelection()?.removeAllRanges();
  }, [selectionToolbar, onBuildFix]);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const togglePair = useCallback((id: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /* Group the FULL log list — every entry the user can scroll to keeps rich
     rendering (Fix buttons, code highlighting, entity tags, expandable tool
     pairs). Long-log performance is handled at render time: each grouped row
     is memoized (log entry objects are append-stable) and painted with CSS
     `content-visibility: auto`, so offscreen rows skip layout/paint. */
  const groupedLogs = useMemo(() => groupLogs(logs), [logs]);

  // Track which log IDs have been seen so we only animate new arrivals
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    // Mark all current log ids as seen after paint so animation runs once
    const timer = requestAnimationFrame(() => {
      setSeenIds(prev => {
        const next = new Set(prev);
        for (const log of logs) next.add(log.id);
        return next;
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [logs]);

  const isNewEntry = useCallback((id: string) => !seenIds.has(id), [seenIds]);

  // Track scroll button visibility with CSS class
  const showScrollBtn = scrollBtnVisible && !isAutoScroll && logs.length > 10;
  const [scrollBtnMounted, setScrollBtnMounted] = useState(false);

  // Render-time mount: show immediately when conditions met
  const [prevShowScrollBtn, setPrevShowScrollBtn] = useState(false);
  if (showScrollBtn && !prevShowScrollBtn) {
    setPrevShowScrollBtn(true);
    setScrollBtnMounted(true);
  }
  if (!showScrollBtn && prevShowScrollBtn) {
    setPrevShowScrollBtn(false);
  }

  // Delayed unmount for exit transition
  useEffect(() => {
    if (showScrollBtn) return;
    const timer = setTimeout(() => setScrollBtnMounted(false), 150);
    return () => clearTimeout(timer);
  }, [showScrollBtn]);

  return {
    expandedGroups,
    expandedPairs,
    selectionToolbar,
    handleMouseUp,
    handleSelectionCopy,
    handleSelectionSearch,
    handleSelectionFix,
    toggleGroup,
    togglePair,
    groupedLogs,
    isNewEntry,
    showScrollBtn,
    scrollBtnMounted,
  };
}
