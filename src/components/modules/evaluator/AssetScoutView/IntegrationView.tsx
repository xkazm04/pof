import { useState } from 'react';
import { Code, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { CodeViewer } from '@/components/ui/CodeViewer';
import { Badge } from '@/components/ui/Badge';
import type { AcquiredAsset, IntegrationSpec } from '@/types/marketplace';
import { MOTION } from '@/lib/constants';
import { adapterFileName } from './helpers';

// ── Integration View ────────────────────────────────────────────────────────

export function IntegrationView({ acquiredAssets }: { acquiredAssets: Record<string, AcquiredAsset> }) {
  const entries = Object.values(acquiredAssets).filter((a) => a.integrationGenerated && a.integration);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Code className="w-10 h-10 text-text-muted/30 mb-3" />
        <p className="text-sm text-text-muted">No integrations generated yet</p>
        <p className="text-xs text-text-muted/70 mt-1">
          Acquire an asset and click &quot;Generate Adapter&quot; to create integration code
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <IntegrationCard key={entry.assetId} asset={entry} integration={entry.integration!} />
      ))}
    </div>
  );
}

// ── Integration Card ────────────────────────────────────────────────────────

function IntegrationCard({ asset, integration }: {
  asset: AcquiredAsset;
  integration: IntegrationSpec;
}) {
  const [showCode, setShowCode] = useState<'header' | 'source' | null>(null);

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-text">{asset.assetName}</span>
          {integration.warnings.length > 0 ? (
            <Badge variant="warning">
              Scaffold · {integration.warnings.length} TODO{integration.warnings.length === 1 ? '' : 's'}
            </Badge>
          ) : (
            <Badge variant="success">Adapter Ready</Badge>
          )}
        </div>

        {/* Scaffold warnings — generated code left these stubs to complete by hand */}
        {integration.warnings.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-2xs font-medium text-amber-400">
                Generated adapter is a scaffold — complete these before shipping:
              </span>
            </div>
            <ul className="space-y-0.5">
              {integration.warnings.map((w, i) => (
                <li key={i} className="text-2xs text-text-muted">
                  <span className="font-mono text-text-muted/70">
                    {w.location === 'adapterSource' ? '.cpp' : '.h'}:{w.line}
                  </span>{' '}
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependencies */}
        {(integration.buildDependencies.length > 0 || integration.pluginDependencies.length > 0) && (
          <div className="flex gap-4 mb-3">
            {integration.buildDependencies.length > 0 && (
              <div>
                <span className="text-2xs text-text-muted font-medium">Build Deps</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {integration.buildDependencies.map((dep) => (
                    <span key={dep} className="px-1.5 py-0.5 bg-surface-hover border border-border rounded text-2xs text-text-muted">{dep}</span>
                  ))}
                </div>
              </div>
            )}
            {integration.pluginDependencies.length > 0 && (
              <div>
                <span className="text-2xs text-text-muted font-medium">Plugins</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {integration.pluginDependencies.map((dep) => (
                    <span key={dep} className="px-1.5 py-0.5 bg-blue-400/10 border border-blue-400/15 rounded text-2xs text-blue-400">{dep}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-1.5 mb-3">
          {integration.steps.map((step) => (
            <div key={step.order} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-2xs text-cyan-400 font-medium flex-shrink-0 mt-0.5">
                {step.order}
              </span>
              <div>
                <span className="text-xs font-medium text-text">{step.title}</span>
                <p className="text-2xs text-text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowCode(showCode === 'header' ? null : 'header')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
              showCode === 'header'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-surface-hover text-text-muted border border-border hover:text-text'
            }`}
          >
            <Code className="w-3 h-3" />
            Adapter.h
          </button>
          <button
            onClick={() => setShowCode(showCode === 'source' ? null : 'source')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-2xs font-medium transition-colors ${
              showCode === 'source'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-surface-hover text-text-muted border border-border hover:text-text'
            }`}
          >
            <Code className="w-3 h-3" />
            Adapter.cpp
          </button>
        </div>
      </div>

      {/* Code display */}
      <AnimatePresence>
        {showCode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              <CodeViewer
                key={showCode}
                code={showCode === 'header' ? integration.adapterHeader : integration.adapterSource}
                fileName={adapterFileName(integration, showCode)}
                lang="cpp"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}
