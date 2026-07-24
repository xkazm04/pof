import type { BlueprintEntry, FunctionOverride, ComponentEntry, VariableEntry } from '@/types/pof-bridge';
import {
  ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE, ACCENT_PINK,
} from '@/lib/chart-colors';
import { Row, Badge, EmptyHint } from './primitives';

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

// ── Section renderer ───────────────────────────────────────────────────────

export function SectionContent({ bp, sectionId }: { bp: BlueprintEntry; sectionId: string }) {
  switch (sectionId) {
    case 'inheritance': return <InheritanceSection bp={bp} />;
    case 'overriddenFunctions': return <FunctionsSection fns={bp.overriddenFunctions} />;
    case 'addedComponents': return <ComponentsSection comps={bp.addedComponents} />;
    case 'variables': return <VariablesSection vars={bp.variables} />;
    case 'eventGraphEntryPoints':
      return <StringListSection items={bp.eventGraphEntryPoints} emptyText="No event graph entries" emptyHint="BeginPlay, Tick, and custom events show up here" />;
    case 'interfaces':
      return <StringListSection items={bp.interfaces} emptyText="No interfaces implemented" emptyHint="Implement UE interfaces (Class Settings > Interfaces) to see them" />;
    case 'crossReferences':
      return <StringListSection items={bp.crossReferences ?? []} emptyText="No cross references" emptyHint="Assets this blueprint references (meshes, materials, other blueprints) appear here" />;
    case 'contentHash':
      return <Row label="SHA-256" value={bp.contentHash} mono />;
    default: return null;
  }
}
