import { useState, useCallback, useRef, useMemo } from 'react';
import type { SurfaceType } from '../MaterialParameterConfigurator';
import type { AnalyzedProperties, StyleTransferConfig } from './types';

export function useMaterialStyleTransfer(onGenerate: (config: StyleTransferConfig) => void) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [referenceDescription, setReferenceDescription] = useState('');
  const [analysis, setAnalysis] = useState<AnalyzedProperties | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
      setAnalyzeError(null);
      setOverrideRoughness(null);
      setOverrideMetallic(null);
      setOverrideEmissive(null);
      setOverrideSurface(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAnalysis(null);
      setAnalyzeError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleClearImage = useCallback(() => {
    setImageDataUrl(null);
    setAnalysis(null);
    setAnalyzeError(null);
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
      const json = await res.json();
      if (json.success) {
        setAnalysis(json.data.analysis);
        setAdjustmentsOpen(true);
      } else {
        setAnalyzeError(
          typeof json.error === 'string' && json.error
            ? json.error
            : 'The reference could not be analyzed — try a different image or description.',
        );
      }
    } catch (error) {
      console.error('[MaterialStyleTransfer] analysis request failed:', error);
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
