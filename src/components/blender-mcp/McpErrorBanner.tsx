'use client';

import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { ERROR_BANNER } from '@/lib/blender-mcp/status-tokens';

interface McpErrorBannerProps {
  /**
   * When true the banner expands into view; when false it collapses out.
   * Driving visibility through a prop (rather than conditionally mounting the
   * whole component) lets the framer-motion exit animation run on dismiss.
   */
  show: boolean;
  /** Stable AnimatePresence key — unique per banner instance on a panel. */
  motionKey?: string;
  /** Banner body, rendered to the right of the AlertTriangle icon. */
  children: ReactNode;
  /** Optional trailing action (e.g. a Troubleshoot button) pinned top-right. */
  action?: ReactNode;
}

/**
 * Shared collapsible error banner for the Blender MCP panels.
 *
 * Single source of truth for the AlertTriangle + ERROR_BANNER alert markup and
 * the height/opacity collapse animation, so the connection bar and viewport
 * preview stay consistent in look, motion timing, and accessibility
 * (role="alert" + aria-live="polite"). Sits next to {@link McpPanelFrame} and
 * the status-tokens single source of truth for MCP styling.
 */
export function McpErrorBanner({
  show,
  motionKey = 'mcp-error',
  children,
  action,
}: McpErrorBannerProps) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key={motionKey}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div
            role="alert"
            aria-live="polite"
            className={`flex items-start gap-2 mx-3 mt-2 text-xs leading-snug rounded-md px-2.5 py-2 ${ERROR_BANNER}`}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">{children}</div>
            {action}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
