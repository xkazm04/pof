'use client';
import { Radar } from 'lucide-react';
export function EvaluatorModule() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Radar className="w-6 h-6 text-[#ef4444]" />
        <h1 className="text-xl font-semibold text-[#e0e4f0]">Project Evaluator</h1>
      </div>
      <div className="bg-[#111128] border border-[#1e1e3a] rounded-lg p-6">
        <p className="text-[#6b7294] text-sm mb-4">Scan your project to get a health report and actionable recommendations.</p>
        <button className="px-4 py-2 bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 rounded-lg text-sm hover:bg-[#ef4444]/20 transition-colors">
          Scan Project
        </button>
      </div>
    </div>
  );
}
