'use client';

import {
  ImagePlus, Wand2, Upload, X, RefreshCw, SplitSquareHorizontal, AlertCircle,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { MODULE_COLORS } from '@/lib/constants';
import { EXAMPLE_REFERENCES } from './constants';
import { AnalysisMiniPreview } from './AnalysisMiniPreview';
import { AnalysisResults } from './AnalysisResults';
import { useMaterialStyleTransfer } from './useMaterialStyleTransfer';
import type { StyleTransferConfig } from './types';

export type { AnalyzedProperties, StyleTransferConfig } from './types';

// ── Component ──

interface MaterialStyleTransferProps {
  onGenerate: (config: StyleTransferConfig) => void;
  isGenerating: boolean;
}

export function MaterialStyleTransfer({ onGenerate, isGenerating }: MaterialStyleTransferProps) {
  const {
    imageDataUrl,
    referenceDescription,
    setReferenceDescription,
    analysis,
    isAnalyzing,
    analyzeError,
    uploadError,
    adjustmentsOpen,
    setAdjustmentsOpen,
    compareMode,
    setCompareMode,
    fileInputRef,
    overrideRoughness,
    setOverrideRoughness,
    overrideMetallic,
    setOverrideMetallic,
    overrideEmissive,
    setOverrideEmissive,
    overrideSurface,
    setOverrideSurface,
    effectiveAnalysis,
    handleFileSelect,
    handleDrop,
    handleClearImage,
    handleAnalyze,
    handleGenerate,
    handleExampleClick,
  } = useMaterialStyleTransfer(onGenerate);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4" style={{ color: MODULE_COLORS.content }} />
          <div>
            <h3 className="text-xs font-semibold text-text">Style Transfer</h3>
            <p className="text-2xs text-text-muted">
              Upload a reference screenshot to generate matching UE5 materials
            </p>
          </div>
        </div>
        {analysis && (
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium border transition-colors ${
              compareMode
                ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
                : 'bg-surface border-border text-text-muted hover:text-text'
            }`}
          >
            <SplitSquareHorizontal className="w-3 h-3" />
            Compare
          </button>
        )}
      </div>

      {/* Image Upload / Drop Zone */}
      <div
        className="relative rounded-xl border-2 border-dashed transition-colors overflow-hidden"
        style={{
          borderColor: imageDataUrl ? `${MODULE_COLORS.content}40` : 'var(--border)',
          backgroundColor: imageDataUrl ? `${MODULE_COLORS.content}04` : 'var(--surface-deep)',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {imageDataUrl ? (
          <div className={`${compareMode && analysis ? 'grid grid-cols-2 gap-0' : ''}`}>
            {/* Reference image */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl}
                alt="Reference"
                className="w-full max-h-48 object-contain bg-black/20"
              />
              <button
                type="button"
                onClick={handleClearImage}
                aria-label="Remove reference image"
                className="focus-ring absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-3 h-3 text-white" aria-hidden="true" />
              </button>
              {compareMode && (
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-2xs text-white font-medium">
                  Reference
                </div>
              )}
            </div>

            {/* Analysis preview (compare mode) */}
            {compareMode && analysis && (
              <div className="bg-surface-deep flex flex-col items-center justify-center p-4 min-h-[12rem]">
                <div className="text-2xs text-text-muted mb-2 font-medium">Analyzed Properties</div>
                <AnalysisMiniPreview analysis={effectiveAnalysis!} />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="focus-ring w-full py-10 flex flex-col items-center gap-2 text-text-muted hover:text-text transition-colors"
          >
            <Upload className="w-8 h-8 opacity-40" aria-hidden="true" />
            <span className="text-xs font-medium">Drop a screenshot or click to upload</span>
            <span className="text-2xs text-text-muted/60">PNG, JPG up to 10MB</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Rejected upload — say why instead of dropping the file in silence */}
      {uploadError && (
        <div
          role="alert"
          data-testid="style-upload-error"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{uploadError}</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="focus-ring shrink-0 font-medium underline underline-offset-2 hover:text-amber-300 transition-colors"
          >
            Choose another
          </button>
        </div>
      )}

      {/* Reference Description */}
      <div>
        <label className="text-2xs font-medium text-text-muted block mb-1">
          Describe the look you want (optional with image, required without)
        </label>
        <textarea
          value={referenceDescription}
          onChange={(e) => setReferenceDescription(e.target.value)}
          placeholder="e.g., Stylized fire with scrolling noise, bright orange-to-red color ramp, flickering emissive edges..."
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text placeholder-text-muted/50 outline-none focus:border-border-bright transition-colors resize-none"
          rows={2}
        />
      </div>

      {/* Example references */}
      {!analysis && (
        <div>
          <div className="text-2xs font-medium text-text-muted mb-1.5">Quick examples</div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_REFERENCES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => handleExampleClick(ex.desc)}
                className="px-2 py-1 rounded-full bg-surface border border-border text-2xs text-text-muted hover:text-text hover:border-border-bright transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {!analysis && (
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!imageDataUrl && !referenceDescription.trim())}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{
            backgroundColor: `${MODULE_COLORS.content}15`,
            color: MODULE_COLORS.content,
            border: `1px solid ${MODULE_COLORS.content}30`,
          }}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Analyzing visual properties...
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5" />
              Analyze Reference
            </>
          )}
        </button>
      )}

      {/* Analysis failure — inline alert matching the shared red banner pattern */}
      {analyzeError && (
        <div
          role="alert"
          data-testid="style-analyze-error"
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 flex-1">Analysis failed: {analyzeError}</span>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="shrink-0 font-medium underline underline-offset-2 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Analysis Results */}
      <AnimatePresence>
        {analysis && (
          <AnalysisResults
            analysis={analysis}
            effectiveAnalysis={effectiveAnalysis!}
            adjustmentsOpen={adjustmentsOpen}
            setAdjustmentsOpen={setAdjustmentsOpen}
            overrideRoughness={overrideRoughness}
            setOverrideRoughness={setOverrideRoughness}
            overrideMetallic={overrideMetallic}
            setOverrideMetallic={setOverrideMetallic}
            overrideEmissive={overrideEmissive}
            setOverrideEmissive={setOverrideEmissive}
            overrideSurface={overrideSurface}
            setOverrideSurface={setOverrideSurface}
            handleAnalyze={handleAnalyze}
            isAnalyzing={isAnalyzing}
            handleGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
