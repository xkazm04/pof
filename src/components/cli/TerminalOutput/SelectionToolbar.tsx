import { useState, useLayoutEffect, useRef } from 'react';
import { Copy, Search, Zap } from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { TOOLBAR_PADDING, TOOLBAR_GAP, CARET_INSET } from './constants';
import type { SelectionToolbarState, ToolbarPosition } from './types';

export function SelectionToolbar({ state, containerRef, onCopy, onSearch, onFix }: {
  state: SelectionToolbarState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCopy: () => void;
  onSearch: () => void;
  onFix: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ToolbarPosition | null>(null);

  useLayoutEffect(() => {
    const node = toolbarRef.current;
    const scrollContainer = containerRef.current;
    if (!node || !scrollContainer) return;
    const measure = () => {
      const tb = node.getBoundingClientRect();
      const w = tb.width;
      const h = tb.height;
      const cw = scrollContainer.clientWidth;
      const ch = scrollContainer.clientHeight;
      const st = scrollContainer.scrollTop;

      // Default: center above selection
      let left = state.anchorX - w / 2;
      let top = state.anchorTop - h - TOOLBAR_GAP;
      let flipped = false;

      // Flip below if there isn't room above (within visible viewport)
      if (top < st + TOOLBAR_PADDING) {
        top = state.anchorBottom + TOOLBAR_GAP;
        flipped = true;
      }

      // Clamp horizontally within container's visible width
      left = Math.max(TOOLBAR_PADDING, Math.min(left, cw - w - TOOLBAR_PADDING));
      // Clamp vertically within the currently-visible scroll viewport
      top = Math.max(st + TOOLBAR_PADDING, Math.min(top, st + ch - h - TOOLBAR_PADDING));

      // Caret X relative to toolbar, kept inside the toolbar's rounded corners
      const caretX = Math.max(CARET_INSET, Math.min(w - CARET_INSET, state.anchorX - left));

      setPos({ left, top, caretX, flipped });
    };
    measure();
  }, [state.anchorX, state.anchorTop, state.anchorBottom, containerRef]);

  const caretSide = pos?.flipped ? 'top' : 'bottom';
  const transformOrigin = pos
    ? `${pos.caretX}px ${pos.flipped ? 'top' : 'bottom'}`
    : 'center';

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Selection actions"
      className="absolute z-50 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-surface border border-border-bright shadow-xl selection-toolbar-enter"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        transformOrigin,
      }}
    >
      {pos && (
        <>
          {/* Caret border (back layer) */}
          <span
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: pos.caretX - 6,
              [caretSide]: -6,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              ...(pos.flipped
                ? { borderBottom: '6px solid var(--border-bright)' }
                : { borderTop: '6px solid var(--border-bright)' }),
            }}
          />
          {/* Caret fill (front layer, 1px inset on slanted edges) */}
          <span
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: pos.caretX - 5,
              [caretSide]: -5,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              ...(pos.flipped
                ? { borderBottom: '5px solid var(--surface)' }
                : { borderTop: '5px solid var(--surface)' }),
            }}
          />
        </>
      )}
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCopy(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        title="Copy selected text"
      >
        <Copy className="w-3 h-3" />
        Copy
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSearch(); }}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        title="Search in project"
      >
        <Search className="w-3 h-3" />
        Search
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onFix(); }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-medium hover:bg-accent-subtle transition-colors`}
        style={{ color: MODULE_COLORS.setup }}
        title="Fix with Claude"
      >
        <Zap className="w-3 h-3" />
        Fix
      </button>
    </div>
  );
}
