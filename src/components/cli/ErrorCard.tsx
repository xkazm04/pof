'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, AlertTriangle, FileCode, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import type { BuildDiagnostic } from './UE5BuildParser';

interface ErrorCardProps {
  diagnostic: BuildDiagnostic;
  onFix?: (prompt: string) => void;
}

const SEVERITY_STYLES = {
  error: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    icon: AlertCircle,
    iconColor: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300',
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

export function ErrorCard({ diagnostic, onFix }: ErrorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[diagnostic.severity];
  const Icon = style.icon;

  const shortFile = diagnostic.file
    ? diagnostic.file.split(/[/\\]/).pop() ?? diagnostic.file
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-2 my-1 rounded border ${style.border} ${style.bg} overflow-hidden`}
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
          </div>
          <p className="text-xs text-[#c8cce0] mt-0.5 leading-tight break-all">
            {diagnostic.message.length > 150 && !expanded
              ? diagnostic.message.slice(0, 150) + '...'
              : diagnostic.message}
          </p>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-border/50">
          {/* File location */}
          {diagnostic.file && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <FileCode className="w-3 h-3 text-text-muted" />
              <span className="text-xs font-mono text-[#9ca0be]">
                {diagnostic.file}
                {diagnostic.line != null && `:${diagnostic.line}`}
                {diagnostic.column != null && `:${diagnostic.column}`}
              </span>
            </div>
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
                onFix(buildQuickFixPrompt(diagnostic));
              }}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
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
                onFix(buildQuickFixPrompt(diagnostic));
              }}
              className="ml-auto text-2xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
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
