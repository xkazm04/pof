'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

interface UseScrollSyncOpts {
  logCount: number;
  visible: boolean;
}

/**
 * Manages auto-scroll, unseen count, and scroll-to-bottom button visibility.
 * The output is a single native scroll container (offscreen rows are skipped
 * via CSS content-visibility, not a nested virtualized list).
 */
export function useScrollSync({
  logCount,
  visible,
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
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logCount, isAutoScroll]);

  // Restore scroll position when becoming visible after being hidden
  useEffect(() => {
    if (visible && !prevVisibleRef.current && isAutoScroll) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    }
    prevVisibleRef.current = visible;
  }, [visible, isAutoScroll]);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

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
