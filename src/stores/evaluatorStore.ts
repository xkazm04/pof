'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EvaluatorReport } from '@/types/evaluator';

interface EvaluatorState {
  lastScan: EvaluatorReport | null;
  isScanning: boolean;
  scanHistory: EvaluatorReport[];

  setLastScan: (report: EvaluatorReport) => void;
  setScanning: (scanning: boolean) => void;
  addScanToHistory: (report: EvaluatorReport) => void;
}

export const useEvaluatorStore = create<EvaluatorState>()(
  persist(
    (set) => ({
      lastScan: null,
      isScanning: false,
      scanHistory: [],

      setLastScan: (report) => set({ lastScan: report }),
      setScanning: (scanning) => set({ isScanning: scanning }),
      addScanToHistory: (report) => set((state) => ({
        scanHistory: [...state.scanHistory, report].slice(-10),
      })),
    }),
    {
      name: 'pof-evaluator',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lastScan: state.lastScan,
        scanHistory: state.scanHistory,
      }),
    }
  )
);
