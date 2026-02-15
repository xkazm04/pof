'use client';

import { create } from 'zustand';

export interface CapturedError {
  id: string;
  componentName: string;
  error: string;
  stack: string | null;
  timestamp: number;
}

interface ErrorDiagnosticsState {
  errors: CapturedError[];
  logError: (componentName: string, error: Error) => void;
  clearErrors: () => void;
}

export const useErrorDiagnosticsStore = create<ErrorDiagnosticsState>((set) => ({
  errors: [],

  logError: (componentName, error) => {
    const entry: CapturedError = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      componentName,
      error: error.message,
      stack: error.stack ?? null,
      timestamp: Date.now(),
    };
    set((state) => ({
      errors: [entry, ...state.errors].slice(0, 50),
    }));
  },

  clearErrors: () => set({ errors: [] }),
}));
