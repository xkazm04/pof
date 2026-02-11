'use client';

import { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-[#1a1a3a] border border-[#2e2e5a] rounded text-[10px] text-[#e0e4f0] whitespace-nowrap z-50">
          {content}
        </div>
      )}
    </div>
  );
}
