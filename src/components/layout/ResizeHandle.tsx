'use client';

import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  onResize: (deltaY: number) => void;
  onResizeEnd?: () => void;
}

export function ResizeHandle({ onResize, onResizeEnd }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const startY = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - e.clientY;
      startY.current = e.clientY;
      onResize(deltaY);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, onResizeEnd]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-2 w-full cursor-ns-resize bg-border hover:bg-border-bright transition-colors duration-150 flex items-center justify-center group"
      style={{ boxShadow: '0 -2px 4px rgba(0,0,0,0.3)' }}
    >
      <div className="flex items-center gap-1">
        <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
        <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
        <div className="w-[3px] h-[3px] rounded-full bg-border-bright group-hover:bg-text-muted group-hover:w-1 group-hover:h-1 transition-all" />
      </div>
    </div>
  );
}
