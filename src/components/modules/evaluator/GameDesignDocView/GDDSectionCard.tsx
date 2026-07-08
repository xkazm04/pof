'use client';

import { useCallback, useId } from 'react';
import {
  ChevronRight, ChevronDown, FileText,
} from 'lucide-react';
import { useNavigationStore } from '@/stores/navigationStore';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MermaidDiagram } from '@/components/ui/MermaidDiagram';
import type { GDDSection } from '@/lib/gdd-synthesizer';
import { mermaidNodeIdToModuleId } from '@/lib/gdd-mermaid';
import { useDisclosure } from '@/hooks/useDisclosure';
import { ACCENT, SECTION_ICONS, isModuleNode } from './constants';
import { MarkdownBlock } from './Markdown';

// ─── Section Card ───────────────────────────────────────────────────────────

export function GDDSectionCard({ section, isExpanded, onToggle }: {
  section: GDDSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = SECTION_ICONS[section.id] ?? FileText;
  const hasChildren = (section.subsections?.length ?? 0) > 0 || !!section.mermaid;
  const panelId = `gdd-section-panel-${useId()}`;
  const navigateToModule = useNavigationStore((s) => s.navigateToModule);

  // The Core Systems architecture map's nodes are modules — click to jump to one.
  const isArchitecture = section.id === 'core-systems';
  const handleNodeClick = useCallback((svgNodeId: string) => {
    const moduleId = mermaidNodeIdToModuleId(svgNodeId);
    if (moduleId) navigateToModule(moduleId);
  }, [navigateToModule]);

  return (
    <SurfaceCard id={`gdd-${section.id}`}>
      {/* Section header — a disclosure toggle when it has collapsible children */}
      <button
        onClick={onToggle}
        {...(hasChildren ? { 'aria-expanded': isExpanded, 'aria-controls': panelId } : {})}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-surface-hover/40 transition-colors"
      >
        {hasChildren ? (
          isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" aria-hidden="true" />
            : <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" aria-hidden="true" />
        ) : (
          <div className="w-3.5" />
        )}
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} aria-hidden="true" />
        <span className="text-sm font-medium text-text">{section.title}</span>
      </button>

      {/* Section content (always visible) */}
      <div className="px-4 pb-3">
        <MarkdownBlock content={section.content} />
      </div>

      {/* Collapsible region — diagram + subsections */}
      {isExpanded && hasChildren && (
        <div id={panelId}>
          {section.mermaid && (
            <div className="mx-4 mb-3">
              <MermaidDiagram
                code={section.mermaid}
                ariaLabel={`${section.title} diagram`}
                className="p-3 bg-surface-deep rounded-lg overflow-x-auto"
                {...(isArchitecture
                  ? { onNodeClick: handleNodeClick, isNodeInteractive: isModuleNode }
                  : {})}
              />
              {isArchitecture && (
                <p className="mt-1.5 text-2xs text-text-muted">
                  Click a system to open its module.
                </p>
              )}
            </div>
          )}
          {section.subsections?.map((sub) => (
            <SubSectionBlock key={sub.id} section={sub} />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

function SubSectionBlock({ section }: { section: GDDSection }) {
  const { open, toggle, buttonProps, panelProps } = useDisclosure(false);

  return (
    <div className="border-t border-border">
      <button
        onClick={toggle}
        {...buttonProps}
        className="w-full flex items-center gap-2 px-6 py-2 text-left hover:bg-surface-hover/30 transition-colors"
      >
        {open
          ? <ChevronDown className="w-3 h-3 text-text-muted" aria-hidden="true" />
          : <ChevronRight className="w-3 h-3 text-text-muted" aria-hidden="true" />
        }
        <span className="text-xs font-medium text-text">{section.title}</span>
      </button>
      {open && (
        <div {...panelProps} className="px-6 pb-3">
          <MarkdownBlock content={section.content} />
          {section.mermaid && (
            <MermaidDiagram
              code={section.mermaid}
              ariaLabel={`${section.title} diagram`}
              className="mt-2 p-2.5 bg-surface-deep rounded-lg overflow-x-auto"
            />
          )}
        </div>
      )}
    </div>
  );
}
