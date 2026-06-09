'use client';

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, RefreshCw, X, Image as ImageIcon } from 'lucide-react';
import { useBlenderMCPStore } from '@/stores/blenderMCPStore';
import { captureViewportSnapshot } from '@/lib/blender-mcp/snapshot';
import { McpPanelFrame } from './McpPanelFrame';
import { McpErrorBanner } from './McpErrorBanner';

export function ViewportPreview() {
  const { connection, addScreenshot, recentScreenshots } = useBlenderMCPStore();
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const captureScreenshot = useCallback(async () => {
    if (!connection.connected || isCapturing) return;
    setIsCapturing(true);
    setCaptureError(null);
    const result = await captureViewportSnapshot();
    if (result.ok) {
      addScreenshot(result.data);
      // New screenshot is unshifted to [0] — pin the active selection to it.
      setActiveIndex(0);
    } else {
      setCaptureError(result.error);
    }
    setIsCapturing(false);
  }, [connection.connected, isCapturing, addScreenshot]);

  // Clamp during render so external store mutations (e.g. clearScreenshots)
  // don't leave us pointing at a stale index.
  const safeActiveIndex = recentScreenshots.length === 0
    ? 0
    : Math.min(activeIndex, recentScreenshots.length - 1);
  const activeScreenshot = recentScreenshots[safeActiveIndex];

  // Esc closes lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen]);

  const captureButton = (
    <button
      onClick={captureScreenshot}
      disabled={!connection.connected || isCapturing}
      aria-label="Capture viewport screenshot"
      className="focus-ring inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold text-text-muted hover:text-text hover:bg-surface-tertiary disabled:opacity-40 transition-colors"
    >
      {isCapturing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Camera className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      Capture
    </button>
  );

  return (
    <>
      <McpPanelFrame
        title="Blender Viewport"
        icon={<ImageIcon className="w-4 h-4" />}
        actions={captureButton}
        bodyPadding="none"
      >
        {/* Inline error chip (silent failure surfaced) */}
        <McpErrorBanner show={!!captureError} motionKey="capture-error">
          <span className="tabular-nums">{captureError}</span>
        </McpErrorBanner>

        {/* Main stage */}
        <div
          className={`aspect-video bg-black/50 flex items-center justify-center relative ${
            activeScreenshot ? 'cursor-zoom-in' : ''
          }`}
          onClick={() => activeScreenshot && setLightboxOpen(true)}
          role={activeScreenshot ? 'button' : undefined}
          aria-label={activeScreenshot ? 'Open screenshot in lightbox' : undefined}
          tabIndex={activeScreenshot ? 0 : -1}
          onKeyDown={(e) => {
            if (activeScreenshot && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setLightboxOpen(true);
            }
          }}
        >
          {isCapturing && !activeScreenshot ? (
            <ShimmerSkeleton />
          ) : activeScreenshot ? (
            <motion.img
              key={activeScreenshot}
              layoutId={`viewport-shot-${activeScreenshot}`}
              src={activeScreenshot}
              alt={`Blender viewport snapshot ${safeActiveIndex + 1}`}
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-[13px] text-text-muted px-3 text-center">
              {connection.connected
                ? 'Click Capture to preview the viewport'
                : 'Connect to Blender first'}
            </span>
          )}
          {/* Subtle shimmer overlay while a fresh capture is in flight */}
          {isCapturing && activeScreenshot && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
              <ShimmerSkeleton compact />
            </div>
          )}
        </div>

        {/* Thumbnail filmstrip */}
        {recentScreenshots.length > 0 && (
          <div
            className="flex gap-2 p-2 border-t border-border bg-surface-deep/30"
            role="listbox"
            aria-label="Recent viewport screenshots"
          >
            {recentScreenshots.map((shot, idx) => {
              const isActive = idx === safeActiveIndex;
              return (
                <button
                  key={shot}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative w-16 h-10 rounded-md overflow-hidden bg-black/40 transition-all ${
                    isActive
                      ? 'ring-1 ring-accent'
                      : 'opacity-70 hover:opacity-100 ring-1 ring-transparent'
                  }`}
                  title={idx === 0 ? 'Latest' : `Earlier (${idx + 1})`}
                >
                  <motion.img
                    layoutId={`viewport-shot-thumb-${shot}`}
                    src={shot}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
      </McpPanelFrame>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && activeScreenshot && (
          <motion.div
            key="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setLightboxOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Viewport screenshot, zoomed"
          >
            <motion.img
              layoutId={`viewport-shot-${activeScreenshot}`}
              src={activeScreenshot}
              alt="Blender viewport, zoomed"
              className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close lightbox"
              className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Shimmer skeleton (no extra dependency; CSS gradient + framer pulse) ──── */

function ShimmerSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-deep ${
        compact ? 'w-32 h-20 rounded-md' : 'w-full h-full'
      }`}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
      {!compact && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-text-muted">
          Capturing viewport…
        </div>
      )}
    </div>
  );
}
