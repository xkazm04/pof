'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FadeMask } from './types';

export function ResponsiveSvgContainer({ children, intrinsicWidth }: {
  children: React.ReactNode;
  intrinsicWidth: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeMask, setFadeMask] = useState<FadeMask>('none');

  const updateMask = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflows = scrollWidth > clientWidth + 1;
    if (!overflows) { setFadeMask('none'); return; }
    const atStart = scrollLeft <= 1;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
    setFadeMask(atStart ? 'right' : atEnd ? 'left' : 'both');
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateMask);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateMask]);

  const maskImage = fadeMask === 'none' ? undefined
    : fadeMask === 'right' ? 'linear-gradient(to right, black 85%, transparent)'
    : fadeMask === 'left' ? 'linear-gradient(to right, transparent, black 15%)'
    : 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)';

  return (
    <div
      ref={scrollRef}
      onScroll={updateMask}
      className="overflow-x-auto"
      style={{ maskImage, WebkitMaskImage: maskImage }}
    >
      <div style={{ minWidth: intrinsicWidth }}>
        {children}
      </div>
    </div>
  );
}
