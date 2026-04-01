'use client';

import { useState, useCallback } from 'react';
import {
  Search, Loader2, ChevronDown, ChevronRight,
  Box, Variable, Zap, Puzzle, GitBranch, Hash, FileCode,
} from 'lucide-react';
import { ErrorBanner } from './ErrorBanner';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { usePofBridgeStore } from '@/stores/pofBridgeStore';
import { tryApiFetch } from '@/lib/api-utils';
import type { BlueprintEntry, FunctionOverride, ComponentEntry, VariableEntry } from '@/types/pof-bridge';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK,
  STATUS_SUCCESS, STATUS_NEUTRAL,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Section config ─────────────────────────────────────────────────────────

interface SectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'inheritance', label: 'Inheritance', icon: GitBranch, color: ACCENT_CYAN },
  { id: 'overriddenFunctions', label: 'Overridden Functions', icon: FileCode, color: ACCENT_VIOLET },
  { id: 'addedComponents', label: 'Components', icon: Box, color: ACCENT_EMERALD },
  { id: 'variables', label: 'Variables', icon: Variable, color: ACCENT_ORANGE },
  { id: 'eventGraphEntryPoints', label: 'Event Graph Entry Points', icon: Zap, color: ACCENT_PINK },
  { id: 'interfaces', label: 'Interfaces', icon: Puzzle, color: ACCENT_CYAN },
  { id: 'contentHash', label: 'Content Hash', icon: Hash, color: STATUS_NEUTRAL },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function sectionCount(bp: BlueprintEntry, id: string): number | null {
  switch (id) {
    case 'overriddenFunctions': return bp.overriddenFunctions.length;
    case 'addedComponents': return bp.addedComponents.length;
    case 'variables': return bp.variables.length;
    case 'eventGraphEntryPoints': return bp.eventGraphEntryPoints.length;
    case 'interfaces': return bp.interfaces.length;
    default: return null;
  }
}

function isSectionEmpty(bp: BlueprintEntry, id: string): boolean {
  const count = sectionCount(bp, id);
  return count !== null && count === 0;
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

function InheritanceSection({ bp }: { bp: BlueprintEntry }) {
  return (
    <div className="space-y-1.5 pl-1">
      <Row label="Asset Path" value={bp.path} mono />
      <Row label="Parent C++ Class" value={bp.parentCppClass} />
      <Row label="Parent C++ Module" value={bp.parentCppModule} />
      {bp.parentBlueprintClass && (
        <Row label="Parent Blueprint" value={bp.parentBlueprintClass} />
      )}
    </div>
  );
}

function FunctionsSection({ fns }: { fns: FunctionOverride[] }) {
  if (fns.length === 0) return <EmptyHint text="No overridden functions" hint="Override C++ functions in the blueprint to see them here" />;
  return (
    <div className="space-y-1">
      {fns.map((fn) => (
        <div key={fn.functionName} className="flex items-center gap-2 pl-1 py-0.5">
          <span className="text-xs font-mono text-text truncate">{fn.functionName}</span>
          <span className="text-2xs text-text-muted truncate">from {fn.declaringClass}</span>
          {fn.isEvent && <Badge text="Event" color={ACCENT_PINK} />}
          {fn.isBlueprintCallable && <Badge text="Callable" color={ACCENT_EMERALD} />}
        </div>
      ))}
    </div>
  );
}

function ComponentsSection({ comps }: { comps: ComponentEntry[] }) {
  if (comps.length === 0) return <EmptyHint text="No added components" hint="Add components in the blueprint editor to populate this section" />;
  return (
    <div className="space-y-1">
      {comps.map((c) => (
        <div key={c.componentName} className="flex items-center gap-2 pl-1 py-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: c.isSceneComponent ? ACCENT_EMERALD : ACCENT_ORANGE }}
          />
          <span className="text-xs font-mono text-text">{c.componentName}</span>
          <span className="text-2xs text-text-muted truncate">{c.componentClass}</span>
          {c.attachParent && (
            <span className="text-2xs text-text-muted truncate ml-auto">
              &rarr; {c.attachParent}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function VariablesSection({ vars }: { vars: VariableEntry[] }) {
  if (vars.length === 0) return <EmptyHint text="No blueprint variables" hint="Variables defined in the blueprint's My Blueprint panel appear here" />;
  return (
    <div className="space-y-1">
      {vars.map((v) => (
        <div key={v.name} className="flex items-center gap-2 pl-1 py-0.5">
          <span className="text-xs font-mono text-text">{v.name}</span>
          <span className="text-2xs text-text-muted">{v.type}{v.subType ? `<${v.subType}>` : ''}</span>
          {v.category && <span className="text-2xs text-text-muted ml-auto">{v.category}</span>}
          {v.isReplicated && <Badge text="Replicated" color={ACCENT_VIOLET} />}
          {v.defaultValue && (
            <span className="text-2xs font-mono text-text-muted truncate max-w-[120px]">= {v.defaultValue}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StringListSection({ items, emptyText, emptyHint }: { items: string[]; emptyText: string; emptyHint?: string }) {
  if (items.length === 0) return <EmptyHint text={emptyText} hint={emptyHint} />;
  return (
    <div className="space-y-0.5 pl-1">
      {items.map((item, i) => (
        <div key={i} className="text-xs font-mono text-text py-0.5">{item}</div>
      ))}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs text-text-muted w-32 shrink-0">{label}</span>
      <span className={`text-xs text-text truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-2xs font-medium px-1.5 py-0.5 rounded shrink-0"
      style={{ color, backgroundColor: `${color}${OPACITY_15}` }}
    >
      {text}
    </span>
  );
}

function EmptyHint({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="pl-1">
      <p className="text-xs text-text-muted italic">{text}</p>
      {hint && <p className="text-xs text-text-muted/50 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Section renderer ───────────────────────────────────────────────────────

function SectionContent({ bp, sectionId }: { bp: BlueprintEntry; sectionId: string }) {
  switch (sectionId) {
    case 'inheritance': return <InheritanceSection bp={bp} />;
    case 'overriddenFunctions': return <FunctionsSection fns={bp.overriddenFunctions} />;
    case 'addedComponents': return <ComponentsSection comps={bp.addedComponents} />;
    case 'variables': return <VariablesSection vars={bp.variables} />;
    case 'eventGraphEntryPoints':
      return <StringListSection items={bp.eventGraphEntryPoints} emptyText="No event graph entries" emptyHint="BeginPlay, Tick, and custom events show up here" />;
    case 'interfaces':
      return <StringListSection items={bp.interfaces} emptyText="No interfaces implemented" emptyHint="Implement UE interfaces (Class Settings > Interfaces) to see them" />;
    case 'contentHash':
      return <Row label="SHA-256" value={bp.contentHash} mono />;
    default: return null;
  }
}

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
          {loading ? 'Loading...' : 'Inspect'}
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
