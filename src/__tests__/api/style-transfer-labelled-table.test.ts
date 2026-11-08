import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { POST } from '@/app/api/style-transfer/route';
import type { AnalyzedProperties } from '@/components/modules/content/materials/MaterialStyleTransfer';

afterEach(cleanup);

/**
 * Labelled table: each description is run through the real route and scored on the surface
 * type (and, where the words say so, metallic) a reader would expect. `stone` is the route's
 * no-signal default. The score is the number of rows read wrongly; it must be 0.
 */
const TABLE: [string, string, number | null][] = [
  ['rusted iron plate', 'metal', null],
  ['polished chrome', 'metal', null],
  ['non-metallic plastic', 'stone', 0],
  ['non metallic ceramic glaze', 'stone', 0],
  ['dielectric coating', 'stone', 0],
  ['faceted crystal', 'glass', null],
  ['faceted gemstone', 'glass', null],
  ['a facet cut diamond-like gem', 'glass', null],
  ['human face skin', 'skin', null],
  ['rough stone wall', 'stone', null],
  ['mossy grass field', 'foliage', null],
  ['glowing runes', 'emissive', null],
  ['neon sign', 'emissive', null],
  ['flowing lava', 'emissive', null],
  ['deep ocean water', 'water', null],
  ['clear glass bottle', 'glass', null],
  ['frozen ice block', 'glass', null],
  ['soft silk fabric', 'cloth', null],
  ['worn leather', 'cloth', null],
  ['weathered rock surface', 'stone', null],
  ['forest environment', 'stone', null],
  ['a low price tag', 'stone', null],
  ['brushed steel armor', 'metal', null],
  ['metallic gold sheen', 'metal', 0.8],
  ['wooden plank floor', 'stone', 0],
  ['marble statue', 'stone', null],
  ['character body skin', 'skin', null],
  ['leaf and plant detail', 'foliage', null],
  ['hades style flame', 'emissive', null],
  ['zelda water shrine', 'water', null],
];

async function run(description: string): Promise<AnalyzedProperties> {
  const res = await POST(
    new Request('http://localhost/api/style-transfer', {
      method: 'POST',
      body: JSON.stringify({ action: 'analyze', description }),
    }) as never,
  );
  return (await res.json()).data.analysis as AnalyzedProperties;
}

describe('style analyzer against a labelled description table', () => {
  it('reads no row wrongly', async () => {
    const wrong: string[] = [];
    for (const [text, surface, metallic] of TABLE) {
      const a = await run(text);
      if (a.surfaceType !== surface || (metallic !== null && a.metallic !== metallic)) {
        wrong.push(`${text} -> ${a.surfaceType}/${a.metallic}`);
      }
    }
    expect(wrong, `${wrong.length} of ${TABLE.length} rows wrong`).toEqual([]);
  });
});
