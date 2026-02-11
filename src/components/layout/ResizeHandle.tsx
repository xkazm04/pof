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
      className="h-1.5 w-full cursor-ns-resize bg-[#1e1e3a] hover:bg-[#2e2e5a] transition-colors duration-150 flex items-center justify-center group"
    >
      <div className="w-8 h-0.5 rounded-full bg-[#2e2e5a] group-hover:bg-[#6b7294] transition-colors" />
    </div>
  );
}
