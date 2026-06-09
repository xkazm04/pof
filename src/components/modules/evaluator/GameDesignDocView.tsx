'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  FileText, RefreshCw, Download, ChevronRight, ChevronDown,
  Loader2, BarChart3, Map, Volume2, Wrench, Package,
  Layers, ClipboardCopy, Check, Presentation, Printer,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useNavigationStore } from '@/stores/navigationStore';
import { useGameDesignDoc } from '@/hooks/useGameDesignDoc';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { MermaidDiagram } from '@/components/ui/MermaidDiagram';
import type { GDDSection } from '@/lib/gdd-synthesizer';
import { mermaidNodeIdToModuleId } from '@/lib/gdd-mermaid';
import { exportGDDAsPrintableHTML } from '@/lib/gdd-pitch';
import { useDisclosure } from '@/hooks/useDisclosure';
import { UI_TIMEOUTS } from '@/lib/constants';
import { MODULE_COLORS, STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { logger } from '@/lib/logger';

const ACCENT = MODULE_COLORS.evaluator;

/** A diagram node is interactive only when it resolves to a real sub-module. */
const isModuleNode = (svgNodeId: string) => mermaidNodeIdToModuleId(svgNodeId) !== null;

const SECTION_ICONS: Record<string, typeof FileText> = {
  'overview': BarChart3,
  'core-systems': Layers,
  'roadmap': FileText,
  'level-design': Map,
  'audio-design': Volume2,
  'architecture': Wrench,
  'deployment': Package,
};

export function GameDesignDocView() {
  const projectName = useProjectStore((s) => s.projectName);
  const { gdd, isLoading, error, generate, exportMarkdown, exportPitch } = useGameDesignDoc(projectName);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPitch, setExportingPitch] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-generate on mount
  useEffect(() => {
    generate();
  }, [generate]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    const markdown = await exportMarkdown();
    setExporting(false);
    if (!markdown) return;

    // Download as .md file
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-GDD.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportMarkdown, projectName]);

  const handleExportPitch = useCallback(async () => {
    setExportingPitch(true);
    const html = await exportPitch();
    setExportingPitch(false);
    if (!html) return;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-pitch.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportPitch, projectName]);

  const handleCopyMarkdown = useCallback(async () => {
    const markdown = await exportMarkdown();
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [exportMarkdown]);

  // Print-to-PDF: render the live GDD (cover scorecard + diagrams) into a new
  // window and let the browser "Save as PDF". Falls back to downloading the
  // printable HTML if the popup is blocked.
  const handleExportPDF = useCallback(() => {
    if (!gdd) return;
    setExportingPdf(true);
    try {
      const html = exportGDDAsPrintableHTML(gdd);
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        return;
      }
      // Popup blocked — fall back to a downloadable print-ready HTML file.
      logger.warn('GDD PDF export: popup blocked, falling back to HTML download');
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-GDD-print.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingPdf(false);
    }
  }, [gdd, projectName]);

  if (isLoading && !gdd) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Synthesizing design document...</span>
      </div>
    );
  }

  if (error && !gdd) {
    return (
      <SurfaceCard className="m-4 p-6 text-center">
        <p className="text-sm mb-3" style={{ color: STATUS_ERROR }}>{error}</p>
        <button
          onClick={generate}
          className="px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
        >
          Retry
        </button>
      </SurfaceCard>
    );
  }

  if (!gdd) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-xl border border-border flex items-center justify-center mb-4" style={{ backgroundColor: `${ACCENT}10` }}>
          <FileText className="w-6 h-6" style={{ color: ACCENT }} />
        </div>
        <h3 className="text-sm font-semibold text-text mb-1">Design Document</h3>
        <p className="text-xs text-text-muted max-w-xs leading-relaxed">
          Generate a comprehensive Game Design Document synthesized from your project configuration, module progress, and checklist state.
        </p>
        <button
          onClick={generate}
          className="flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: `${ACCENT}14`, color: ACCENT, border: `1px solid ${ACCENT}38` }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Generate GDD
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar TOC */}
      <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto py-3 px-2">
        <div className="flex items-center gap-2 px-2 mb-3">
          <FileText className="w-3.5 h-3.5" style={{ color: ACCENT }} />
          <span className="text-xs font-semibold text-text">Contents</span>
        </div>
        {gdd.sections.map((section) => {
          const Icon = SECTION_ICONS[section.id] ?? FileText;
          return (
            <button
              key={section.id}
              onClick={() => {
                setActiveSectionId(section.id);
                // Scroll to section
                const el = document.getElementById(`gdd-${section.id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-current={activeSectionId === section.id ? 'true' : undefined}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors mb-0.5 ${
                activeSectionId === section.id
                  ? 'bg-surface-hover text-text'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover/50'
              }`}
            >
              <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{section.title}</span>
            </button>
          );
        })}

        {/* Stats */}
        <div className="mt-4 px-2 pt-3 border-t border-border space-y-1.5">
          <StatRow label="Features" value={`${gdd.stats.implementedFeatures}/${gdd.stats.totalFeatures}`} />
          <StatRow label="Checklist" value={`${gdd.stats.checklistDone}/${gdd.stats.checklistTotal}`} />
          <StatRow label="Levels" value={String(gdd.stats.levelCount)} />
          <StatRow label="Audio Scenes" value={String(gdd.stats.audioSceneCount)} />
          <StatRow label="Eval Findings" value={String(gdd.stats.evalFindingCount)} />
          <StatRow label="Builds" value={String(gdd.stats.buildCount)} />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-background/90 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{gdd.title}</span>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin text-text-muted" />}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={generate}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-40"
              title="Regenerate"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleCopyMarkdown}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              title="Copy as Markdown"
            >
              {copied ? <Check className="w-3 h-3" style={{ color: STATUS_SUCCESS }} /> : <ClipboardCopy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Export .md
            </button>
            <button
              onClick={handleExportPitch}
              disabled={exportingPitch}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors"
              style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
              title="Export a shareable single-page pitch (HTML)"
            >
              {exportingPitch ? <Loader2 className="w-3 h-3 animate-spin" /> : <Presentation className="w-3 h-3" />}
              Export Pitch
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors disabled:opacity-40"
              style={{ backgroundColor: `${ACCENT}15`, color: ACCENT, border: `1px solid ${ACCENT}30` }}
              title="Export a print-ready PDF (compliance scorecard cover + diagrams)"
            >
              {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
              Export PDF
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="px-4 py-4 space-y-4">
          {gdd.sections.map((section) => (
            <GDDSectionCard
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ───────────────────────────────────────────────────────────

function GDDSectionCard({ section, isExpanded, onToggle }: {
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

// ─── Markdown renderer (lightweight — tables, headings, lists, bold, italic)

function MarkdownBlock({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table detection
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.includes('---')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="text-xs font-semibold text-text mt-3 mb-1.5">{line.slice(4)}</h4>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-sm font-semibold text-text mt-3 mb-1.5">{line.slice(3)}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="text-sm font-bold text-text mt-2 mb-1">{line.slice(2)}</h2>);
      i++;
      continue;
    }

    // List item
    if (line.startsWith('- ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 text-xs text-text-muted leading-relaxed ml-1">
          <span className="text-text-muted flex-shrink-0">•</span>
          <span><InlineMarkdown text={line.slice(2)} /></span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-xs text-text-muted leading-relaxed">
        <InlineMarkdown text={line} />
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Handle **bold** and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-text font-medium">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="text-text-muted-hover">{part.slice(1, -1)}</em>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line.split('|').map((c) => c.trim()).filter(Boolean);

  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow); // skip separator row

  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-1.5 px-2 text-text-muted font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50">
              {row.map((cell, ci) => (
                <td key={ci} className="py-1 px-2 text-text-muted">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Stat row ───────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-2xs text-text-muted">{label}</span>
      <span className="text-2xs font-medium text-text">{value}</span>
    </div>
  );
}
