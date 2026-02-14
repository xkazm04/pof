'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import type { ListImperativeAPI } from 'react-window';

interface UseScrollSyncOpts {
  logCount: number;
  visible: boolean;
  virtualizedLogCount: number;
  listRef: React.RefObject<ListImperativeAPI | null>;
}

/**
 * Manages auto-scroll, unseen count, and scroll-to-bottom button visibility.
 * Always assumes virtualization is active (progressive from line 1).
 */
export function useScrollSync({
  logCount,
  visible,
  virtualizedLogCount,
  listRef,
}: UseScrollSyncOpts) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevVisibleRef = useRef(visible);

  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [scrollBtnVisible, setScrollBtnVisible] = useState(false);

  // Scroll to bottom when logs change and auto-scroll is on
  useEffect(() => {
    if (isAutoScroll) {
      if (virtualizedLogCount > 0 && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogCount - 1, align: 'end' });
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logCount, isAutoScroll, virtualizedLogCount, listRef]);

  // Restore scroll position when becoming visible after being hidden
  useEffect(() => {
    if (visible && !prevVisibleRef.current && isAutoScroll) {
      requestAnimationFrame(() => {
        if (virtualizedLogCount > 0 && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogCount - 1, align: 'end' });
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
    prevVisibleRef.current = visible;
  }, [visible, isAutoScroll, virtualizedLogCount, listRef]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const threshold = clientHeight * 2;
    const atBottom = distanceFromBottom < 50;
    const farFromBottom = distanceFromBottom > threshold;

    if (atBottom) {
      setIsAutoScroll(true);
      isAutoScrollRef.current = true;
      setUnseenCount(0);
      setScrollBtnVisible(false);
      if (autoHideTimerRef.current) { clearTimeout(autoHideTimerRef.current); autoHideTimerRef.current = null; }
    } else if (farFromBottom) {
      setIsAutoScroll(false);
      isAutoScrollRef.current = false;
      setScrollBtnVisible(true);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = setTimeout(() => setScrollBtnVisible(false), 3000);
    }
  }, []);

  /** Called by the log buffer flush when auto-scroll is off */
  const addUnseenCount = useCallback((count: number) => {
    if (isAutoScrollRef.current) return;
    setUnseenCount((prev) => prev + count);
    setScrollBtnVisible(true);
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    autoHideTimerRef.current = setTimeout(() => setScrollBtnVisible(false), 3000);
  }, []);

  const scrollToBottom = useCallback(() => {
    setIsAutoScroll(true);
    isAutoScrollRef.current = true;
    setUnseenCount(0);
    setScrollBtnVisible(false);
    if (autoHideTimerRef.current) { clearTimeout(autoHideTimerRef.current); autoHideTimerRef.current = null; }
    if (virtualizedLogCount > 0 && listRef.current) listRef.current.scrollToRow({ index: virtualizedLogCount - 1, align: 'end' });
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [virtualizedLogCount, listRef]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, []);

  return {
    scrollRef,
    isAutoScroll,
    isAutoScrollRef,
    unseenCount,
    scrollBtnVisible,
    handleScroll,
    addUnseenCount,
    scrollToBottom,
  };
}
