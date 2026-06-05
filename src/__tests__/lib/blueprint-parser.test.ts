import { describe, it, expect } from 'vitest';
import { parseBlueprintJson, blueprintTypeToCpp } from '@/lib/blueprint-parser';

/** A Blueprint export mixing nodes with and without NodeGuid, across two graphs. */
const BP_MIXED_GUIDS = {
  ClassName: 'BP_Test',
  ParentClass: 'AActor',
  Graphs: [
    {
      GraphName: 'EventGraph',
      GraphType: 'event',
      Nodes: [
        { NodeClass: 'K2Node_Event', Name: 'BeginPlay' },            // no NodeGuid
        { NodeGuid: 'GUID-ABC', NodeClass: 'K2Node_CallFunction' },  // has NodeGuid
        { NodeClass: 'K2Node_VariableGet' },                         // no NodeGuid
      ],
    },
    {
      GraphName: 'DoStuff',
      GraphType: 'function',
      Nodes: [
        { NodeClass: 'K2Node_FunctionEntry' },                       // no NodeGuid
      ],
    },
  ],
};

/** A Blueprint with only top-level Nodes (exercises the event-graph fallback path). */
const BP_TOPLEVEL_NODES = {
  ClassName: 'BP_Fallback',
  ParentClass: 'AActor',
  Nodes: [
    { NodeClass: 'K2Node_Event', Name: 'Tick' }, // no NodeGuid
    { NodeClass: 'K2Node_CallFunction' },         // no NodeGuid
  ],
};

function allNodeIds(input: object): string[] {
  const asset = parseBlueprintJson(input);
  return [...asset.eventGraph.nodes, ...asset.functions.flatMap((f) => f.nodes)].map((n) => n.id);
}

describe('blueprint-parser', () => {
  describe('parseBlueprintJson — deterministic node ids', () => {
    it('produces identical ids when parsing the same Blueprint twice', () => {
      expect(allNodeIds(BP_MIXED_GUIDS)).toEqual(allNodeIds(BP_MIXED_GUIDS));
    });

    it('produces a fully identical asset when parsing the same Blueprint twice', () => {
      expect(parseBlueprintJson(BP_MIXED_GUIDS)).toEqual(parseBlueprintJson(BP_MIXED_GUIDS));
    });

    it('assigns sequential node-N ids to nodes missing a NodeGuid, preserving NodeGuid when present', () => {
      const asset = parseBlueprintJson(BP_MIXED_GUIDS);
      const eventIds = asset.eventGraph.nodes.map((n) => n.id);
      const fnIds = asset.functions[0].nodes.map((n) => n.id);
      // Counter advances only on the fallback, so guid nodes don't consume a number.
      expect(eventIds).toEqual(['node-0', 'GUID-ABC', 'node-1']);
      expect(fnIds).toEqual(['node-2']);
    });

    it('produces collision-free ids within a single parse', () => {
      const ids = allNodeIds(BP_MIXED_GUIDS);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses the deterministic counter on the top-level Nodes fallback path', () => {
      expect(allNodeIds(BP_TOPLEVEL_NODES)).toEqual(['node-0', 'node-1']);
      // And it stays deterministic across repeated parses.
      expect(allNodeIds(BP_TOPLEVEL_NODES)).toEqual(['node-0', 'node-1']);
    });

    it('accepts a JSON string and a pre-parsed object identically', () => {
      const fromString = parseBlueprintJson(JSON.stringify(BP_MIXED_GUIDS));
      const fromObject = parseBlueprintJson(BP_MIXED_GUIDS);
      expect(fromString).toEqual(fromObject);
    });
  });

  describe('blueprintTypeToCpp', () => {
    it('maps primitive Blueprint types to their C++ equivalents', () => {
      expect(blueprintTypeToCpp('bool')).toBe('bool');
      expect(blueprintTypeToCpp('int')).toBe('int32');
      expect(blueprintTypeToCpp('vector')).toBe('FVector');
    });
  });
});
