import {
  EQS_ATTACK_POSITIONS, EQS_PATROL_POINTS, EQS_COVER_POSITIONS,
  EQS_LINE_OF_SIGHT, EQS_ELEVATION_ADVANTAGE,
  eqsFloat, eqsClampMeta,
} from '@/lib/ai-director/eqs-defaults';
import { EQS_CATALOG, type EQSComponentKind } from '@/lib/ai-director/eqs-catalog';
import type { ComponentKind, EQSComponentDef } from './types';

/** Inventory-only detail per catalog component: description, output and UPROPERTYs. */
type InventoryDetail = Pick<EQSComponentDef, 'description' | 'outputType' | 'properties'>;

// Component identity (displayName / cppClass / kind / parentClass / cost) lives in
// the single-source `eqs-catalog.ts`; this table only adds what the inventory shows.
const INVENTORY_DETAIL: Record<string, InventoryDetail> = {
  // ── Context ──
  'ctx-target-actor': {
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
  'gen-attack-positions': {
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
        defaultValue: eqsFloat(EQS_ATTACK_POSITIONS.attackDistance),
        meta: eqsClampMeta(EQS_ATTACK_POSITIONS.clamps.attackDistance),
        description: 'Distance from the center actor at which to generate points.',
      },
      {
        name: 'NumberOfPoints',
        type: 'int32',
        defaultValue: String(EQS_ATTACK_POSITIONS.numberOfPoints),
        meta: eqsClampMeta(EQS_ATTACK_POSITIONS.clamps.numberOfPoints),
        description: 'Number of points evenly distributed around the ring.',
      },
      {
        name: 'bGenerateInnerRing',
        type: 'bool',
        defaultValue: String(EQS_ATTACK_POSITIONS.generateInnerRing),
        description: 'When true, adds a second inner ring at half AttackDistance for fallback positions.',
      },
    ],
  },
  'gen-patrol-points': {
    description: 'Generates random navigable points in an annular ring around the querier for patrol behavior. Nav-projected via TraceMode=Navigation.',
    outputType: 'TArray<FNavLocation>',
    properties: [
      {
        name: 'NumberOfPoints',
        type: 'int32',
        defaultValue: String(EQS_PATROL_POINTS.numberOfPoints),
        meta: eqsClampMeta(EQS_PATROL_POINTS.clamps.numberOfPoints),
        description: 'Number of random points to generate.',
      },
      {
        name: 'MinRadius',
        type: 'float',
        defaultValue: eqsFloat(EQS_PATROL_POINTS.minRadius),
        meta: eqsClampMeta(EQS_PATROL_POINTS.clamps.minRadius),
        description: 'Minimum distance from the querier.',
      },
      {
        name: 'MaxRadius',
        type: 'float',
        defaultValue: eqsFloat(EQS_PATROL_POINTS.maxRadius),
        meta: eqsClampMeta(EQS_PATROL_POINTS.clamps.maxRadius),
        description: 'Maximum distance from the querier.',
      },
    ],
  },
  'gen-cover-positions': {
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
        defaultValue: String(EQS_COVER_POSITIONS.sampleCount),
        meta: eqsClampMeta(EQS_COVER_POSITIONS.clamps.sampleCount),
        description: 'Number of candidate sample points per ring around the threat.',
      },
      {
        name: 'MinRadius',
        type: 'float',
        defaultValue: eqsFloat(EQS_COVER_POSITIONS.minRadius),
        meta: eqsClampMeta(EQS_COVER_POSITIONS.clamps.minRadius),
        description: 'Minimum search radius from the threat.',
      },
      {
        name: 'MaxRadius',
        type: 'float',
        defaultValue: eqsFloat(EQS_COVER_POSITIONS.maxRadius),
        meta: eqsClampMeta(EQS_COVER_POSITIONS.clamps.maxRadius),
        description: 'Maximum search radius from the threat.',
      },
      {
        name: 'NumberOfRings',
        type: 'int32',
        defaultValue: String(EQS_COVER_POSITIONS.numberOfRings),
        meta: eqsClampMeta(EQS_COVER_POSITIONS.clamps.numberOfRings),
        description: 'Number of radial rings between MinRadius and MaxRadius.',
      },
      {
        name: 'CoverCheckDistance',
        type: 'float',
        defaultValue: eqsFloat(EQS_COVER_POSITIONS.coverCheckDistance),
        meta: eqsClampMeta(EQS_COVER_POSITIONS.clamps.coverCheckDistance),
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
  'test-flank-angle': {
    description: 'Scores positions by the angle between the target\'s forward vector and the direction from target to test point. 0\u00B0 = front, 180\u00B0 = behind.',
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
  'test-path-exists': {
    description: 'Tests whether a valid navigation path exists from the querier to each item. Returns 1.0 if reachable, 0.0 if not. Use as a filter.',
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
  'test-line-of-sight': {
    description: 'Scores positions by LOS exposure to a threat using multi-height traces. 0.0 = fully exposed, 1.0 = fully occluded (best cover).',
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
        defaultValue: String(EQS_LINE_OF_SIGHT.numberOfTraceHeights),
        meta: eqsClampMeta(EQS_LINE_OF_SIGHT.clamps.numberOfTraceHeights),
        description: 'Vertical trace rays spread from crouch to standing height.',
      },
      {
        name: 'MinTraceHeight',
        type: 'float',
        defaultValue: eqsFloat(EQS_LINE_OF_SIGHT.minTraceHeight),
        meta: eqsClampMeta(EQS_LINE_OF_SIGHT.clamps.minTraceHeight),
        description: 'Lowest trace height offset (crouch height).',
      },
      {
        name: 'MaxTraceHeight',
        type: 'float',
        defaultValue: eqsFloat(EQS_LINE_OF_SIGHT.maxTraceHeight),
        meta: eqsClampMeta(EQS_LINE_OF_SIGHT.clamps.maxTraceHeight),
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
  'test-elevation-advantage': {
    description: 'Scores positions by elevation relative to a reference actor. Higher positions receive better scores \u2014 simulates high ground tactical advantage.',
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
        defaultValue: eqsFloat(EQS_ELEVATION_ADVANTAGE.maxElevationBonus),
        meta: eqsClampMeta(EQS_ELEVATION_ADVANTAGE.clamps.maxElevationBonus),
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
};

/** The inventory's coarser grouping: score and filter tests are both "Tests". */
const inventoryKind = (kind: EQSComponentKind): ComponentKind =>
  kind === 'test-score' || kind === 'test-filter' ? 'test' : kind === 'generator' ? 'generator' : 'context';

/**
 * Every custom EQS component implemented in `Source/PoF/AI/EQS/` — the catalog's
 * `source` entries, in catalog order. Proposed (squad codegen) and engine
 * built-in components are catalogued but not listed here.
 */
export const EQS_COMPONENTS: EQSComponentDef[] = EQS_CATALOG
  .filter((c) => c.status === 'source')
  .map((c) => ({
    id: c.id,
    displayName: c.displayName,
    cppClass: c.cppClass,
    kind: inventoryKind(c.kind),
    parentClass: c.parentClass,
    ...(c.cost ? { cost: c.cost } : {}),
    ...(INVENTORY_DETAIL[c.id] ?? { description: c.summary, properties: [] }),
  }));
