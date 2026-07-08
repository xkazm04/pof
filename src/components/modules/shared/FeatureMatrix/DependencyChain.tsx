import { Link2, AlertTriangle } from 'lucide-react';
import type { DependencyInfo } from '@/lib/feature-definitions';
import { MODULE_LABELS } from '@/lib/module-registry';
import { STATUS_ERROR, STATUS_BLOCKER, STATUS_SUCCESS, statusBg } from '@/lib/chart-colors';

export function DependencyChain({
  depInfo,
  currentModuleId,
}: {
  depInfo: DependencyInfo;
  currentModuleId: string;
}) {
  const blockerKeys = new Set(depInfo.blockers.map((b) => b.key));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Link2 className="w-3 h-3 text-text-muted" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Dependencies
        </span>
        {depInfo.isBlocked && (
          <span className="text-2xs" style={{ color: STATUS_BLOCKER }}>
            ({depInfo.blockers.length} not implemented)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 pl-[18px]">
        {depInfo.deps.map((dep) => {
          const isBlocker = blockerKeys.has(dep.key);
          const isCrossModule = dep.moduleId !== currentModuleId;
          const modLabel = MODULE_LABELS[dep.moduleId] ?? dep.moduleId;

          return (
            <span
              key={dep.key}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border"
              style={isBlocker
                ? { backgroundColor: statusBg(STATUS_ERROR, 0.05), borderColor: `${STATUS_ERROR}4d`, color: STATUS_BLOCKER }
                : { backgroundColor: statusBg(STATUS_SUCCESS, 0.05), borderColor: `${STATUS_SUCCESS}33`, color: STATUS_SUCCESS }
              }
            >
              {isBlocker && <AlertTriangle className="w-2.5 h-2.5" />}
              {isCrossModule && (
                <span className="text-text-muted-hover text-2xs">{modLabel}/</span>
              )}
              {dep.featureName}
            </span>
          );
        })}
      </div>
    </div>
  );
}
