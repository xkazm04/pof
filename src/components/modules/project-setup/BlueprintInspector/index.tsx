'use client';

import { useState, useCallback } from 'react';
import {
  Search, Loader2, ChevronDown, ChevronRight, FileCode,
} from 'lucide-react';
import { ErrorBanner } from '@/components/modules/project-setup/ErrorBanner';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { tryApiFetch } from '@/lib/api-utils';
import type { BlueprintEntry } from '@/types/pof-bridge';
import {
  ACCENT_VIOLET,
  STATUS_SUCCESS, STATUS_NEUTRAL,
  OPACITY_10,
} from '@/lib/chart-colors';
import { SECTIONS } from './constants';
import { sectionCount, isSectionEmpty } from './helpers';
import { SectionContent } from './sections';

// ── Main component ─────────────────────────────────────────────────────────

export function BlueprintInspector() {
  const pofPort = usePofBridgeStore((s) => s.pofPort);
  const connectionStatus = usePofBridgeStore((s) => s.connectionStatus);

  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprint, setBlueprint] = useState<BlueprintEntry | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['contentHash']));

  const isDisconnected = connectionStatus === 'disconnected' || connectionStatus === 'error';

  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const fetchBlueprint = useCallback(async () => {
    const trimmed = path.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const res = await tryApiFetch<BlueprintEntry>(
      `/api/pof-bridge/manifest/blueprint?port=${pofPort}&path=${encodeURIComponent(trimmed)}`,
    );

    if (res.ok) {
      setBlueprint(res.data);
    } else {
      setError(res.error);
      setBlueprint(null);
    }

    setLoading(false);
  }, [path, pofPort]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fetchBlueprint();
  }, [fetchBlueprint]);

  return (
    <SurfaceCard className="p-0 overflow-hidden" data-testid="blueprint-inspector-panel">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_10}` }}
        >
          <FileCode className="w-4 h-4" style={{ color: ACCENT_VIOLET }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text">Blueprint Inspector</h3>
          <p className="text-2xs text-text-muted">
            Introspect blueprint anatomy via /pof/manifest/blueprint
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/Game/Blueprints/BP_MyCharacter"
          className="flex-1 bg-transparent text-xs font-mono text-text placeholder:text-text-muted/50
                     outline-none border-none"
          data-testid="blueprint-inspector-path-input"
        />
        <button
          onClick={fetchBlueprint}
          disabled={loading || isDisconnected || !path.trim()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                     border border-border/40 transition-colors
                     enabled:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ color: ACCENT_VIOLET }}
          data-testid="blueprint-inspector-fetch-btn"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          {loading ? 'Loading…' : 'Inspect'}
        </button>
      </div>

      {/* Disconnected banner */}
      {isDisconnected && (
        <ErrorBanner message="Bridge not connected — connect to inspect blueprints" className="mx-4 my-2" />
      )}

      {/* Error */}
      {error && (
        <ErrorBanner message={error} className="mx-4 my-2" data-testid="blueprint-inspector-error" />
      )}

      {/* Results tree */}
      {blueprint && (
        <div className="divide-y divide-border/20" data-testid="blueprint-inspector-results">
          {SECTIONS.map((section) => {
            const SIcon = section.icon;
            const isOpen = !collapsed.has(section.id);
            const count = sectionCount(blueprint, section.id);
            const empty = isSectionEmpty(blueprint, section.id);

            return (
              <div key={section.id}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white/3 transition-colors"
                  data-testid={`blueprint-section-${section.id}-toggle`}
                >
                  {isOpen
                    ? <ChevronDown className="w-3 h-3 text-text-muted" />
                    : <ChevronRight className="w-3 h-3 text-text-muted" />
                  }
                  <span style={{ color: section.color }}><SIcon className="w-3.5 h-3.5" /></span>
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: empty ? STATUS_NEUTRAL : section.color }}
                  >
                    {section.label}
                  </span>
                  {count !== null && (
                    <span
                      className="text-2xs font-mono"
                      style={{ color: count > 0 ? STATUS_SUCCESS : STATUS_NEUTRAL }}
                    >
                      {count}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pl-10 pb-2">
                    <SectionContent bp={blueprint} sectionId={section.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!blueprint && !error && !loading && (
        <div className="px-4 py-8 text-center">
          <FileCode className="w-6 h-6 text-text-muted/20 mx-auto mb-2" />
          <p className="text-xs text-text-muted">
            Enter a blueprint asset path to inspect its anatomy
          </p>
          <p className="text-xs text-text-muted/50 mt-1">
            e.g. /Game/Blueprints/BP_MyCharacter
          </p>
        </div>
      )}
    </SurfaceCard>
  );
}
