'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 800;
const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 500;
const EDGE_MARGIN = 24;

export interface OverlayState {
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen: boolean;
}

export type ResizeEdge = 'top' | 'right' | 'bottom' | 'left';

export interface ChatOverlay {
  state: OverlayState;
  toggle: () => void;
  dragHandlers: { onPointerDown: (e: React.PointerEvent) => void };
  resizeHandlers: { onPointerDown: (edge: ResizeEdge) => (e: React.PointerEvent) => void };
}

export function useChatOverlay(): ChatOverlay {
  const [state, setState] = useState<OverlayState>({
    x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, isOpen: false,
  });

  const hasPositioned = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const resizeStart = useRef({
    x: 0, y: 0, originX: 0, originY: 0, originW: 0, originH: 0, edge: 'right' as ResizeEdge,
  });

  const toggle = useCallback(() => {
    setState((prev) => {
      if (!prev.isOpen && !hasPositioned.current) {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
        hasPositioned.current = true;
        return { ...prev, x: vw - prev.width - EDGE_MARGIN, y: vh - prev.height - EDGE_MARGIN - 56, isOpen: true };
      }
      return { ...prev, isOpen: !prev.isOpen };
    });
  }, []);

  const handleDragPointerDown = useCallback((e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, originX: state.x, originY: state.y };

    const handleMove = (me: PointerEvent) => {
      const dx = me.clientX - dragStart.current.x;
      const dy = me.clientY - dragStart.current.y;
      setState((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(window.innerWidth - prev.width, dragStart.current.originX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - prev.height, dragStart.current.originY + dy)),
      }));
    };
    const handleUp = () => { el.removeEventListener('pointermove', handleMove); el.removeEventListener('pointerup', handleUp); };
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
  }, [state.x, state.y]);

  const handleResizePointerDown = useCallback((edge: ResizeEdge) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    resizeStart.current = { x: e.clientX, y: e.clientY, originX: state.x, originY: state.y, originW: state.width, originH: state.height, edge };

    const handleMove = (me: PointerEvent) => {
      const s = resizeStart.current;
      const dx = me.clientX - s.x;
      const dy = me.clientY - s.y;
      setState((prev) => {
        let { x, y, width, height } = prev;
        switch (s.edge) {
          case 'right': width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, s.originW + dx)); break;
          case 'left': width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, s.originW - dx)); x = s.originX + (s.originW - width); break;
          case 'bottom': height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, s.originH + dy)); break;
          case 'top': height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, s.originH - dy)); y = s.originY + (s.originH - height); break;
        }
        return { ...prev, x, y, width, height };
      });
    };
    const handleUp = () => { el.removeEventListener('pointermove', handleMove); el.removeEventListener('pointerup', handleUp); };
    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerup', handleUp);
  }, [state.x, state.y, state.width, state.height]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.isContentEditable) return;
        if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && active.closest('[data-panel-frame]')) return;
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { state, toggle, dragHandlers: { onPointerDown: handleDragPointerDown }, resizeHandlers: { onPointerDown: handleResizePointerDown } };
}
