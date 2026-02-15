'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Code2, Copy, Check, Download, FileCode, ChevronDown,
  ChevronRight, Cpu, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Badge } from '@/components/ui/Badge';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { GeneratedFile } from '@/lib/economy/codegen';

// ── Constants ────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  h: '#a855f7',
  cpp: '#3b82f6',
};

const LANG_LABELS: Record<string, string> = {
  h: 'Header',
  cpp: 'Source',
};

// ── Main Component ───────────────────────────────────────────────────────────

export function EconomyCodeGenPanel() {
  const result = useEconomySimulatorStore((s) => s.result);
  const codeGenResult = useEconomySimulatorStore((s) => s.codeGenResult);
  const isGenerating = useEconomySimulatorStore((s) => s.isGenerating);
  const generateCode = useEconomySimulatorStore((s) => s.generateCode);

  const [expanded, setExpanded] = useState(false);
  const [selectedFile, setSelectedFile] = useState(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    const res = await generateCode();
    if (res) setExpanded(true);
  }, [generateCode]);

  const handleCopy = useCallback(async (file: GeneratedFile) => {
    await navigator.clipboard.writeText(file.content);
    setCopiedFile(file.filename);
    setTimeout(() => setCopiedFile(null), 2000);
  }, []);

  const handleDownloadAll = useCallback(() => {
    if (!codeGenResult) return;
    for (const file of codeGenResult.files) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [codeGenResult]);

  const activeFile = codeGenResult?.files[selectedFile] ?? null;

  // Line count per file for display
  const fileSummaries = useMemo(() => {
    if (!codeGenResult) return [];
    return codeGenResult.files.map((f) => ({
      ...f,
      lines: f.content.split('\n').length,
    }));
  }, [codeGenResult]);

  if (!result) return null;

  return (
    <SurfaceCard className="overflow-hidden">
      {/* Header / Generate button */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => codeGenResult ? setExpanded(!expanded) : handleGenerate()}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {codeGenResult && (
            expanded
              ? <ChevronDown className="w-4 h-4 text-text-muted" />
              : <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-text">UE5 Code Generator</span>
          {codeGenResult && (
            <Badge variant="success">{codeGenResult.files.length} files</Badge>
          )}
        </button>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Cpu className="w-3 h-3" />
          )}
          {isGenerating ? 'Generating...' : codeGenResult ? 'Regenerate' : 'Generate UE5 Code'}
        </button>

        {codeGenResult && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-lg text-text-muted text-xs font-medium hover:text-text hover:border-border-bright transition-colors"
          >
            <Download className="w-3 h-3" />
            All
          </button>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && codeGenResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {/* File tabs */}
              <div className="flex border-b border-border overflow-x-auto">
                {fileSummaries.map((file, i) => (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedFile(i)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-2xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                      selectedFile === i
                        ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                        : 'border-transparent text-text-muted hover:text-text hover:bg-surface-hover/50'
                    }`}
                  >
                    <FileCode
                      className="w-3 h-3"
                      style={{ color: LANG_COLORS[file.language] ?? '#888' }}
                    />
                    {file.filename}
                    <span className="text-text-muted/50">{file.lines}L</span>
                  </button>
                ))}
              </div>

              {/* File content */}
              {activeFile && (
                <div className="relative">
                  {/* File description + copy */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-surface-deep border-b border-border">
                    <Badge>
                      {LANG_LABELS[activeFile.language] ?? activeFile.language}
                    </Badge>
                    <span className="text-2xs text-text-muted flex-1 truncate">
                      {activeFile.description}
                    </span>
                    <button
                      onClick={() => handleCopy(activeFile)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-text-muted hover:text-text hover:bg-border transition-colors"
                    >
                      {copiedFile === activeFile.filename ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>

                  {/* Code block with line numbers */}
                  <div className="max-h-96 overflow-auto">
                    <pre className="text-2xs leading-relaxed font-mono">
                      <code className="block">
                        {activeFile.content.split('\n').map((line, i) => (
                          <div key={i} className="flex hover:bg-surface-hover/30">
                            <span className="select-none text-text-muted/30 text-right pr-3 pl-3 py-px w-10 flex-shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-text/90 py-px pr-4 flex-1 whitespace-pre">
                              {line}
                            </span>
                          </div>
                        ))}
                      </code>
                    </pre>
                  </div>
                </div>
              )}

              {/* Summary footer */}
              <div className="flex items-center gap-4 px-4 py-2 bg-surface-deep border-t border-border text-2xs text-text-muted">
                <span>{codeGenResult.files.length} files generated</span>
                <span>Philosophy: {codeGenResult.config.philosophy}</span>
                <span>Max Level: {codeGenResult.config.maxLevel}</span>
                <span>{codeGenResult.config.agentCount} agents calibration</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
