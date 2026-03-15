'use client';

import { useState, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, Target, MapPin,
  Gauge, Shield, Compass,
} from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import {
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD, ACCENT_ORANGE,
  STATUS_SUCCESS, STATUS_WARNING,
  OPACITY_10, OPACITY_15,
} from '@/lib/chart-colors';

// ── Real UPROPERTY data from C++ EQS sources ────────────────────────────────

type ComponentKind = 'context' | 'generator' | 'test';

interface PropertyDef {
  name: string;
  type: string;
  defaultValue: string;
  meta?: string;
  description: string;
}

interface EQSComponentDef {
  id: string;
  displayName: string;
  cppClass: string;
  kind: ComponentKind;
  parentClass: string;
  description: string;
  cost?: 'Low' | 'High';
  outputType?: string;
  properties: PropertyDef[];
}

const EQS_COMPONENTS: EQSComponentDef[] = [
  // ── Context ──
  {
    id: 'ctx-target-actor',
    displayName: 'TargetActor',
    cppClass: 'UEnvQueryContext_TargetActor',
    kind: 'context',
    parentClass: 'UEnvQueryContext',
    description: 'Resolves the TargetActor blackboard key to an AActor* for use as query center.',
    properties: [
      {
        name: 'Blackboard Key',
        type: 'FName',
        defaultValue: '"TargetActor"',
        description: 'Blackboard key read via GetValueAsObject(). Must be set by BT before query runs.',
      },
    ],
  },
  // ── Generators ──
  {
    id: 'gen-attack-positions',
    displayName: 'Attack Ring Positions',
    cppClass: 'UEnvQueryGenerator_AttackPositions',
    kind: 'generator',
    parentClass: 'UEnvQueryGenerator_ProjectedPoints',
    description: 'Generates points in a ring around a context actor at a configurable melee attack distance. Nav-projected via TraceMode=Navigation.',
    outputType: 'TArray<FNavLocation>',
    properties: [
      {
        name: 'CenterContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_TargetActor',
        meta: 'EditDefaultsOnly',
        description: 'The context around which to generate the ring.',
      },
      {
        name: 'AttackDistance',
        type: 'float',
        defaultValue: '200.0',
        meta: 'ClampMin = 50',
        description: 'Distance from the center actor at which to generate points.',
      },
      {
        name: 'NumberOfPoints',
        type: 'int32',
        defaultValue: '12',
        meta: 'ClampMin = 4, ClampMax = 36',
        description: 'Number of points evenly distributed around the ring.',
      },
      {
        name: 'bGenerateInnerRing',
        type: 'bool',
        defaultValue: 'false',
        description: 'When true, adds a second inner ring at half AttackDistance for fallback positions.',
      },
    ],
  },
  {
    id: 'gen-patrol-points',
    displayName: 'Patrol Points',
    cppClass: 'UEnvQueryGenerator_PatrolPoints',
    kind: 'generator',
    parentClass: 'UEnvQueryGenerator_ProjectedPoints',
    description: 'Generates random navigable points in an annular ring around the querier for patrol behavior. Nav-projected via TraceMode=Navigation.',
    outputType: 'TArray<FNavLocation>',
    properties: [
      {
        name: 'NumberOfPoints',
        type: 'int32',
        defaultValue: '15',
        meta: 'ClampMin = 1, ClampMax = 50',
        description: 'Number of random points to generate.',
      },
      {
        name: 'MinRadius',
        type: 'float',
        defaultValue: '500.0',
        meta: 'ClampMin = 0',
        description: 'Minimum distance from the querier.',
      },
      {
        name: 'MaxRadius',
        type: 'float',
        defaultValue: '1500.0',
        meta: 'ClampMin = 100',
        description: 'Maximum distance from the querier.',
      },
    ],
  },
  {
    id: 'gen-cover-positions',
    displayName: 'Cover Positions',
    cppClass: 'UEnvQueryGenerator_CoverPositions',
    kind: 'generator',
    parentClass: 'UEnvQueryGenerator_ProjectedPoints',
    description: 'Traces level geometry in annular rings around a threat actor to find positions behind walls, pillars, and elevation changes. Points without nearby geometry are discarded.',
    outputType: 'TArray<FNavLocation>',
    properties: [
      {
        name: 'ThreatContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_TargetActor',
        meta: 'EditDefaultsOnly',
        description: 'The threat actor context \u2014 cover is evaluated relative to this actor.',
      },
      {
        name: 'SampleCount',
        type: 'int32',
        defaultValue: '36',
        meta: 'ClampMin = 8, ClampMax = 72',
        description: 'Number of candidate sample points per ring around the threat.',
      },
      {
        name: 'MinRadius',
        type: 'float',
        defaultValue: '300.0',
        meta: 'ClampMin = 100',
        description: 'Minimum search radius from the threat.',
      },
      {
        name: 'MaxRadius',
        type: 'float',
        defaultValue: '1200.0',
        meta: 'ClampMin = 200',
        description: 'Maximum search radius from the threat.',
      },
      {
        name: 'NumberOfRings',
        type: 'int32',
        defaultValue: '3',
        meta: 'ClampMin = 1, ClampMax = 5',
        description: 'Number of radial rings between MinRadius and MaxRadius.',
      },
      {
        name: 'CoverCheckDistance',
        type: 'float',
        defaultValue: '150.0',
        meta: 'ClampMin = 50',
        description: 'Max distance from candidate to geometry to qualify as cover.',
      },
      {
        name: 'TraceChannel',
        type: 'ECollisionChannel',
        defaultValue: 'ECC_WorldStatic',
        description: 'Trace channel used for cover geometry detection.',
      },
    ],
  },
  // ── Tests ──
  {
    id: 'test-flank-angle',
    displayName: 'Flank Angle',
    cppClass: 'UEnvQueryTest_FlankAngle',
    kind: 'test',
    parentClass: 'UEnvQueryTest',
    description: 'Scores positions by the angle between the target\'s forward vector and the direction from target to test point. 0\u00B0 = front, 180\u00B0 = behind.',
    cost: 'Low',
    outputType: 'float (0\u2013180\u00B0)',
    properties: [
      {
        name: 'TargetContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_TargetActor',
        meta: 'EditDefaultsOnly',
        description: 'The context actor whose forward direction is measured against.',
      },
      {
        name: 'ValidItemType',
        type: 'UClass*',
        defaultValue: 'UEnvQueryItemType_VectorBase',
        description: 'Operates on vector-based items (positions, not actors).',
      },
      {
        name: 'Score Mode',
        type: 'EEnvTestScoreEquation',
        defaultValue: 'Float (SetWorkOnFloatValues)',
        description: 'Prefers high values by default — 180\u00B0 behind target scores best.',
      },
    ],
  },
  {
    id: 'test-path-exists',
    displayName: 'Path Exists To Querier',
    cppClass: 'UEnvQueryTest_PathExists',
    kind: 'test',
    parentClass: 'UEnvQueryTest',
    description: 'Tests whether a valid navigation path exists from the querier to each item. Returns 1.0 if reachable, 0.0 if not. Use as a filter.',
    cost: 'High',
    outputType: 'float (0.0 / 1.0 binary)',
    properties: [
      {
        name: 'PathFromContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_Querier',
        meta: 'EditDefaultsOnly',
        description: 'Context to test path from (default: Querier).',
      },
      {
        name: 'ValidItemType',
        type: 'UClass*',
        defaultValue: 'UEnvQueryItemType_VectorBase',
        description: 'Operates on vector-based items.',
      },
      {
        name: 'Method',
        type: 'UNavigationSystemV1',
        defaultValue: 'TestPathSync()',
        description: 'Synchronous nav path query \u2014 expensive, hence EEnvTestCost::High.',
      },
    ],
  },
  {
    id: 'test-line-of-sight',
    displayName: 'Line of Sight Exposure',
    cppClass: 'UEnvQueryTest_LineOfSight',
    kind: 'test',
    parentClass: 'UEnvQueryTest',
    description: 'Scores positions by LOS exposure to a threat using multi-height traces. 0.0 = fully exposed, 1.0 = fully occluded (best cover).',
    cost: 'High',
    outputType: 'float (0.0\u20131.0)',
    properties: [
      {
        name: 'ThreatContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_TargetActor',
        meta: 'EditDefaultsOnly',
        description: 'The threat actor whose line of sight we test against.',
      },
      {
        name: 'NumberOfTraceHeights',
        type: 'int32',
        defaultValue: '3',
        meta: 'ClampMin = 1, ClampMax = 5',
        description: 'Vertical trace rays spread from crouch to standing height.',
      },
      {
        name: 'MinTraceHeight',
        type: 'float',
        defaultValue: '40.0',
        meta: 'ClampMin = 0',
        description: 'Lowest trace height offset (crouch height).',
      },
      {
        name: 'MaxTraceHeight',
        type: 'float',
        defaultValue: '170.0',
        meta: 'ClampMin = 50',
        description: 'Highest trace height offset (standing height).',
      },
      {
        name: 'TraceChannel',
        type: 'ECollisionChannel',
        defaultValue: 'ECC_Visibility',
        description: 'Trace channel for visibility checks.',
      },
    ],
  },
  {
    id: 'test-elevation-advantage',
    displayName: 'Elevation Advantage',
    cppClass: 'UEnvQueryTest_ElevationAdvantage',
    kind: 'test',
    parentClass: 'UEnvQueryTest',
    description: 'Scores positions by elevation relative to a reference actor. Higher positions receive better scores \u2014 simulates high ground tactical advantage.',
    cost: 'Low',
    outputType: 'float (0.0\u20131.0)',
    properties: [
      {
        name: 'ReferenceContext',
        type: 'TSubclassOf<UEnvQueryContext>',
        defaultValue: 'UEnvQueryContext_TargetActor',
        meta: 'EditDefaultsOnly',
        description: 'Context actor to measure elevation against (typically the threat).',
      },
      {
        name: 'MaxElevationBonus',
        type: 'float',
        defaultValue: '300.0',
        meta: 'ClampMin = 50',
        description: 'Elevation difference (UU) that maps to score 1.0. Beyond this is clamped.',
      },
      {
        name: 'bPenalizeLowGround',
        type: 'bool',
        defaultValue: 'false',
        description: 'When true, lower positions receive negative scores.',
      },
    ],
  },
];

