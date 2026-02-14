'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle, XCircle, AlertTriangle, Clock, AlertCircle,
} from 'lucide-react';
import type { BuildSummary } from './UE5BuildParser';

interface BuildSummaryCardProps {
  summary: BuildSummary;
}

export function BuildSummaryCard({ summary }: BuildSummaryCardProps) {
  const isSuccess = summary.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mx-2 my-1 rounded border overflow-hidden ${
        isSuccess
          ? 'border-green-500/30 bg-green-500/[0.05]'
          : 'border-red-500/30 bg-red-500/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {/* Status icon */}
        {isSuccess ? (
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        )}

        {/* Build result */}
        <span className={`text-xs font-semibold ${isSuccess ? 'text-green-300' : 'text-red-300'}`}>
          Build {isSuccess ? 'Succeeded' : 'Failed'}
        </span>

        {/* Counts */}
        <div className="flex items-center gap-2 ml-auto">
          {summary.errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-400">
              <AlertCircle className="w-2.5 h-2.5" />
              {summary.errorCount} error{summary.errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.warningCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-yellow-400">
              <AlertTriangle className="w-2.5 h-2.5" />
              {summary.warningCount} warning{summary.warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {summary.duration && (
            <span className="flex items-center gap-0.5 text-xs text-text-muted">
              <Clock className="w-2.5 h-2.5" />
              {summary.duration}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
