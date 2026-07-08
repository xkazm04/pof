import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  STATUS_SUCCESS, STATUS_ERROR, STATUS_WARNING, STATUS_NEUTRAL,
  OPACITY_15,
} from '@/lib/chart-colors';
import { LatencySparkline } from './LatencySparkline';
import { METHOD_COLORS } from './constants';
import { healthDotColor } from './helpers';
import type { EndpointHealth, SubsystemDef } from './types';

interface SubsystemGroupProps {
  subsystem: SubsystemDef;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  health: Record<string, EndpointHealth>;
  latencyHistory: Record<string, number[]>;
}

export function SubsystemGroup({
  subsystem, collapsed, toggleCollapse, health, latencyHistory,
}: SubsystemGroupProps) {
  const SubIcon = subsystem.icon;
  const isOpen = !collapsed.has(subsystem.id);
  const groupHealthy = subsystem.endpoints.filter((ep) => health[ep.path]?.status === 'healthy').length;
  const groupChecked = subsystem.endpoints.filter((ep) => health[ep.path]).length;

  return (
    <div>
      {/* Group header */}
      <button
        onClick={() => toggleCollapse(subsystem.id)}
        aria-expanded={isOpen}
        aria-controls={`beh-group-${subsystem.id}`}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/3 transition-colors"
        data-testid={`bridge-group-${subsystem.id}-toggle`}
      >
        {isOpen
          ? <ChevronDown className="w-3 h-3 text-text-muted" />
          : <ChevronRight className="w-3 h-3 text-text-muted" />
        }
        <span style={{ color: subsystem.notIntegrated ? STATUS_NEUTRAL : subsystem.color }}><SubIcon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: subsystem.notIntegrated ? STATUS_NEUTRAL : subsystem.color }}>
          {subsystem.label}
        </span>
        {subsystem.notIntegrated && (
          <span
            className="text-2xs font-medium px-1.5 py-0.5 rounded"
            style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}${OPACITY_15}` }}
            data-testid={`bridge-group-${subsystem.id}-not-integrated`}
          >
            Not Integrated
          </span>
        )}
        <span className="text-2xs text-text-muted">{subsystem.endpoints.length}</span>

        {groupChecked > 0 && (
          <span className="ml-auto text-2xs font-mono" style={{ color: groupHealthy === groupChecked ? STATUS_SUCCESS : STATUS_WARNING }}>
            {groupHealthy}/{groupChecked}
          </span>
        )}
      </button>

      {/* Endpoints */}
      {isOpen && (
        <div id={`beh-group-${subsystem.id}`} role="region" aria-label={subsystem.label} className={`pb-1${subsystem.notIntegrated ? ' opacity-50' : ''}`}>
          {subsystem.endpoints.map((ep) => {
            const h = health[ep.path];
            const dotColor = h ? healthDotColor(h.status) : STATUS_NEUTRAL;
            const samples = latencyHistory[ep.path] ?? [];
            return (
              <div
                key={ep.path}
                className="flex items-center gap-2.5 px-4 pl-10 py-1.5 group hover:bg-white/3 transition-colors"
                data-testid={`bridge-endpoint-${ep.path.replaceAll('/', '-').slice(1)}`}
              >
                {/* Health dot */}
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  role="img"
                  aria-label={`Status: ${h?.status ?? 'unknown'}`}
                  style={{
                    backgroundColor: dotColor,
                    boxShadow: h?.status === 'healthy' ? `0 0 6px ${dotColor}` : 'none',
                  }}
                />

                {/* Method badge */}
                <span
                  className="text-2xs font-bold font-mono w-8 shrink-0"
                  style={{ color: METHOD_COLORS[ep.method] }}
                >
                  {ep.method}
                </span>

                {/* Path */}
                <span className="text-xs font-mono text-text truncate">{ep.path}</span>

                {/* Description (hover) */}
                <span className="text-2xs text-text-muted truncate opacity-0 group-hover:opacity-100 transition-opacity ml-auto hidden lg:block max-w-[200px]">
                  {ep.description}
                </span>

                {/* Response metrics */}
                {h && (
                  <span className="flex items-center gap-2 shrink-0 ml-auto">
                    {h.statusCode && (
                      <span
                        className="text-2xs font-mono px-1 rounded"
                        style={{
                          color: h.statusCode < 400 ? STATUS_SUCCESS : STATUS_ERROR,
                          backgroundColor: h.statusCode < 400 ? `${STATUS_SUCCESS}${OPACITY_15}` : `${STATUS_ERROR}${OPACITY_15}`,
                        }}
                      >
                        {h.statusCode}
                      </span>
                    )}
                    {h.responseMs !== undefined && (
                      <span className="flex items-center gap-1.5">
                        {samples.length > 0 && (
                          <LatencySparkline
                            samples={samples}
                            gradientId={`beh-spark-${ep.path.replaceAll('/', '-').slice(1)}`}
                          />
                        )}
                        <span className="text-2xs font-mono text-text-muted w-12 text-right tabular-nums">
                          {h.responseMs}ms
                        </span>
                      </span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