// ── Kind styling ────────────────────────────────────────────────────────────

const KIND_META: Record<ComponentKind, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  context: { label: 'Context', color: ACCENT_CYAN, icon: Target },
  generator: { label: 'Generator', color: ACCENT_VIOLET, icon: MapPin },
  test: { label: 'Test', color: ACCENT_EMERALD, icon: Gauge },
};

// ── Components ──────────────────────────────────────────────────────────────

function PropertyRow({ prop }: { prop: PropertyDef }) {
  return (
    <div className="grid grid-cols-[120px_80px_1fr] gap-2 items-start py-1 border-b border-border/10 last:border-b-0">
      <span className="text-2xs font-mono font-bold text-text truncate" title={prop.name}>
        {prop.name}
      </span>
      <span className="text-2xs font-mono text-text-muted truncate" title={prop.type}>
        {prop.type}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `${STATUS_SUCCESS}${OPACITY_10}`, color: STATUS_SUCCESS }}
        >
          {prop.defaultValue}
        </span>
        {prop.meta && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{ backgroundColor: `${STATUS_WARNING}${OPACITY_10}`, color: STATUS_WARNING }}
          >
            {prop.meta}
          </span>
        )}
      </div>
    </div>
  );
}

function ComponentCard({ comp }: { comp: EQSComponentDef }) {
  const [expanded, setExpanded] = useState(false);
  const km = KIND_META[comp.kind];
  const KindIcon = km.icon;

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className="rounded-lg border border-border/40 overflow-hidden"
      style={{ borderColor: `${km.color}25` }}
      data-testid={`eqs-component-${comp.id}`}
    >
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
        data-testid={`eqs-component-${comp.id}-toggle`}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
          : <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
        }
        <span style={{ color: km.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <span className="text-xs font-bold text-text">{comp.displayName}</span>

        {/* Kind badge */}
        <span
          className="text-2xs font-medium px-1.5 py-0.5 rounded ml-auto shrink-0"
          style={{ color: km.color, backgroundColor: `${km.color}${OPACITY_15}` }}
        >
          {km.label}
        </span>

        {/* Cost badge (tests only) */}
        {comp.cost && (
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded shrink-0"
            style={{
              color: comp.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS,
              backgroundColor: `${comp.cost === 'High' ? STATUS_WARNING : STATUS_SUCCESS}${OPACITY_15}`,
            }}
          >
            Cost: {comp.cost}
          </span>
        )}

        {/* Property count */}
        <span className="text-2xs text-text-muted shrink-0">
          {comp.properties.length} props
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
          <p className="text-2xs text-text-muted leading-relaxed">{comp.description}</p>

          {/* Class info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xs font-mono" style={{ color: km.color }}>
              {comp.cppClass}
            </span>
            <span className="text-2xs text-text-muted">
              extends <span className="font-mono">{comp.parentClass}</span>
            </span>
          </div>

          {/* Output type */}
          {comp.outputType && (
            <div className="flex items-center gap-2">
              <span className="text-2xs text-text-muted">Output:</span>
              <span
                className="text-2xs font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${ACCENT_ORANGE}${OPACITY_10}`, color: ACCENT_ORANGE }}
              >
                {comp.outputType}
              </span>
            </div>
          )}

          {/* Properties table */}
          <div className="mt-1.5">
            <div className="grid grid-cols-[120px_80px_1fr] gap-2 pb-1 border-b border-border/30">
              <span className="text-2xs font-semibold text-text-muted">Property</span>
              <span className="text-2xs font-semibold text-text-muted">Type</span>
              <span className="text-2xs font-semibold text-text-muted">Default / Meta</span>
            </div>
            {comp.properties.map((p) => (
              <PropertyRow key={p.name} prop={p} />
            ))}
          </div>

          {/* Descriptions under props */}
          <div className="space-y-1 mt-1">
            {comp.properties.map((p) => (
              <div key={`desc-${p.name}`} className="flex gap-2 items-start">
                <span className="text-2xs font-mono text-text-muted shrink-0 w-28">{p.name}</span>
                <span className="text-2xs text-text-muted/70">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupSection({ kind, components }: { kind: ComponentKind; components: EQSComponentDef[] }) {
  const km = KIND_META[kind];
  const KindIcon = km.icon;

  if (components.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={`eqs-group-${kind}`}>
      <div className="flex items-center gap-2">
        <span style={{ color: km.color }}><KindIcon className="w-3.5 h-3.5" /></span>
        <h3 className="text-xs font-bold text-text">{km.label}s</h3>
        <span className="text-2xs text-text-muted">({components.length})</span>
      </div>
      <div className="space-y-1.5">
        {components.map((c) => (
          <ComponentCard key={c.id} comp={c} />
        ))}
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export function EQSComponentInventory() {
  const contexts = EQS_COMPONENTS.filter((c) => c.kind === 'context');
  const generators = EQS_COMPONENTS.filter((c) => c.kind === 'generator');
  const tests = EQS_COMPONENTS.filter((c) => c.kind === 'test');

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="eqs-component-inventory">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4" style={{ color: ACCENT_CYAN }} />
          <h2 className="text-sm font-bold text-text">EQS Component Inventory</h2>
          <span className="text-2xs text-text-muted">{EQS_COMPONENTS.length} custom components</span>
        </div>
        <p className="text-2xs text-text-muted leading-relaxed max-w-2xl">
          All custom EQS components from <code className="font-mono">Source/PoF/AI/EQS/</code> with
          real UPROPERTY defaults and meta clamps from C++. Grouped by type: Context resolves an actor
          reference, Generators produce spatial candidates, Tests score or filter them.
        </p>
      </div>

      {/* Summary badges */}
      <SurfaceCard className="p-3">
        <div className="flex items-center gap-4 flex-wrap">
          {([
            { kind: 'context' as ComponentKind, count: contexts.length },
            { kind: 'generator' as ComponentKind, count: generators.length },
            { kind: 'test' as ComponentKind, count: tests.length },
          ]).map(({ kind, count }) => {
            const km = KIND_META[kind];
            const Icon = km.icon;
            return (
              <div key={kind} className="flex items-center gap-2">
                <div
                  className="p-1 rounded"
                  style={{ backgroundColor: `${km.color}${OPACITY_10}` }}
                >
                  <span style={{ color: km.color }}><Icon className="w-3 h-3" /></span>
                </div>
                <span className="text-2xs font-bold text-text">{count}</span>
                <span className="text-2xs text-text-muted">{km.label}{count !== 1 ? 's' : ''}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" style={{ color: STATUS_SUCCESS }} />
              <span className="text-2xs text-text-muted">Low cost</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3" style={{ color: STATUS_WARNING }} />
              <span className="text-2xs text-text-muted">High cost</span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Grouped sections */}
      <GroupSection kind="context" components={contexts} />
      <GroupSection kind="generator" components={generators} />
      <GroupSection kind="test" components={tests} />
    </div>
  );
}
