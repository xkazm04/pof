'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

interface MermaidDiagramProps {
  /** Mermaid source (pie / graph / flowchart / xychart …). */
  code: string;
  /** Accessible label for the diagram region. */
  ariaLabel: string;
  className?: string;
  /** Mermaid theme — defaults to 'dark' to match the surface-deep panels. */
  theme?: 'dark' | 'neutral' | 'default' | 'forest';
  /**
   * When provided, the diagram becomes interactive: each node gets a clickable
   * (and keyboard-operable) affordance and this fires with the node's DOM id.
   */
  onNodeClick?: (svgNodeId: string) => void;
  /** Gate which nodes are interactive (default: all). */
  isNodeInteractive?: (svgNodeId: string) => boolean;
}

/**
 * Renders Mermaid source to a real inline SVG, lazily loading the (large) mermaid
 * library only when a diagram actually mounts. The raw source stays visible as a
 * readable `<pre>` fallback while rendering and if it ever fails (offline, parse
 * error, or a layout engine — like jsdom — without getBBox), so a diagram is never
 * a blank box. Optionally wires click-to-jump on nodes.
 */
export function MermaidDiagram({
  code,
  ariaLabel,
  className,
  theme = 'dark',
  onNodeClick,
  isNodeInteractive,
}: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const reactId = useId();
  // mermaid uses the id as a DOM id + CSS selector — strip non-alphanumerics (useId emits `:r3:`).
  const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const interactive = !!onNodeClick;

  // Render the diagram (lazily importing mermaid).
  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
        const out = await mermaid.render(renderId, code);
        if (!cancelled) setSvg(out.svg);
      } catch (err) {
        // Keep the readable source fallback; surface the reason for debugging.
        if (!cancelled) logger.warn('Mermaid render failed; showing source fallback', err);
      }
    })();
    return () => { cancelled = true; };
  }, [code, theme, renderId]);

  // Wire node interactivity once the SVG is in the DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (!svg || !onNodeClick || !container) return;

    const cleanups: Array<() => void> = [];
    container.querySelectorAll<SVGGElement>('.node').forEach((node) => {
      if (isNodeInteractive && !isNodeInteractive(node.id)) return;

      node.style.cursor = 'pointer';
      node.setAttribute('role', 'button');
      node.setAttribute('tabindex', '0');
      const label = node.textContent?.trim();
      if (label) node.setAttribute('aria-label', `Open ${label}`);

      const fire = () => onNodeClick(node.id);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      };
      node.addEventListener('click', fire);
      node.addEventListener('keydown', onKey as EventListener);
      cleanups.push(() => {
        node.removeEventListener('click', fire);
        node.removeEventListener('keydown', onKey as EventListener);
      });
    });

    return () => cleanups.forEach((c) => c());
  }, [svg, onNodeClick, isNodeInteractive]);

  return (
    <div
      ref={containerRef}
      className={className}
      role={interactive ? 'group' : 'img'}
      aria-label={ariaLabel}
    >
      {svg ? (
        <div className="mermaid-rendered flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <pre className="text-2xs text-text-muted font-mono whitespace-pre leading-relaxed">{code}</pre>
      )}
    </div>
  );
}
