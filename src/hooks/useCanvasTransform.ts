'use client';

import { useState, useCallback, useRef, type Dispatch, type SetStateAction, type PointerEvent, type WheelEvent } from 'react';

export interface CanvasTransform {
  panX: number;
  panY: number;
  zoom: number;
}

export interface UseCanvasTransformResult {
  transform: CanvasTransform;
  isPanning: boolean;
  startPan: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  endPan: () => void;
  onWheel: (e: WheelEvent) => void;
  zoomToFit: (bounds: { minX: number; minY: number; maxX: number; maxY: number }, containerWidth: number, containerHeight: number) => void;
  zoomToCenter: (factor: number, containerWidth: number, containerHeight: number) => void;
  reset: () => void;
  setTransform: Dispatch<SetStateAction<CanvasTransform>>;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;

export function useCanvasTransform(initial?: Partial<CanvasTransform>): UseCanvasTransformResult {
  const [transform, setTransform] = useState<CanvasTransform>({
    panX: initial?.panX ?? 0,
    panY: initial?.panY ?? 0,
    zoom: initial?.zoom ?? 1,
  });

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const startPan = useCallback((e: PointerEvent) => {
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { x: transform.panX, y: transform.panY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [transform.panX, transform.panY]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((prev) => ({
      ...prev,
      panX: panOrigin.current.x + dx,
      panY: panOrigin.current.y + dy,
    }));
  }, []);

  const endPan = useCallback(() => {
    isPanning.current = false;
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    setTransform((prev) => {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomFactor));
      const ratio = newZoom / prev.zoom;

      return {
        zoom: newZoom,
        panX: cursorX - (cursorX - prev.panX) * ratio,
        panY: cursorY - (cursorY - prev.panY) * ratio,
      };
    });
  }, []);

  const zoomToFit = useCallback((bounds: { minX: number; minY: number; maxX: number; maxY: number }, containerWidth: number, containerHeight: number) => {
    const bw = bounds.maxX - bounds.minX + 100; // padding
    const bh = bounds.maxY - bounds.minY + 100;
    const zx = containerWidth / bw;
    const zy = containerHeight / bh;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zx, zy) * 0.9));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;

    setTransform({
      zoom,
      panX: containerWidth / 2 - cx * zoom,
      panY: containerHeight / 2 - cy * zoom,
    });
  }, []);

  const reset = useCallback(() => {
    setTransform({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  /** Zoom anchored to the center of the container */
  const zoomToCenter = useCallback((factor: number, containerWidth: number, containerHeight: number) => {
    setTransform((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const ratio = newZoom / prev.zoom;
      const cx = containerWidth / 2;
      const cy = containerHeight / 2;
      return {
        zoom: newZoom,
        panX: cx - (cx - prev.panX) * ratio,
        panY: cy - (cy - prev.panY) * ratio,
      };
    });
  }, []);

  return {
    transform,
    isPanning: isPanning.current,
    startPan,
    onPointerMove,
    endPan,
    onWheel,
    zoomToFit,
    zoomToCenter,
    reset,
    setTransform,
  };
}
