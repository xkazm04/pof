import { useState, useCallback, useRef, useMemo } from 'react';
import { formatBytes } from '@/lib/format';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types/api';
import type { SurfaceType } from '../MaterialParameterConfigurator';
import type { AnalyzedProperties, StyleTransferConfig } from './types';

/** Upload ceiling advertised on the drop zone — rejections must say so, not fail mute. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Returns the reason a file can't be used as a reference, or null when it's fine. */
function rejectionReason(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return `"${file.name}" is not an image (${file.type || 'unknown type'}) — use a PNG or JPG screenshot.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — over the ${formatBytes(MAX_UPLOAD_BYTES)} upload limit.`;
  }
  return null;
}

export function useMaterialStyleTransfer(onGenerate: (config: StyleTransferConfig) => void) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [referenceDescription, setReferenceDescription] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzedProperties | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adjustable overrides on top of analysis
  const [overrideRoughness, setOverrideRoughness] = useState<number | null>(null);
  const [overrideMetallic, setOverrideMetallic] = useState<number | null>(null);
  const [overrideEmissive, setOverrideEmissive] = useState<number | null>(null);
  const [overrideSurface, setOverrideSurface] = useState<SurfaceType | null>(null);

  const effectiveAnalysis = useMemo(() => {
    if (!analysis) return null;
    return {
      ...analysis,
      roughness: overrideRoughness ?? analysis.roughness,
      metallic: overrideMetallic ?? analysis.metallic,
      emissiveIntensity: overrideEmissive ?? analysis.emissiveIntensity,
      surfaceType: overrideSurface ?? analysis.surfaceType,
    };
  }, [analysis, overrideRoughness, overrideMetallic, overrideEmissive, overrideSurface]);

  /** One accept path for both the picker and the drop zone — every rejection reports why. */
  const acceptFile = useCallback((file: File) => {
    const reason = rejectionReason(file);
    if (reason) {
      setUploadError(reason);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadError(null);
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
      setAnalyzeError(null);
      setOverrideRoughness(null);
      setOverrideMetallic(null);
      setOverrideEmissive(null);
      setOverrideSurface(null);
    };
    reader.onerror = () => {
      logger.warn('[MaterialStyleTransfer] reference file could not be read', reader.error);
      setUploadError(`"${file.name}" could not be read — the file may be corrupt or still downloading.`);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // No file means the picker was dismissed — that is not a failure to report.
    const file = e.target.files?.[0];
    // Clear the input so re-picking the *same* file after a rejection still fires `change`.
    e.target.value = '';
    if (file) acceptFile(file);
  }, [acceptFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) {
      setUploadError('That drop carried no file — drag a PNG or JPG screenshot onto this panel.');
      return;
    }
    acceptFile(file);
  }, [acceptFile]);

  const handleClearImage = useCallback(() => {
    setImageDataUrl(null);
    setAnalysis(null);
    setAnalyzeError(null);
    setUploadError(null);
    setOverrideRoughness(null);
    setOverrideMetallic(null);
    setOverrideEmissive(null);
    setOverrideSurface(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageDataUrl && !referenceDescription.trim()) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch('/api/style-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          imageDataUrl,
          description: referenceDescription,
        }),
      });
      // Typed, and every field guarded: an envelope that says `success` but
      // carries no analysis used to throw on `json.data.analysis` INSIDE the try,
      // so the catch below reported it as a connection problem — blaming the
      // user's network for a malformed server response.
      const json = (await res.json()) as ApiResponse<{ analysis?: AnalyzedProperties }>;
      if (json.success && json.data?.analysis) {
        setAnalysis(json.data.analysis);
        setAdjustmentsOpen(true);
      } else if (json.success) {
        logger.warn('[MaterialStyleTransfer] analyze succeeded with no analysis payload', json);
        setAnalyzeError(
          'The analyzer returned no material properties — try a different image or a more specific description.',
        );
      } else {
        setAnalyzeError(
          typeof json.error === 'string' && json.error
            ? json.error
            : 'The reference could not be analyzed — try a different image or description.',
        );
      }
    } catch (error) {
      logger.error('[MaterialStyleTransfer] analysis request failed', error);
      setAnalyzeError(
        error instanceof Error && error.message
          ? error.message
          : 'The analysis request failed — check your connection and retry.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [imageDataUrl, referenceDescription]);

  const handleGenerate = useCallback(() => {
    onGenerate({
      imageDataUrl,
      referenceDescription,
      analysis: effectiveAnalysis,
      adjustments: {
        roughness: overrideRoughness ?? undefined,
        metallic: overrideMetallic ?? undefined,
        emissiveIntensity: overrideEmissive ?? undefined,
        surfaceType: overrideSurface ?? undefined,
      },
    });
  }, [onGenerate, imageDataUrl, referenceDescription, effectiveAnalysis, overrideRoughness, overrideMetallic, overrideEmissive, overrideSurface]);

  const handleExampleClick = useCallback((desc: string) => {
    setReferenceDescription(desc);
  }, []);

  return {
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
  };
}
