'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api-utils';
import type {
  BlueprintAsset,
  TranspileResult,
  SemanticDiffResult,
} from '@/types/blueprint';

export interface UseBlueprintTranspilerResult {
  blueprintJson: string;
  setBlueprintJson: (value: string) => void;
  existingCpp: string;
  setExistingCpp: (value: string) => void;
  asset: BlueprintAsset | null;
  summary: string | null;
  transpileResult: TranspileResult | null;
  diffResult: SemanticDiffResult | null;
  isLoading: boolean;
  error: string | null;
  parse: (json: string) => Promise<ParseResponse>;
  transpile: (json: string, projectName?: string, moduleName?: string) => Promise<TranspileResult>;
  diff: (json: string, cpp: string, projectName?: string) => Promise<SemanticDiffResult>;
  reset: () => void;
}

interface ParseResponse {
  asset: BlueprintAsset;
  summary: string;
}

export function useBlueprintTranspiler(): UseBlueprintTranspilerResult {
  const [blueprintJson, setBlueprintJson] = useState('');
  const [existingCpp, setExistingCpp] = useState('');
  const [asset, setAsset] = useState<BlueprintAsset | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [transpileResult, setTranspileResult] = useState<TranspileResult | null>(null);
  const [diffResult, setDiffResult] = useState<SemanticDiffResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(async (json: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ParseResponse>('/api/blueprint-transpiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', blueprintJson: json }),
      });
      setAsset(result.asset);
      setSummary(result.summary);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Parse failed';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const transpile = useCallback(async (json: string, projectName?: string, moduleName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<TranspileResult>('/api/blueprint-transpiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transpile', blueprintJson: json, projectName, moduleName }),
      });
      setTranspileResult(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transpile failed';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const diff = useCallback(async (json: string, cpp: string, projectName?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<SemanticDiffResult>('/api/blueprint-transpiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'diff', blueprintJson: json, existingCpp: cpp, projectName }),
      });
      setDiffResult(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Diff failed';
      setError(msg);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setBlueprintJson('');
    setExistingCpp('');
    setAsset(null);
    setSummary(null);
    setTranspileResult(null);
    setDiffResult(null);
    setError(null);
  }, []);

  return {
    blueprintJson, setBlueprintJson,
    existingCpp, setExistingCpp,
    asset, summary,
    transpileResult, diffResult,
    isLoading, error,
    parse, transpile, diff, reset,
  };
}
