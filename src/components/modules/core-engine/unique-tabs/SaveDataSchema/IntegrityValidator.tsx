'use client';

import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR } from '@/lib/chart-colors';
import { BlueprintPanel, SectionHeader } from './design';
import { ACCENT } from './data';
import { VALIDATION_CHECKS } from './data-panels';

export function IntegrityValidator() {
  const overallValidation = VALIDATION_CHECKS.every(c => c.status === 'pass') ? 'PASS' :
    VALIDATION_CHECKS.some(c => c.status === 'fail') ? 'FAIL' : 'WARN';

  return (
    <BlueprintPanel color={ACCENT} className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/10 flex items-center justify-between">
        <SectionHeader label="INTEGRITY_VALIDATOR" icon={ShieldCheck} color={ACCENT} />
        <span
          className="px-2 py-0.5 rounded text-xs font-mono font-bold tracking-[0.15em] uppercase"
          style={{
            backgroundColor: overallValidation === 'PASS' ? `${STATUS_SUCCESS}20` : overallValidation === 'WARN' ? `${STATUS_WARNING}20` : `${STATUS_ERROR}20`,
            color: overallValidation === 'PASS' ? STATUS_SUCCESS : overallValidation === 'WARN' ? STATUS_WARNING : STATUS_ERROR,
            border: `1px solid ${overallValidation === 'PASS' ? STATUS_SUCCESS : overallValidation === 'WARN' ? STATUS_WARNING : STATUS_ERROR}40`,
          }}
        >
          {overallValidation}
        </span>
      </div>

      <div className="p-4 space-y-3 relative z-10">
        {VALIDATION_CHECKS.map((check, i) => {
          const statusColor = check.status === 'pass' ? STATUS_SUCCESS : check.status === 'warn' ? STATUS_WARNING : STATUS_ERROR;
          const StatusIcon = check.status === 'pass' ? CheckCircle2 : check.status === 'warn' ? AlertTriangle : XCircle;
          return (
            <motion.div
              key={check.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 px-3 py-2 border border-border/10 rounded-lg font-mono text-xs hover:border-border/30 transition-colors group"
              style={{ backgroundColor: `${ACCENT}06` }}
            >
              <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor, filter: `drop-shadow(0 0 4px ${statusColor}60)` }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-100 font-bold">{check.label}</span>
                  <span className="text-text-muted text-xs hidden sm:block">{check.description}</span>
                </div>
              </div>
              <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: statusColor }}>
                {check.detail}
              </span>
            </motion.div>
          );
        })}
      </div>
    </BlueprintPanel>
  );
}
