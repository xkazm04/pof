'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, AlertTriangle, FileCode, ChevronDown, ChevronRight, Zap, Copy, Check,
} from 'lucide-react';
import type { BuildDiagnostic } from './UE5BuildParser';
import { TruncateWithTooltip } from '@/components/ui/TruncateWithTooltip';
import { UI_TIMEOUTS } from '@/lib/constants';
import { MODULE_COLORS } from '@/lib/chart-colors';

interface ErrorCardProps {
  diagnostic: BuildDiagnostic;
  onFix?: (prompt: string) => void;
  isRunning?: boolean;
}

const SEVERITY_STYLES = {
  error: {
    border: 'border-status-red-strong',
    bg: 'bg-status-red-subtle',
    icon: AlertCircle,
    iconColor: 'text-red-400',
    badge: 'bg-status-red-medium text-red-300',
    label: 'ERROR',
  },
  warning: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300',
    label: 'WARN',
  },
} as const;

const CATEGORY_LABELS: Record<BuildDiagnostic['category'], string> = {
  compile: 'Compile',
  linker: 'Linker',
  ubt: 'UBT',
  general: 'General',
};

const CATEGORY_BORDER_COLORS: Record<BuildDiagnostic['category'], string> = {
  compile: MODULE_COLORS.core,
  linker: MODULE_COLORS.systems,
  ubt: MODULE_COLORS.content,
  general: 'var(--border)',
};

export function ErrorCard({ diagnostic, onFix, isRunning = false }: ErrorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [pathExpanded, setPathExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const style = SEVERITY_STYLES[diagnostic.severity];
  const Icon = style.icon;

  const shortFile = diagnostic.file
    ? diagnostic.file.split(/[/\\]/).pop() ?? diagnostic.file
    : null;

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const parts: string[] = [diagnostic.message];
    if (diagnostic.file) {
      parts.push(`File: ${diagnostic.file}${diagnostic.line != null ? `:${diagnostic.line}` : ''}${diagnostic.column != null ? `:${diagnostic.column}` : ''}`);
    }
    if (diagnostic.rawText) {
      parts.push(diagnostic.rawText);
    }
    await navigator.clipboard.writeText(parts.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), UI_TIMEOUTS.copyFeedback);
  }, [diagnostic]);

  const categoryBorderColor = CATEGORY_BORDER_COLORS[diagnostic.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-2 my-1 rounded border ${style.border} ${style.bg} overflow-hidden`}
      style={{ borderLeftWidth: 3, borderLeftColor: categoryBorderColor }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
          : <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5" />
        }
        <Icon className={`w-3.5 h-3.5 ${style.iconColor} flex-shrink-0 mt-px`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-2xs font-bold px-1 py-px rounded ${style.badge}`}>
              {style.label}
            </span>
            {diagnostic.code && (
              <span className="text-2xs font-mono text-text-muted-hover bg-surface-hover px-1 py-px rounded">
                {diagnostic.code}
              </span>
            )}
            <span className="text-2xs text-text-muted">
              {CATEGORY_LABELS[diagnostic.category]}
            </span>
            {/* Copy button */}
            <span
              role="button"
              tabIndex={0}
              onClick={handleCopy}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCopy(e as unknown as React.MouseEvent); }}
              className="ml-auto p-0.5 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              title={copied ? 'Copied!' : 'Copy error details'}
            >
              {copied
                ? <Check className="w-3 h-3 text-[#4ade80]" />
                : <Copy className="w-3 h-3" />
              }
            </span>
          </div>
          {expanded ? (
            <p className="text-xs text-[#c8cce0] mt-0.5 leading-tight break-all">
              {diagnostic.message}
            </p>
          ) : (
            <TruncateWithTooltip as="p" className="text-xs text-[#c8cce0] mt-0.5 leading-tight break-all line-clamp-2" side="bottom" maxTooltipWidth={400}>
              {diagnostic.message}
            </TruncateWithTooltip>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-border/50">
          {/* File location — collapsible path */}
          {diagnostic.file && shortFile && (
            <button
              onClick={() => setPathExpanded(!pathExpanded)}
              className="flex items-center gap-1.5 mt-1.5 group/path hover:bg-white/[0.02] rounded px-1 -mx-1 transition-colors"
              title={pathExpanded ? 'Collapse path' : 'Show full path'}
            >
              <FileCode className="w-3 h-3 text-text-muted flex-shrink-0" />
              <span className="text-xs font-mono text-text-muted">
                {pathExpanded ? (
                  <>
                    {diagnostic.file}
                    {diagnostic.line != null && `:${diagnostic.line}`}
                    {diagnostic.column != null && `:${diagnostic.column}`}
                  </>
                ) : (
                  <>
                    {shortFile}
                    {diagnostic.line != null && `:${diagnostic.line}`}
                    {diagnostic.column != null && `:${diagnostic.column}`}
                  </>
                )}
              </span>
              {diagnostic.file !== shortFile && (
                <span className="text-2xs text-text-muted opacity-30 scale-95 group-hover/path:opacity-100 group-hover/path:scale-100 transition-all">
                  {pathExpanded ? '▸ collapse' : '▸ full path'}
                </span>
              )}
            </button>
          )}

          {/* Raw text */}
          <pre className="mt-1.5 text-2xs font-mono text-text-muted bg-background rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
            {diagnostic.rawText}
          </pre>

          {/* Fix button */}
          {onFix && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRunning) onFix(buildQuickFixPrompt(diagnostic));
              }}
              disabled={isRunning}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-blue-400 disabled:hover:bg-blue-500/10"
            >
              <Zap className="w-3 h-3" />
              Fix This
            </button>
          )}
        </div>
      )}

      {/* Collapsed file hint */}
      {!expanded && shortFile && (
        <div className="px-2.5 pb-1 flex items-center gap-1">
          <FileCode className="w-2.5 h-2.5 text-text-muted" />
          <span className="text-2xs font-mono text-text-muted">
            {shortFile}
            {diagnostic.line != null && `:${diagnostic.line}`}
          </span>
          {onFix && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isRunning) onFix(buildQuickFixPrompt(diagnostic));
              }}
              disabled={isRunning}
              className="ml-auto text-2xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-blue-400"
            >
              Fix
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function buildQuickFixPrompt(d: BuildDiagnostic): string {
  const fileRef = d.file
    ? `in file ${d.file}${d.line ? ` at line ${d.line}` : ''}`
    : '';
  const codeRef = d.code ? ` (${d.code})` : '';

  let prompt = `Fix this compilation ${d.severity}${codeRef} ${fileRef}:\n\n${d.message}`;

  if (d.file) {
    prompt += `\n\nStart by reading ${d.file} to understand the context around ${d.line ? `line ${d.line}` : 'the issue'}.`;
  }

  if (d.category === 'linker') {
    prompt += `\n\nThis is a linker error. Check for:\n- Missing #include directives\n- Missing module dependencies in Build.cs\n- Unimplemented declared functions\n- Incorrect UCLASS/UFUNCTION signatures`;
  }

  prompt += `\n\nAfter fixing, verify the build compiles successfully.`;
  return prompt;
}
