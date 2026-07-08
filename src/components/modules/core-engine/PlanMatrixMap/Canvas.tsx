'use client';

import { OVERLAY_WHITE, OPACITY_5, withOpacity } from '@/lib/chart-colors';
import type { PlanMatrixState } from './usePlanMatrixMap';
import { CanvasClusters } from './CanvasClusters';
import { CanvasSectors } from './CanvasSectors';
import { CanvasEdges } from './CanvasEdges';
import { CanvasNodes } from './CanvasNodes';

export function Canvas({ pm }: { pm: PlanMatrixState }) {
  const {
    containerRef, isPanningState, transform, setTransform,
    isPanningRef, setIsPanningState, dragCountRef,
    startPan, onPointerMove, endPan, setSelectedKey,
    zoomToCenter, reset, layout, zoomToFit,
  } = pm;

  return (
      <div
        ref={containerRef}
        className="absolute inset-0 top-0 overflow-hidden select-none"
        tabIndex={0}
        style={{
          cursor: isPanningState ? 'grabbing' : 'grab',
          outline: 'none',
          backgroundImage: `radial-gradient(circle at 1px 1px, ${withOpacity(OVERLAY_WHITE, OPACITY_5)} 1px, transparent 0)`,
          backgroundSize: `${40 * transform.zoom}px ${40 * transform.zoom}px`,
          backgroundPosition: `${transform.panX}px ${transform.panY}px`,
          willChange: 'transform', // Performance hint
        }}
        onWheel={(e) => {
          e.preventDefault();
          const el = containerRef.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          setTransform((prev) => {
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const nz = Math.min(3.0, Math.max(0.2, prev.zoom * factor));
            const r = nz / prev.zoom;
            return { zoom: nz, panX: cx - (cx - prev.panX) * r, panY: cy - (cy - prev.panY) * r };
          });
        }}
        onPointerDown={(e) => {
          isPanningRef.current = true;
          setIsPanningState(true);
          dragCountRef.current = 0;
          startPan(e);
        }}
        onPointerMove={(e) => {
          if (isPanningRef.current) dragCountRef.current++;
          onPointerMove(e);
        }}
        onPointerUp={() => {
          isPanningRef.current = false;
          setIsPanningState(false);
          endPan();
        }}
        onClick={() => {
          if (dragCountRef.current < 3) setSelectedKey(null);
        }}
        onKeyDown={(e) => {
          const el = containerRef.current;
          if (!el) return;
          const PAN_STEP = 40;
          switch (e.key) {
            case '+':
            case '=':
              e.preventDefault();
              zoomToCenter(1.25, el.clientWidth, el.clientHeight);
              break;
            case '-':
            case '_':
              e.preventDefault();
              zoomToCenter(0.8, el.clientWidth, el.clientHeight);
              break;
            case '0':
              e.preventDefault();
              reset();
              break;
            case 'f':
            case 'F':
              e.preventDefault();
              if (layout) {
                const rect = el.getBoundingClientRect();
                zoomToFit(layout.bounds, rect.width, rect.height);
              }
              break;
            case 'ArrowUp':
              e.preventDefault();
              setTransform((p) => ({ ...p, panY: p.panY + PAN_STEP }));
              break;
            case 'ArrowDown':
              e.preventDefault();
              setTransform((p) => ({ ...p, panY: p.panY - PAN_STEP }));
              break;
            case 'ArrowLeft':
              e.preventDefault();
              setTransform((p) => ({ ...p, panX: p.panX + PAN_STEP }));
              break;
            case 'ArrowRight':
              e.preventDefault();
              setTransform((p) => ({ ...p, panX: p.panX - PAN_STEP }));
              break;
          }
        }}
      >
        <div
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          <CanvasClusters pm={pm} />
          <CanvasSectors pm={pm} />
          <CanvasEdges pm={pm} />
          <CanvasNodes pm={pm} />
        </div>
      </div>
  );
}
