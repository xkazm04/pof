'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, RefreshCw, Download,
  Loader2, ClipboardCopy, Check, Presentation, Printer,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useGameDesignDoc } from '@/hooks/useGameDesignDoc';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { exportGDDAsPrintableHTML } from '@/lib/gdd-pitch';
import { UI_TIMEOUTS } from '@/lib/constants';
import { STATUS_ERROR, STATUS_SUCCESS } from '@/lib/chart-colors';
import { logger } from '@/lib/logger';
import { ACCENT, SECTION_ICONS } from './constants';
import { GDDSectionCard } from './GDDSectionCard';
import { StatRow } from './StatRow';

export function GameDesignDocView() {
  const projectName = useProjectStore((s) => s.projectName);
  const { gdd, isLoading, error, exportError, clearExportError, generate, exportMarkdown, exportPitch } = useGameDesignDoc(projectName);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
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
    clearExportError();
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
    clearExportError();
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
    clearExportError();
    setCopyError(null);
    const markdown = await exportMarkdown();
    if (!markdown) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
    } catch (err) {
      logger.error('GDD copy-to-clipboard failed', err);
      setCopyError('Copy failed — clipboard unavailable.');
      setTimeout(() => setCopyError(null), UI_TIMEOUTS.copyFeedback);
    }
  }, [exportMarkdown, clearExportError]);

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
            {(exportError || copyError) && (
              <span className="text-2xs" style={{ color: STATUS_ERROR }}>{exportError ?? copyError}</span>
            )}
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
